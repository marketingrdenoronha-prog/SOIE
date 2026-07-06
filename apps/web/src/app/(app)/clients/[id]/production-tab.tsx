"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { SpecView } from "@/components/spec-view";
import { ErrorBoundary } from "@/components/error-boundary";

/* eslint-disable @typescript-eslint/no-explicit-any */

const COLUMNS: Array<{ status: string; label: string }> = [
  { status: "generating", label: "Gerando" },
  { status: "draft", label: "Rascunho" },
  { status: "internal_review", label: "Revisão interna" },
  { status: "client_review", label: "Com o cliente" },
  { status: "changes_requested", label: "Ajuste pedido" },
  { status: "approved", label: "Aprovado" },
  { status: "delivered", label: "Entregue" },
];

export function ProductionTab({ clientId }: { clientId: string }) {
  const [strategies, setStrategies] = useState<any[] | null>(null);
  const [deliverables, setDeliverables] = useState<any[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function load() {
    setErr(null);
    try {
      const [st, dv] = await Promise.all([
        api<any[]>(`/clients/${clientId}/editorial-strategies`),
        api<any[]>(`/clients/${clientId}/deliverables`),
      ]);
      setStrategies(st);
      setDeliverables(dv);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [clientId]);

  const approved = strategies?.find((s) => s.status === "approved");

  async function produceAll() {
    if (!approved) return;
    setBusy(true); setErr(null); setMsg(null);
    try {
      const r = await api<{ produced: number; failed: number; totalThemes: number }>(
        `/editorial-strategies/${approved.id}/produce-all`,
        { method: "POST" },
      );
      setMsg(`Produção concluída: ${r.produced} peça(s) gerada(s)${r.failed ? `, ${r.failed} falha(s)` : ""}.`);
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro ao produzir");
    } finally {
      setBusy(false);
    }
  }

  async function act(id: string, action: "approve" | "deliver") {
    setErr(null);
    try {
      await api(`/deliverables/${id}/${action}`, { method: "POST" });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
    }
  }

  if (strategies === null || deliverables === null) {
    return <p className="text-sm text-muted">Carregando produção…</p>;
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-elevated p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Produção automática</p>
            <p className="mt-1 text-xs text-muted">
              {approved
                ? `1 clique gera uma peça para cada tema da linha editorial aprovada (V${approved.version}).`
                : "Aprove uma linha editorial para liberar a produção automática."}
            </p>
          </div>
          <button
            onClick={produceAll}
            disabled={busy || !approved}
            className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-50 dark:text-[#00390d]"
          >
            {busy ? "Produzindo…" : "Produzir todos"}
          </button>
        </div>
        {msg && <p className="mt-2 text-sm text-ok">{msg}</p>}
        {err && <p className="mt-2 text-sm text-crit">{err}</p>}
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {COLUMNS.map((col) => {
          const items = deliverables.filter((d) => d.status === col.status);
          if (items.length === 0) return null;
          return (
            <section key={col.status} className="rounded-xl border border-border bg-elevated p-3">
              <p className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted">
                {col.label}
                <span className="rounded-full bg-border/60 px-2 py-0.5 text-[11px]">{items.length}</span>
              </p>
              <div className="space-y-2">
                {items.map((d) => <Card key={d.id} d={d} onAct={act} />)}
              </div>
            </section>
          );
        })}
        {deliverables.length === 0 && (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted md:col-span-2 xl:col-span-3">
            Nenhuma peça produzida ainda.
          </p>
        )}
      </div>
    </div>
  );
}

function Card({ d, onAct }: { d: any; onAct: (id: string, action: "approve" | "deliver") => void }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const token = d.reviewLinks?.[0]?.token;
  const reviewUrl = token && typeof window !== "undefined" ? `${window.location.origin}/review/${token}` : null;

  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <p className="text-sm font-medium">{d.title}</p>
      <p className="mt-0.5 text-xs text-muted">{d.channel} · {d.type}</p>
      {d.originTheme?.title && <p className="mt-1 text-[11px] text-muted">Tema: {d.originTheme.title}</p>}

      <div className="mt-2 flex flex-wrap gap-1.5">
        <button onClick={() => setOpen((v) => !v)} className="rounded-md border border-border px-2 py-1 text-[11px] hover:bg-elevated">
          {open ? "Ocultar" : "Ver roteiro"}
        </button>
        {d.status === "internal_review" && (
          <button onClick={() => onAct(d.id, "approve")} className="rounded-md bg-brand px-2 py-1 text-[11px] font-semibold text-white hover:bg-brand-strong dark:text-[#00390d]">
            Aprovar interno → cliente
          </button>
        )}
        {d.status === "approved" && (
          <button onClick={() => onAct(d.id, "deliver")} className="rounded-md bg-ok px-2 py-1 text-[11px] font-semibold text-white hover:opacity-90">
            Marcar entregue
          </button>
        )}
        {reviewUrl && (d.status === "client_review" || d.status === "changes_requested") && (
          <button
            onClick={() => { navigator.clipboard.writeText(reviewUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
            className="rounded-md border border-border px-2 py-1 text-[11px] hover:bg-elevated"
          >
            {copied ? "Copiado!" : "Copiar link cliente"}
          </button>
        )}
      </div>

      {d.comments?.some((c: any) => c.decision === "request_changes") && (
        <p className="mt-2 text-[11px] text-warn">
          Ajuste: “{d.comments.find((c: any) => c.decision === "request_changes")?.comment}”
        </p>
      )}

      {open && (
        <div className="mt-2 border-t border-border pt-2">
          <ErrorBoundary>
            <SpecView type={d.type} spec={d.spec} />
          </ErrorBoundary>
        </div>
      )}
    </div>
  );
}
