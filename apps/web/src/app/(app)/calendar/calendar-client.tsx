"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { ProjectPicker } from "@/components/project-picker";

interface Entry { id: string; title?: string | null; date: string; time?: string | null; platform?: string | null; status: string }
interface Calendar { id: string; name: string; project?: { name: string; brand?: { name: string } }; entries?: Entry[] }

export function CalendarClient() {
  const [calendars, setCalendars] = useState<Calendar[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [projectId, setProjectId] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  function load() {
    api<Calendar[]>("/calendar").then(setCalendars).catch((e) => setErr(e.message));
  }
  useEffect(() => { load(); }, []);

  async function generate() {
    if (!projectId) return;
    setBusy(true); setErr(null); setMsg(null);
    try {
      const r = await api<{ scheduled: number }>("/calendar", {
        method: "POST", body: JSON.stringify({ projectId }),
      });
      setMsg(`Calendário gerado: ${r.scheduled} posts agendados.`);
      load();
    } catch (e) { setErr(e instanceof Error ? e.message : "Erro"); }
    finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="Calendário" subtitle="Planejamento editorial no tempo, gerado a partir da linha editorial." />

      <div className="rounded-xl border border-border bg-elevated p-4">
        <p className="mb-3 text-sm font-semibold">Gerar calendário do projeto</p>
        <div className="flex flex-wrap items-center gap-3">
          <ProjectPicker value={projectId} onChange={setProjectId} />
          <button
            onClick={generate}
            disabled={busy || !projectId}
            className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Gerando…" : "Gerar calendário"}
          </button>
        </div>
        <p className="mt-2 text-xs text-muted">Distribui os temas da linha editorial nas próximas semanas (seg/qua/sex).</p>
        {msg && <p className="mt-2 text-sm text-emerald-500">{msg}</p>}
      </div>

      {err && <p className="text-sm text-rose-500">{err}</p>}
      {calendars === null ? <p className="text-sm text-muted">Carregando…</p> :
        calendars.length === 0 ? <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted">Sem calendários ainda. Selecione um projeto acima e gere o primeiro (precisa ter linha editorial criada).</p> :
        calendars.map((cal) => (
          <div key={cal.id} className="rounded-xl border border-border bg-elevated p-5">
            <p className="font-medium">{cal.name}</p>
            <p className="text-xs text-muted">{cal.project?.brand?.name} · {cal.project?.name}</p>
            {!cal.entries || cal.entries.length === 0 ? <p className="mt-2 text-sm text-muted">Sem posts agendados.</p> :
              <ul className="mt-3 divide-y divide-border">
                {cal.entries.slice(0, 40).map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <div className="min-w-0">
                      <span className="text-muted">{new Date(e.date).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" })}</span>
                      {e.title && <span className="ml-2">{e.title}</span>}
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      {e.platform && <span className="rounded-full bg-border px-2 py-0.5 text-xs text-muted">{e.platform}</span>}
                      <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs text-brand">{e.status}</span>
                    </div>
                  </li>
                ))}
              </ul>}
          </div>
        ))}
    </div>
  );
}
