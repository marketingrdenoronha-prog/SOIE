"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { ProjectPicker } from "@/components/project-picker";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Strategy = any;

export function EditorialClient() {
  const [projectId, setProjectId] = useState("");
  const [strategies, setStrategies] = useState<Strategy[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    if (!projectId) return;
    try { setStrategies(await api<Strategy[]>(`/editorial?projectId=${projectId}`)); }
    catch (e) { setErr(e instanceof Error ? e.message : "Erro"); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [projectId]);

  async function generate() {
    if (!projectId) return;
    setBusy(true); setErr(null);
    try {
      await api("/editorial", { method: "POST", body: JSON.stringify({ projectId })});
      await load();
    } catch (e) { setErr(e instanceof Error ? e.message : "Erro"); }
    finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Linha Editorial"
        subtitle="Estratégia traduzida em eixos de conteúdo, com objetivo e funil."
        action={<button onClick={generate} disabled={busy || !projectId} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
          {busy ? "Gerando…" : "Gerar linha editorial"}
        </button>}
      />

      <div className="flex items-center gap-3">
        <span className="text-sm text-muted">Projeto:</span>
        <ProjectPicker value={projectId} onChange={setProjectId} />
      </div>

      {err && <p className="text-sm text-rose-500">{err}</p>}

      {strategies === null ? <p className="text-sm text-muted">Carregando…</p> :
        strategies.length === 0 ? <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted">Sem estratégia ainda.</p> :
        strategies.map((s) => (
          <div key={s.id} className="rounded-xl border border-border bg-elevated p-5 space-y-4">
            {s.positioning && <div><p className="text-xs font-medium uppercase tracking-wider text-muted">Posicionamento</p><p className="mt-1 text-sm">{s.positioning}</p></div>}
            {s.pillars?.length > 0 && <div><p className="text-xs font-medium uppercase tracking-wider text-muted">Pilares</p><div className="mt-1 flex flex-wrap gap-2">{s.pillars.map((p: string, i: number) => <span key={i} className="rounded-md bg-brand/10 px-2 py-0.5 text-xs text-brand">{p}</span>)}</div></div>}
            {s.editorialLines?.map((line: {
              id: string; name: string; objective: string; funnelStage: string; platforms?: string[];
              categories?: { id: string; name: string; themes?: { id: string; title: string }[] }[]
            }) => (
              <div key={line.id} className="rounded-lg border border-border p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{line.name}</p>
                  <span className="rounded-md bg-brand/10 px-2 py-0.5 text-xs text-brand">{line.objective}</span>
                  <span className="rounded-md bg-border/50 px-2 py-0.5 text-xs">{line.funnelStage}</span>
                  {line.platforms?.map((p, i) => <span key={i} className="rounded-md bg-border/50 px-2 py-0.5 text-xs">{p}</span>)}
                </div>
                {line.categories?.map((c) => (
                  <div key={c.id} className="mt-2">
                    <p className="text-sm font-medium">{c.name}</p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {c.themes?.map((t) => <span key={t.id} className="rounded-md border border-border px-2 py-0.5 text-xs">{t.title}</span>)}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        ))}
    </div>
  );
}
