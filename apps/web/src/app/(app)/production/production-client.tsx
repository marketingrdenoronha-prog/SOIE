"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Item {
  id: string;
  title: string;
  channel: string;
  type: string;
  status: string;
  theme: string | null;
  clientId: string | null;
  clientName: string;
  token: string | null;
  updatedAt: string;
}

const COLUMNS: Array<{ status: string; label: string }> = [
  { status: "generating", label: "Gerando" },
  { status: "draft", label: "Rascunho" },
  { status: "internal_review", label: "Revisão interna" },
  { status: "client_review", label: "Com o cliente" },
  { status: "changes_requested", label: "Ajuste pedido" },
  { status: "approved", label: "Aprovado (a entregar)" },
];

/** Produção — fila do designer/filmaker através de TODOS os clientes. */
export function ProductionClient() {
  const [items, setItems] = useState<Item[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setErr(null);
    try { setItems(await api<Item[]>("/production")); }
    catch (e) { setErr(e instanceof Error ? e.message : "Erro"); }
  }
  useEffect(() => { load(); }, []);

  async function act(id: string, action: "approve" | "deliver") {
    try { await api(`/deliverables/${id}/${action}`, { method: "POST" }); await load(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Erro"); }
  }

  return (
    <div className="mx-auto max-w-[1100px] space-y-6">
      <div>
        <h1 className="text-[32px] font-bold leading-tight tracking-[-0.03em]">Produção</h1>
        <p className="text-sm text-muted">Fila de produção e revisão de todas as peças, de todos os clientes.</p>
      </div>

      {err && <p className="text-sm text-crit">{err}</p>}

      {items === null ? (
        <p className="text-sm text-muted">Carregando…</p>
      ) : items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted">
          Nenhuma peça em produção. Aprove uma linha editorial e clique em “Produzir todos” dentro do cliente.
        </p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {COLUMNS.map((col) => {
            const list = items.filter((d) => d.status === col.status);
            if (list.length === 0) return null;
            return (
              <section key={col.status} className="rounded-xl border border-border bg-elevated p-3">
                <p className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted">
                  {col.label}
                  <span className="rounded-full bg-border/60 px-2 py-0.5 text-[11px]">{list.length}</span>
                </p>
                <div className="space-y-2">
                  {list.map((d) => <Card key={d.id} d={d} onAct={act} />)}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Card({ d, onAct }: { d: Item; onAct: (id: string, a: "approve" | "deliver") => void }) {
  const [copied, setCopied] = useState(false);
  const reviewUrl = d.token && typeof window !== "undefined" ? `${window.location.origin}/review/${d.token}` : null;
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <p className="text-sm font-medium">{d.title}</p>
      <p className="mt-0.5 text-xs text-muted">
        {d.clientId ? <Link href={`/clients/${d.clientId}`} className="hover:text-brand">{d.clientName}</Link> : d.clientName}
        {" · "}{d.channel} · {d.type}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {d.status === "internal_review" && (
          <button onClick={() => onAct(d.id, "approve")} className="rounded-md bg-brand px-2 py-1 text-[11px] font-semibold text-white hover:bg-brand-strong dark:text-[#00390d]">
            Aprovar → cliente
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
        {d.clientId && (
          <Link href={`/clients/${d.clientId}`} className="rounded-md border border-border px-2 py-1 text-[11px] hover:bg-elevated">
            Abrir cliente
          </Link>
        )}
      </div>
    </div>
  );
}
