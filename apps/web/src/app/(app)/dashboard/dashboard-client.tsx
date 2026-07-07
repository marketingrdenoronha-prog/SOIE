"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { KpiCard } from "@/components/kpi-card";

interface Dashboard {
  clients: { total: number; onboardingConcluido: number; semOnboarding: number; dossiesProntos: number };
  editorial: {
    total: number; emRevisaoCliente: number; aprovadas: number; emProducao: number;
    aPostar: number; emAcervo: number;
  };
  pieces: {
    total: number; aguardando: number; emProducao: number; produzida: number;
    emRevisaoInterna: number; aprovacaoCliente: number; aprovadas: number;
  };
  approvals: { pendentes: number; linhas: number; pecas: number };
  ai: { custoMesUsd: number; execucoesMes: number; custoTotalUsd: number; execucoesTotal: number };
  recentStrategies: Array<{
    id: string; version: number; status: string; productionStage: string | null;
    contentCount: number; inStock: boolean; createdAt: string; clientName: string;
  }>;
  recentExecutions: Array<{
    id: string; provider: string; model: string; costUsd: number; status: string; createdAt: string;
  }>;
}

const usd = (n: number) =>
  "US$ " + n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function DashboardClient() {
  const [data, setData] = useState<Dashboard | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<Dashboard>("/dashboard")
      .then(setData)
      .catch((e) => setErr(e instanceof Error ? e.message : "Erro ao carregar"));
  }, []);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Dashboard</h1>
        <p className="text-sm text-muted">Visão real da operação — clientes, linhas editoriais, produção e custo de IA.</p>
      </div>

      {err && <p className="rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-500">{err}</p>}

      {data === null && !err && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl border border-border bg-elevated" />
          ))}
        </div>
      )}

      {data && (
        <>
          <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <KpiCard
              label="Clientes ativos"
              value={String(data.clients.total)}
              hint={data.clients.semOnboarding > 0 ? `${data.clients.semOnboarding} sem onboarding` : "todos com onboarding"}
              trend={data.clients.semOnboarding > 0 ? "flat" : "up"}
            />
            <KpiCard
              label="Aprovações pendentes"
              value={String(data.approvals.pendentes)}
              hint={`${data.approvals.linhas} linhas · ${data.approvals.pecas} peças`}
              trend={data.approvals.pendentes > 0 ? "down" : "up"}
            />
            <KpiCard
              label="Peças em produção"
              value={String(data.pieces.aguardando + data.pieces.emProducao)}
              hint={`${data.pieces.produzida} produzidas · ${data.pieces.total} no total`}
              trend="flat"
            />
            <KpiCard
              label="Custo de IA (mês)"
              value={usd(data.ai.custoMesUsd)}
              hint={`${data.ai.execucoesMes} execuções · ${usd(data.ai.custoTotalUsd)} total`}
              trend="flat"
            />
          </section>

          {/* Funil operacional — o fluxo linear da V2 com números reais. */}
          <section className="rounded-xl border border-border bg-elevated p-5">
            <h2 className="mb-4 text-sm font-semibold">Funil operacional</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              <FunnelStep label="Clientes" value={data.clients.total} href="/clients" />
              <FunnelStep label="Dossiês prontos" value={data.clients.dossiesProntos} />
              <FunnelStep label="Linhas editoriais" value={data.editorial.total} href="/editorial" />
              <FunnelStep label="Em produção" value={data.editorial.emProducao} href="/production" />
              <FunnelStep label="A postar" value={data.editorial.aPostar} href="/production" accent />
              <FunnelStep label="No estoque" value={data.editorial.emAcervo} href="/editorial-stock" accent />
            </div>
          </section>

          <section className="grid gap-4 lg:grid-cols-3">
            {/* Linhas editoriais recentes */}
            <div className="rounded-xl border border-border bg-elevated p-5 lg:col-span-2">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold">Linhas editoriais recentes</h2>
                <Link href="/editorial" className="text-xs text-muted hover:text-foreground">ver todas →</Link>
              </div>
              {data.recentStrategies.length === 0 ? (
                <EmptyRow>Nenhuma linha editorial gerada ainda.</EmptyRow>
              ) : (
                <ul className="divide-y divide-border text-sm">
                  {data.recentStrategies.map((s) => (
                    <li key={s.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate font-medium">
                          {s.clientName} <span className="text-muted">· v{s.version}</span>
                        </p>
                        <p className="text-xs text-muted">
                          {s.contentCount} conteúdo{s.contentCount === 1 ? "" : "s"} · {fmtDate(s.createdAt)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        {s.inStock && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-500">acervo</span>}
                        <StageBadge stage={s.productionStage} status={s.status} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Produção + IA recente */}
            <div className="space-y-4">
              <div className="rounded-xl border border-border bg-elevated p-5">
                <h2 className="mb-3 text-sm font-semibold">Produção de peças</h2>
                <div className="space-y-2 text-sm">
                  <StatRow label="Aguardando" value={data.pieces.aguardando} />
                  <StatRow label="Em produção" value={data.pieces.emProducao} />
                  <StatRow label="Revisão interna" value={data.pieces.emRevisaoInterna} />
                  <StatRow label="Com o cliente" value={data.pieces.aprovacaoCliente} />
                  <StatRow label="Aprovadas" value={data.pieces.aprovadas} accent />
                </div>
              </div>

              <div className="rounded-xl border border-border bg-elevated p-5">
                <h2 className="mb-3 text-sm font-semibold">IA recente</h2>
                {data.recentExecutions.length === 0 ? (
                  <EmptyRow>Sem execuções ainda.</EmptyRow>
                ) : (
                  <ul className="space-y-2 text-sm">
                    {data.recentExecutions.map((e) => (
                      <li key={e.id} className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-muted" title={`${e.provider} · ${e.model}`}>{e.model}</span>
                        <span className="shrink-0 tabular-nums text-xs">{usd(e.costUsd)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function FunnelStep({ label, value, href, accent }: { label: string; value: number; href?: string; accent?: boolean }) {
  const inner = (
    <div className={`rounded-lg border p-3 text-center transition ${accent ? "border-brand/40 bg-brand/5" : "border-border/70"} ${href ? "hover:border-brand/60" : ""}`}>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="mt-1 text-[11px] uppercase tracking-wide text-muted">{label}</p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function StatRow({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className={`tabular-nums font-medium ${accent ? "text-emerald-500" : ""}`}>{value}</span>
    </div>
  );
}

function EmptyRow({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed border-border p-3 text-xs text-muted">{children}</p>;
}

const STAGE_LABEL: Record<string, string> = {
  client_review: "Revisão do cliente",
  approved: "Aprovada",
  design: "Em produção",
  final_review: "Aprovação final",
  to_post: "A postar",
};
const STATUS_LABEL: Record<string, string> = {
  draft: "Rascunho",
  pending_client: "Aguardando cliente",
  approved: "Aprovada",
  changes_requested: "Ajustes pedidos",
};

function StageBadge({ stage, status }: { stage: string | null; status: string }) {
  const label = (stage && STAGE_LABEL[stage]) || STATUS_LABEL[status] || status;
  const tone =
    stage === "to_post" || stage === "approved" || status === "approved"
      ? "bg-emerald-500/15 text-emerald-500"
      : stage === "client_review" || status === "pending_client"
        ? "bg-sky-500/15 text-sky-500"
        : stage === "design" || stage === "final_review"
          ? "bg-amber-500/15 text-amber-500"
          : status === "changes_requested"
            ? "bg-rose-500/15 text-rose-500"
            : "bg-border/60 text-muted";
  return <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${tone}`}>{label}</span>;
}

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
  } catch {
    return "";
  }
}
