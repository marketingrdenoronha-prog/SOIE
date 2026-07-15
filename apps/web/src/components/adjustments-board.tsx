"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Comment {
  comment: string | null;
  authorName: string | null;
  createdAt: string;
}
interface EditorialAdj {
  strategyId: string;
  version: number;
  positioning: string | null;
  clientId: string | null;
  clientName: string;
  changesRequestedAt: string | null;
  comments: Comment[];
}
interface MaterialAdj {
  deliverableId: string;
  title: string;
  channel: string;
  type: string;
  productionStatus: string;
  clientId: string | null;
  clientName: string;
  comments: Comment[];
}
interface Data { editorial: EditorialAdj[]; materials: MaterialAdj[] }

function dt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/**
 * Board de ALTERAÇÕES pedidas pelo cliente — duas colunas separadas: Linha
 * Editorial (com ajuste manual/IA) e Materiais (o Designer refaz na esteira).
 * Reutilizado na página /adjustments e embutido dentro da aba Produção.
 */
export function AdjustmentsBoard() {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setErr(null);
    try { setData(await api<Data>("/adjustments")); }
    catch (e) { setErr(e instanceof Error ? e.message : "Erro"); }
  }
  useEffect(() => { load(); }, []);

  if (err) return <p className="text-sm text-crit">{err}</p>;
  if (data === null) return <p className="text-sm text-muted">Carregando alterações…</p>;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted">
          Alteração da Linha Editorial
          <span className="rounded-full bg-border/60 px-2 py-0.5 text-[11px] normal-case tracking-normal">{data.editorial.length}</span>
        </h2>
        {data.editorial.length === 0
          ? <Empty label="Nenhuma alteração de linha editorial pendente." />
          : data.editorial.map((e) => <EditorialCard key={e.strategyId} item={e} />)}
      </section>

      <section className="space-y-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted">
          Alteração de Materiais
          <span className="rounded-full bg-border/60 px-2 py-0.5 text-[11px] normal-case tracking-normal">{data.materials.length}</span>
        </h2>
        {data.materials.length === 0
          ? <Empty label="Nenhuma alteração de material pendente." />
          : data.materials.map((m) => <MaterialCard key={m.deliverableId} item={m} onChanged={load} />)}
      </section>
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted">{label}</p>;
}

function CommentList({ comments }: { comments: Comment[] }) {
  if (comments.length === 0) return <p className="text-xs text-muted">O cliente não deixou comentário escrito.</p>;
  return (
    <div className="space-y-1.5">
      {comments.map((c, i) => (
        <div key={i} className="rounded-md border border-warn/30 bg-warn/5 px-2.5 py-1.5">
          <p className="text-xs">{c.comment}</p>
          <p className="mt-0.5 text-[10px] text-muted">{c.authorName ?? "Cliente"} · {dt(c.createdAt)}</p>
        </div>
      ))}
    </div>
  );
}

