"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { text, arr } from "@/lib/render";
import { PageHeader } from "@/components/page-header";
import { ProjectPicker } from "@/components/project-picker";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Persona = any;

export function AudienceClient() {
  const [projectId, setProjectId] = useState("");
  const [personas, setPersonas] = useState<Persona[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [brief, setBrief] = useState("");
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    if (!projectId) return;
    try { setPersonas(await api<Persona[]>(`/personas?projectId=${projectId}`)); }
    catch (e) { setErr(e instanceof Error ? e.message : "Erro"); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [projectId]);

  async function generate() {
    if (!projectId) return;
    setBusy(true); setErr(null);
    try {
      await api("/personas", { method: "POST", body: JSON.stringify({ projectId, brief: brief || undefined })});
      setBrief("");
      await load();
    } catch (e) { setErr(e instanceof Error ? e.message : "Erro"); }
    finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="Inteligência da Audiência" subtitle="Personas com dores, objeções e desejos priorizados." />

      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm text-muted">Projeto:</span>
        <ProjectPicker value={projectId} onChange={setProjectId} />
      </div>

      <div className="rounded-xl border border-border bg-elevated p-4">
        <textarea value={brief} onChange={(e) => setBrief(e.target.value)} rows={2} placeholder="Briefing opcional (segmento, faixa etária, canal…)"
          className="w-full resize-none rounded-lg border border-border bg-surface p-3 text-sm outline-none focus:border-brand" />
        <div className="mt-3 flex justify-end">
          <button onClick={generate} disabled={busy || !projectId} className="rounded-lg bg-brand px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
            {busy ? "Gerando persona…" : "Gerar persona com IA"}
          </button>
        </div>
      </div>

      {err && <p className="text-sm text-rose-500">{err}</p>}

      {personas === null ? <p className="text-sm text-muted">Carregando…</p> :
        personas.length === 0 ? <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted">Sem personas ainda.</p> :
        <div className="space-y-4">
          {personas.map((p) => (
            <div key={p.id} className="rounded-xl border border-border bg-elevated p-5">
              <div className="flex items-start justify-between">
                <h3 className="text-base font-semibold">{text(p.name)}</h3>
                <span className="rounded-full bg-brand/10 px-2.5 py-0.5 text-xs text-brand">{text(p.confidence)}</span>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <ListBox title="Dores" items={arr(p.pains).map((x: any) => text(x?.description ?? x))} />
                <ListBox title="Objeções" items={arr(p.objections).map((x: any) => text(x?.description ?? x))} />
                <ListBox title="Desejos" items={arr(p.desires).map((x: any) => text(x?.description ?? x))} />
              </div>
            </div>
          ))}
        </div>}
    </div>
  );
}
function ListBox({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs font-medium uppercase tracking-wider text-muted">{title}</p>
      {items.length === 0 ? <p className="mt-1 text-sm text-muted">—</p> :
        <ul className="mt-1 space-y-1 text-sm">{items.map((it, i) => <li key={i}>• {it}</li>)}</ul>}
    </div>
  );
}
