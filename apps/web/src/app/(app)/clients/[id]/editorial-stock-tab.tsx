"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { text } from "@/lib/render";
import { EditorialDoc } from "@/components/editorial-doc";

interface StockCard {
  id: string;
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

/** Aba ESTOQUE EDITORIAL — acervo permanente de linhas aprovadas + enviadas.
 * Cada card resume a linha; ao abrir, exibe EXATAMENTE o documento congelado
 * enviado ao cliente (snapshot), sem reprocessamento. */
export function EditorialStockTab({ clientId }: { clientId: string }) {
  const [items, setItems] = useState<StockCard[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    setErr(null);
    api<{ items: StockCard[] }>(`/clients/${clientId}/editorial-stock`)
      .then((r) => setItems(r.items))
      .catch((e) => setErr(e instanceof Error ? e.message : "Erro"));
  }, [clientId]);

  if (err) return <p className="text-sm text-crit">{err}</p>;
  if (items === null) return <p className="text-sm text-muted">Carregando estoque editorial…</p>;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-elevated p-4">
        <p className="text-sm font-semibold">Estoque Editorial</p>
        <p className="mt-1 text-xs text-muted">
          Acervo permanente das linhas editoriais aprovadas pelo cliente e enviadas (mensagem ou documento).
          É a memória estratégica da IA: toda nova linha é gerada considerando TODO este histórico.
          {items.length > 0 && ` · ${items.length} linha(s) em estoque · ${items.reduce((s, i) => s + i.contentCount, 0)} conteúdo(s).`}
        </p>
      </div>

      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted">
          Nenhuma linha no estoque ainda. Uma linha entra automaticamente aqui quando é aprovada pelo
          cliente e enviada (na aba Linha Editorial, botão “Enviar ao cliente”).
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {items.map((s) => (
            <StockCardView
              key={s.id}
              s={s}
              open={openId === s.id}
              onToggle={() => setOpenId(openId === s.id ? null : s.id)}
            />
          ))}
        </div>
      )}

      {openId && <StockDetail strategyId={openId} onClose={() => setOpenId(null)} />}
    </div>
  );
}

function StockCardView({ s, open, onToggle }: { s: StockCard; open: boolean; onToggle: () => void }) {
  return (
    <article className={`rounded-xl border bg-elevated p-4 transition-colors ${open ? "border-brand" : "border-border"}`}>
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

      <button
        onClick={onToggle}
        className="mt-3 w-full rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface"
      >
        {open ? "Fechar conteúdo" : "Ver conteúdo completo"}
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
      <div
        className="my-8 w-full max-w-[860px] rounded-2xl border border-border bg-surface p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between gap-3 border-b border-border pb-3">
          <div>
            <p className="font-semibold">
              Linha Editorial V{data?.version ?? ""} · documento enviado ao cliente
            </p>
            <p className="text-xs text-muted">Acervo permanente — exatamente como foi enviado, sem alterações.</p>
          </div>
          <button onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-elevated">
            Fechar
          </button>
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
