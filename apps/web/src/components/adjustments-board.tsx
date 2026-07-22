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
interface HistoryEntry {
  version: number;
  comment: string | null;
  authorName: string | null;
  createdAt: string;
}
interface EditorialAdj {
  strategyId: string;
  version: number;
  latestVersion: number;
  positioning: string | null;
  clientId: string | null;
  clientName: string;
  changesRequestedAt: string | null;
  comments: Comment[];
  history: HistoryEntry[];
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

/** Histórico completo de ajustes do cliente, em todas as versões — para que
 * nenhum pedido se perca quando uma nova versão é gerada. Recolhível. */
function HistoryBlock({ history, liveVersion }: { history: HistoryEntry[]; liveVersion: number }) {
  const [open, setOpen] = useState(false);
  if (history.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-elevated/40">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-muted hover:text-foreground"
      >
        <span>Histórico de ajustes deste cliente ({history.length})</span>
        <span className="text-sm">{open ? "−" : "+"}</span>
      </button>
      {open && (
        <ul className="space-y-1.5 border-t border-border px-3 py-2">
          {history.map((h, i) => (
            <li key={i} className="rounded-md border border-border bg-surface px-2.5 py-1.5">
              <div className="flex items-center gap-2">
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${h.version === liveVersion ? "bg-warn/15 text-warn" : "bg-border/60 text-muted"}`}>V{h.version}</span>
                <span className="text-[10px] text-muted">{h.authorName ?? "Cliente"} · {dt(h.createdAt)}</span>
              </div>
              {h.comment && <p className="mt-1 text-xs">{h.comment}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface QGroup { topic: string; questions: string[] }

function EditorialCard({ item }: { item: EditorialAdj }) {
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [busy, setBusy] = useState<null | "questions" | "apply">(null);
  const [err, setErr] = useState<string | null>(null);
  const [questions, setQuestions] = useState<QGroup[] | null>(null);
  const [qDemo, setQDemo] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [guidance, setGuidance] = useState("");
  const [applied, setApplied] = useState<{ version: number; demo: boolean } | null>(null);

  async function runQuestions() {
    setBusy("questions"); setErr(null);
    try {
      const r = await api<{ items: QGroup[]; _demo?: boolean }>(
        `/editorial-strategies/${item.strategyId}/adjust`,
        { method: "POST", body: JSON.stringify({ mode: "questions" }) },
      );
      setQuestions(r.items ?? []);
      setQDemo(Boolean(r._demo));
    } catch (e) { setErr(e instanceof Error ? e.message : "Erro ao gerar perguntas"); }
    finally { setBusy(null); }
  }

  async function apply(kind: "auto" | "manual") {
    if (kind === "manual" && !guidance.trim()) { setErr("Descreva o que ajustar."); return; }
    setBusy("apply"); setErr(null);
    try {
      // No auto, junta as respostas que a equipe anotou ao perguntar ao cliente.
      const collected =
        kind === "auto"
          ? (questions ?? []).flatMap((g, gi) =>
              g.questions.map((q, qi) => ({ question: q, answer: (answers[`${gi}-${qi}`] ?? "").trim() })),
            ).filter((a) => a.answer)
          : undefined;
      const r = await api<{ version: number; demo: boolean }>(
        `/editorial-strategies/${item.strategyId}/adjust`,
        {
          method: "POST",
          body: JSON.stringify({
            mode: kind,
            guidance: kind === "manual" ? guidance : undefined,
            answers: collected && collected.length ? collected : undefined,
          }),
        },
      );
      // Mantém o card com o estado de sucesso (não recarrega agora, senão a nova
      // versão faz este item sumir e o operador perde o link "revisar/enviar").
      setApplied({ version: r.version, demo: r.demo });
    } catch (e) { setErr(e instanceof Error ? e.message : "Erro ao gerar nova versão"); }
    finally { setBusy(null); }
  }

  const answeredCount = Object.values(answers).filter((v) => v.trim()).length;

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
        <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted">O que o cliente pediu (V{item.version})</p>
        <CommentList comments={item.comments} />
      </div>

      <HistoryBlock history={item.history} liveVersion={item.version} />

      {applied || item.latestVersion > item.version ? (
        <div className="rounded-lg border border-ok/40 bg-ok/10 p-3 text-sm">
          <p className="font-medium text-ok">✓ Nova versão V{applied?.version ?? item.latestVersion} já gerada.</p>
          {applied?.demo && <p className="mt-1 text-xs text-warn">Gerada em modo demo (configure uma chave de IA para conteúdo real).</p>}
          {!applied && (
            <p className="mt-1 text-xs text-muted">O ajuste desta versão já foi atendido — revise e envie a nova versão ao cliente.</p>
          )}
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
              {!questions ? (
                <>
                  <button onClick={runQuestions} disabled={busy !== null}
                    className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-elevated disabled:opacity-50">
                    {busy === "questions" ? "Analisando os ajustes…" : "Gerar perguntas de esclarecimento (IA)"}
                  </button>
                  <p className="text-[11px] text-muted">A IA lê todos os ajustes juntos, identifica cada um e monta perguntas específicas para a equipe fazer ao cliente.</p>
                </>
              ) : (
                <div className="space-y-3 rounded-lg border border-border bg-elevated/50 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-muted">Perguntas para o cliente — anote as respostas</p>
                    <button onClick={runQuestions} disabled={busy !== null}
                      className="rounded-md border border-border px-2 py-0.5 text-[11px] hover:bg-surface disabled:opacity-50">
                      Gerar de novo
                    </button>
                  </div>
                  {qDemo && <p className="text-xs text-warn">Perguntas em modo demo (sem chave de IA).</p>}
                  {questions.length === 0 && <p className="text-xs text-muted">A IA não encontrou pontos a esclarecer.</p>}
                  {questions.map((g, gi) => (
                    <div key={gi} className="space-y-1.5 rounded-md border border-border bg-surface p-2.5">
                      <p className="text-xs font-semibold">{g.topic}</p>
                      {g.questions.map((q, qi) => (
                        <div key={qi} className="space-y-1">
                          <p className="text-xs text-muted">{q}</p>
                          <textarea
                            value={answers[`${gi}-${qi}`] ?? ""}
                            onChange={(e) => setAnswers((a) => ({ ...a, [`${gi}-${qi}`]: e.target.value }))}
                            rows={2}
                            placeholder="Resposta do cliente…"
                            className="w-full rounded-md border border-border bg-elevated px-2 py-1.5 text-xs outline-none focus:border-brand"
                          />
                        </div>
                      ))}
                    </div>
                  ))}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button onClick={() => apply("auto")} disabled={busy !== null}
                      className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-strong disabled:opacity-50 dark:text-[#00390d]">
                      {busy === "apply" ? "Reajustando…" : "Reajustar com as respostas →"}
                    </button>
                    <span className="text-[11px] text-muted">{answeredCount} resposta(s) preenchida(s)</span>
                  </div>
                  <p className="text-[11px] text-muted">Pode reajustar mesmo sem responder tudo — a IA usa o que houver + os pedidos do cliente.</p>
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
