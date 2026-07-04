"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { PageHeader } from "@/components/page-header";

interface Data {
  summary: { projects: number; totalAiCostUsd: number; aiExecutionsCount: number };
  deliverablesByStatus: Array<{ status: string; _count: number }>;
  recentAiExecutions: Array<{ id: string; provider: string; model: string; costUsd: number; createdAt: string; status: string }>;
}

export function ReportsClient() {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<Data>("/reports").then(setData).catch((e) => setErr(e.message));
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="Relatórios" subtitle="Resultados consolidados." />
      {err && <p className="text-sm text-rose-500">{err}</p>}
      {!data ? <p className="text-sm text-muted">Carregando…</p> : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Stat label="Projetos" value={data.summary.projects.toString()} />
            <Stat label="Execuções de IA" value={data.summary.aiExecutionsCount.toString()} />
            <Stat label="Custo total de IA" value={`US$ ${data.summary.totalAiCostUsd.toFixed(4)}`} />
          </div>

          <section className="rounded-xl border border-border bg-elevated p-5">
            <h2 className="mb-3 text-sm font-semibold">Entregas por status</h2>
            {data.deliverablesByStatus.length === 0 ? <p className="text-sm text-muted">Sem entregas ainda.</p> :
              <div className="grid gap-2 sm:grid-cols-2">
                {data.deliverablesByStatus.map((d) => (
                  <div key={d.status} className="flex items-center justify-between rounded-lg border border-border p-2 text-sm">
                    <span>{d.status}</span><span className="font-medium">{d._count}</span>
                  </div>
                ))}
              </div>}
          </section>

          <section className="rounded-xl border border-border bg-elevated p-5">
            <h2 className="mb-3 text-sm font-semibold">Últimas execuções de IA</h2>
            {data.recentAiExecutions.length === 0 ? <p className="text-sm text-muted">Nada ainda.</p> :
              <ul className="divide-y divide-border text-sm">
                {data.recentAiExecutions.map((e) => (
                  <li key={e.id} className="flex items-center justify-between py-2">
                    <span>{e.provider} · {e.model}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-muted">{new Date(e.createdAt).toLocaleString("pt-BR")}</span>
                      <span className="tabular-nums">US$ {e.costUsd.toFixed(6)}</span>
                      <span className={e.status === "success" ? "text-emerald-500" : "text-rose-500"}>{e.status}</span>
                    </div>
                  </li>
                ))}
              </ul>}
          </section>
        </>
      )}
    </div>
  );
}
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-elevated p-4">
      <p className="text-xs font-medium uppercase tracking-wider text-muted">{label}</p>
      <p className="mt-2 text-2xl font-semibold tabular-nums">{value}</p>
    </div>
  );
}
