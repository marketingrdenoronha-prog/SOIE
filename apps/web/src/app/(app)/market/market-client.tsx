"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/page-header";
import { ProjectPicker } from "@/components/project-picker";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Data { researches: any[]; competitors: any[]; analyses: any[] }

export function MarketClient() {
  const [projectId, setProjectId] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    if (!projectId) return;
    try { setData(await api<Data>(`/market?projectId=${projectId}`)); }
    catch (e) { setErr(e instanceof Error ? e.message : "Erro"); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [projectId]);

  async function start() {
    if (!projectId) return;
    setBusy(true); setErr(null);
    try {
      await api("/market", { method: "POST", body: JSON.stringify({ projectId })});
      await load();
    } catch (e) { setErr(e instanceof Error ? e.message : "Erro"); }
    finally { setBusy(false); }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        title="Inteligência de Mercado"
        subtitle="Pesquisa automática com os Agentes Mercado e Concorrência."
        action={<button onClick={start} disabled={busy || !projectId} className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50">
          {busy ? "Pesquisando…" : "Iniciar pesquisa"}
        </button>}
      />

      <div className="flex items-center gap-3">
        <span className="text-sm text-muted">Projeto:</span>
        <ProjectPicker value={projectId} onChange={setProjectId} />
      </div>

      {err && <p className="text-sm text-rose-500">{err}</p>}

      {data && (
        <>
          <Section title={`Concorrentes (${data.competitors.length})`}>
            {data.competitors.length === 0 ? <Empty /> :
              <div className="grid gap-3 sm:grid-cols-2">
                {data.competitors.map((c, i) => (
                  <div key={i} className="rounded-xl border border-border bg-elevated p-4">
                    <p className="font-medium">{c.name}</p>
                    {c.positioning && <p className="mt-1 text-sm text-muted">{c.positioning}</p>}
                    {c.url && <a href={c.url} target="_blank" className="mt-1 block text-xs text-brand hover:underline">{c.url}</a>}
                  </div>
                ))}
              </div>}
          </Section>

          <Section title={`Análises SWOT (${data.analyses.length})`}>
            {data.analyses.length === 0 ? <Empty /> :
              data.analyses.map((a, i) => (
                <div key={i} className="rounded-xl border border-border bg-elevated p-4">
                  <p className="text-xs text-muted">{new Date(a.createdAt).toLocaleDateString("pt-BR")} · confiança {a.confidence}</p>
                  {a.opportunities?.length > 0 && <Bullets title="Oportunidades" items={a.opportunities} />}
                  {a.threats?.length > 0 && <Bullets title="Ameaças" items={a.threats} />}
                  {a.trends?.length > 0 && <Bullets title="Tendências" items={a.trends} />}
                </div>
              ))}
          </Section>

          <Section title={`Pesquisas (${data.researches.length})`}>
            {data.researches.length === 0 ? <Empty /> :
              <ul className="divide-y divide-border">
                {data.researches.map((r) => (
                  <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                    <span>{r.type} · {new Date(r.createdAt).toLocaleString("pt-BR")}</span>
                    <span className="rounded-full bg-brand/10 px-2 py-0.5 text-xs text-brand">{r.status}</span>
                  </li>
                ))}
              </ul>}
          </Section>
        </>
      )}
    </div>
  );
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section><h2 className="mb-3 text-sm font-semibold">{title}</h2>{children}</section>;
}
function Empty() { return <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted">Nada ainda — clique em "Iniciar pesquisa".</p>; }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function Bullets({ title, items }: { title: string; items: any[] }) {
  return (
    <div className="mt-2">
      <p className="text-xs font-medium uppercase tracking-wider text-muted">{title}</p>
      <ul className="mt-1 list-disc pl-5 text-sm">{items.map((it, i) => <li key={i}>{typeof it === "string" ? it : (it.title || it.name || JSON.stringify(it))}</li>)}</ul>
    </div>
  );
}