function EditorialCard({ item }: { item: EditorialAdj }) {
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [busy, setBusy] = useState<null | "summary" | "apply">(null);
  const [err, setErr] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ understood: string; plan: string[]; _demo?: boolean } | null>(null);
  const [guidance, setGuidance] = useState("");
  const [applied, setApplied] = useState<{ version: number; demo: boolean } | null>(null);

  async function runSummary() {
    setBusy("summary"); setErr(null);
    try {
      const s = await api<{ understood: string; plan: string[]; _demo?: boolean }>(
        `/editorial-strategies/${item.strategyId}/adjust`,
        { method: "POST", body: JSON.stringify({ mode: "summary" }) },
      );
      setSummary(s);
    } catch (e) { setErr(e instanceof Error ? e.message : "Erro ao resumir"); }
    finally { setBusy(null); }
  }

  async function apply(kind: "auto" | "manual") {
    if (kind === "manual" && !guidance.trim()) { setErr("Descreva o que ajustar."); return; }
    setBusy("apply"); setErr(null);
    try {
      const r = await api<{ version: number; demo: boolean }>(
        `/editorial-strategies/${item.strategyId}/adjust`,
        { method: "POST", body: JSON.stringify({ mode: kind, guidance: kind === "manual" ? guidance : undefined }) },
      );
      // Mantém o card com o estado de sucesso (não recarrega agora, senão a nova
      // versão faz este item sumir e o operador perde o link "revisar/enviar").
      setApplied({ version: r.version, demo: r.demo });
    } catch (e) { setErr(e instanceof Error ? e.message : "Erro ao gerar nova versão"); }
    finally { setBusy(null); }
  }

  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold">
            {item.clientId ? <Link href={`/clients/${item.clientId}`} className="hover:text-brand">{item.clientName}</Link> : item.clientName}
          </p>
          <p className="text-xs text-muted">Linha editorial V{item.version} · pedido em {dt(item.changesRequestedAt)}</p>
        </div>
        <span className="shrink-0 rounded-full bg-warn/15 px-2 py-0.5 text-[11px] text-warn">Alteração pedida</span>
      </div>

      <div>
        <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted">O que o cliente pediu</p>
        <CommentList comments={item.comments} />
      </div>

      {applied ? (
        <div className="rounded-lg border border-ok/40 bg-ok/10 p-3 text-sm">
          <p className="font-medium text-ok">✓ Nova versão V{applied.version} gerada.</p>
          {applied.demo && <p className="mt-1 text-xs text-warn">Gerada em modo demo (configure uma chave de IA para conteúdo real).</p>}
          {item.clientId && (
            <Link href={`/clients/${item.clientId}`} className="mt-2 inline-block rounded-md border border-border px-3 py-1.5 text-xs hover:bg-elevated">
              Revisar e enviar ao cliente →
            </Link>
          )}
        </div>
      ) : (
        <>
          <div className="flex gap-1.5">
            {(["auto", "manual"] as const).map((m) => (
              <button key={m} onClick={() => setMode(m)}
                className={`rounded-md border px-2.5 py-1 text-xs ${mode === m ? "border-brand bg-brand/10 font-semibold text-brand-strong dark:text-brand" : "border-border hover:bg-elevated"}`}>
                {m === "auto" ? "Automático (IA)" : "Manual"}
              </button>
            ))}
          </div>

          {mode === "auto" ? (
            <div className="space-y-2">
              {!summary ? (
                <button onClick={runSummary} disabled={busy !== null}
                  className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-elevated disabled:opacity-50">
                  {busy === "summary" ? "Resumindo…" : "Resumir com IA (o que entendi + o que faria)"}
                </button>
              ) : (
                <div className="space-y-2 rounded-lg border border-border bg-elevated/50 p-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">O que a IA entendeu</p>
                    <p className="mt-0.5 text-sm">{summary.understood}</p>
                  </div>
                  {summary.plan.length > 0 && (
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">O que a IA faria</p>
                      <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-sm">
                        {summary.plan.map((p, i) => <li key={i}>{p}</li>)}
                      </ul>
                    </div>
                  )}
                  {summary._demo && <p className="text-xs text-warn">Resumo em modo demo (sem chave de IA).</p>}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button onClick={() => apply("auto")} disabled={busy !== null}
                      className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-strong disabled:opacity-50 dark:text-[#00390d]">
                      {busy === "apply" ? "Reajustando…" : "Acionar IA para reajustar →"}
                    </button>
                    <button onClick={runSummary} disabled={busy !== null}
                      className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-surface disabled:opacity-50">
                      Resumir de novo
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <textarea
                value={guidance}
                onChange={(e) => setGuidance(e.target.value)}
                rows={3}
                placeholder="Direção do ajuste (ex.: trocar o tom para mais técnico, focar em objeção de preço, remover tema X…)"
                className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-brand"
              />
              <button onClick={() => apply("manual")} disabled={busy !== null}
                className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-strong disabled:opacity-50 dark:text-[#00390d]">
                {busy === "apply" ? "Gerando…" : "Gerar nova versão com esta direção →"}
              </button>
            </div>
          )}
        </>
      )}

      {err && <p className="text-xs text-crit">{err}</p>}
    </div>
  );
}

function MaterialCard({ item, onChanged }: { item: MaterialAdj; onChanged: () => Promise<void> | void }) {
  return (
    <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{item.title}</p>
          <p className="text-xs text-muted">
            {item.clientId ? <Link href={`/clients/${item.clientId}`} className="hover:text-brand">{item.clientName}</Link> : item.clientName}
            {" · "}{item.channel}/{item.type}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-warn/15 px-2 py-0.5 text-[11px] text-warn">Alteração pedida</span>
      </div>

      <div>
        <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted">O que o cliente pediu</p>
        <CommentList comments={item.comments} />
      </div>

      <p className="rounded-md border border-border bg-elevated/50 px-2.5 py-1.5 text-xs text-muted">
        Material pronto volta para o Designer refazer a arte/vídeo na esteira. Sem reescrita por IA aqui.
      </p>

      <div className="flex flex-wrap gap-2">
        <Link href="/production" className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-strong dark:text-[#00390d]">
          Abrir na Produção →
        </Link>
        {item.clientId && (
          <Link href={`/clients/${item.clientId}`} className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-elevated">
            Abrir cliente
          </Link>
        )}
        <button onClick={() => onChanged()} className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-elevated">
          Atualizar
        </button>
      </div>
    </div>
  );
}
