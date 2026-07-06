"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { text } from "@/lib/render";
import { EditorialDoc } from "@/components/editorial-doc";

interface StockCard {
  id: string;
  clientId: string | null;
  clientName: string;
  version: number;
  positioning: string | null;
  competencia: string | null;
  status: string;
  deliveryMethod: string | null;
  contentCount: number;
  createdAt: string;
  approvedAt: string | null;
  sentAt: string | null;
}

/** ESTOQUE EDITORIAL (global, no menu lateral) — acervo permanente de todas as
 * linhas aprovadas + enviadas, agrupado por cliente. Cada cliente tem seu
 * acervo exclusivo. Ao abrir uma linha, mostra o documento congelado exato. */
export function EditorialStockClient() {
  const [items, setItems] = useState<StockCard[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    setErr(null);
    api<{ items: StockCard[] }>("/editorial-stock")
      .then((r) => setItems(r.items))
      .catch((e) => setErr(e instanceof Error ? e.message : "Erro"));
  }, []);

  const groups = useMemo(() => {
    if (!items) return [];
    const q = query.trim().toLowerCase();
    const filtered = q
      ? items.filter((i) => i.clientName.toLowerCase().includes(q) || text(i.positioning).toLowerCase().includes(q) || (i.competencia ?? "").toLowerCase().includes(q))
      : items;
    const map = new Map<string, { clientId: string; clientName: string; cards: StockCard[] }>();
    for (const it of filtered) {
      const key = it.clientId ?? "—";
      if (!map.has(key)) map.set(key, { clientId: key, clientName: it.clientName, cards: [] });
      map.get(key)!.cards.push(it);
    }
    return [...map.values()].sort((a, b) => a.clientName.localeCompare(b.clientName));
  }, [items, query]);

  return (
    <div className="mx-auto max-w-[1080px] space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[32px] font-bold leading-tight tracking-[-0.03em]">Estoque Editorial</h1>
          <p className="mt-1 text-sm text-muted">
            Acervo permanente das linhas editoriais aprovadas e enviadas — a memória estratégica que a IA usa para
            evoluir a comunicação de cada cliente. Cada cliente tem seu acervo exclusivo.
          </p>
        </div>
        {items && items.length > 0 && (
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar cliente, competência…"
            className="w-64 rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
          />
        )}
      </div>

      {err ? (
        <p className="text-sm text-crit">{err}</p>
      ) : items === null ? (
        <p className="text-sm text-muted">Carregando estoque editorial…</p>
      ) : items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-5 text-sm text-muted">
          Nenhuma linha no estoque ainda. Uma linha entra automaticamente aqui quando é aprovada pelo cliente e
          enviada (mensagem ou documento), dentro do cliente na aba <strong>Linha Editorial</strong>.
        </p>
      ) : groups.length === 0 ? (
        <p className="text-sm text-muted">Nenhum resultado para “{query}”.</p>
      ) : (
        <div className="space-y-8">
          {groups.map((g) => (
            <section key={g.clientId}>
              <div className="mb-3 flex items-baseline justify-between gap-2 border-b border-border pb-2">
                <Link href={`/clients/${g.clientId}`} className="text-lg font-semibold hover:text-brand-strong dark:hover:text-brand">
                  {g.clientName}
                </Link>
                <span className="label-caps text-muted">
                  {g.cards.length} linha(s) · {g.cards.reduce((s, c) => s + c.contentCount, 0)} conteúdo(s)
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {g.cards.map((s) => (
                  <StockCardView key={s.id} s={s} onOpen={() => setOpenId(s.id)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      {openId && <StockDetail strategyId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function StockCardView({ s, onOpen }: { s: StockCard; onOpen: () => void }) {
  return (
    <article className="rounded-xl border border-border bg-elevated p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold">Linha Editorial V{s.version}</p>
          {text(s.positioning) && <p className="truncate text-xs text-muted">{text(s.positioning)}</p>}
        </div>
        <span className="shrink-0 rounded-full bg-ok/15 px-2.5 py-0.5 text-xs font-medium text-ok">Em estoque</span>
      </div>

      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        <Field label="Competência" value={s.competencia ?? "—"} />
        <Field label="Conteúdos" value={String(s.contentCount)} />
        <Field label="Aprovação" value={fmt(s.approvedAt)} />
        <Field label="Envio" value={fmt(s.sentAt)} />
        <Field label="Forma de envio" value={deliveryLabel(s.deliveryMethod)} />
        <Field label="Status" value={statusLabel(s.status)} />
      </dl>

      <button onClick={onOpen} className="mt-3 w-full rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface">
        Ver conteúdo completo
      </button>
    </article>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="label-caps text-muted">{label}</dt>
      <dd className="mt-0.5 font-medium">{value}</dd>
    </div>
  );
}

/** Documento congelado exato — carregado sob demanda. Prefere o snapshot; cai
 * para as linhas ao vivo se a linha entrou no estoque antes do congelamento. */
function StockDetail({ strategyId, onClose }: { strategyId: string; onClose: () => void }) {
  const [data, setData] = useState<any | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setData(null); setErr(null);
    api<any>(`/editorial-strategies/${strategyId}`)
      .then(setData)
      .catch((e) => setErr(e instanceof Error ? e.message : "Erro"));
  }, [strategyId]);

  const lines = data?.contentSnapshot?.lines ?? data?.editorialLines;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-4" onClick={onClose}>
      <div className="my-8 w-full max-w-[860px] rounded-2xl border border-border bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-border pb-3">
          <div>
            <p className="font-semibold">Linha Editorial V{data?.version ?? ""} · documento enviado ao cliente</p>
            <p className="text-xs text-muted">Acervo permanente — exatamente como foi enviado, sem alterações.</p>
          </div>
          <button onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-elevated">Fechar</button>
        </div>
        {err ? <p className="text-sm text-crit">{err}</p> :
          data === null ? <p className="text-sm text-muted">Carregando documento…</p> :
          <EditorialDoc lines={lines} />}
      </div>
    </div>
  );
}

function fmt(iso: string | null): string {
  return iso ? new Date(iso).toLocaleDateString("pt-BR") : "—";
}
function deliveryLabel(m: string | null): string {
  return m === "message" ? "Mensagem" : m === "document" ? "Documento" : "—";
}
function statusLabel(s: string): string {
  return ({ approved: "Aprovada", pending_client: "Aguardando", draft: "Rascunho", changes_requested: "Ajuste" } as Record<string, string>)[s] ?? s;
}
