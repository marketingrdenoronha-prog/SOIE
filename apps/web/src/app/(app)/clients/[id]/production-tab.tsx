"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ThemeContent } from "@/components/editorial-doc";
import { ErrorBoundary } from "@/components/error-boundary";

/* eslint-disable @typescript-eslint/no-explicit-any */

const COLS: Array<{ s: string; l: string }> = [
  { s: "aguardando", l: "Aguardando Produção" },
  { s: "em_producao", l: "Em Produção" },
  { s: "produzida", l: "Produzida" },
  { s: "aprovada_interna", l: "Aprovada (interna)" },
  { s: "aprovacao_cliente", l: "Com o cliente" },
  { s: "aprovada", l: "Aprovada" },
];
const STAGE_LABEL: Record<string, string> = {
  design: "Designer / Audiovisual",
  final_review: "Em Aprovação Final",
  to_post: "A Postar",
};

export function ProductionTab({ clientId }: { clientId: string }) {
  const [strategies, setStrategies] = useState<any[] | null>(null);
  const [pieces, setPieces] = useState<any[] | null>(null);
  const [sel, setSel] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setErr(null);
    try {
      const [st, dv] = await Promise.all([
        api<any[]>(`/clients/${clientId}/editorial-strategies`),
        api<any[]>(`/clients/${clientId}/deliverables`),
      ]);
      setStrategies(st);
      setPieces(dv);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [clientId]);

  const approved = strategies?.find((s) => s.status === "approved");
  const portalToken = approved?.productionPortalToken as string | undefined;
  const portalUrl = portalToken && typeof window !== "undefined" ? `${window.location.origin}/producao/${portalToken}` : null;

  async function startProduction() {
    if (!approved) return;
    setBusy(true); setErr(null);
    try {
      await api(`/editorial-strategies/${approved.id}/start-production`, { method: "POST" });
      await load();
    } catch (e) { setErr(e instanceof Error ? e.message : "Erro"); } finally { setBusy(false); }
  }

  if (strategies === null || pieces === null) return <p className="text-sm text-muted">Carregando produção…</p>;

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-elevated p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">
              Produção {approved?.productionStage ? `· ${STAGE_LABEL[approved.productionStage] ?? approved.productionStage}` : ""}
            </p>
            <p className="mt-1 text-xs text-muted">
              {approved
                ? "Após a aprovação da linha, cada conteúdo vira uma peça. Produza, revise internamente e envie ao cliente para aprovação peça por peça."
                : "Aprove uma linha editorial para iniciar a produção."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {approved && pieces.length === 0 && (
              <button onClick={startProduction} disabled={busy} className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-50 dark:text-[#00390d]">
                {busy ? "Criando peças…" : "Iniciar produção"}
              </button>
            )}
            {portalUrl && (
              <CopyBtn url={portalUrl} label="Copiar link do portal do cliente" />
            )}
          </div>
        </div>
        {err && <p className="mt-2 text-sm text-crit">{err}</p>}
      </div>

      {approved?.productionStage === "to_post" && <APostar pieces={pieces} strategy={approved} />}

      <div className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {COLS.map((col) => {
          const items = pieces.filter((d) => (d.productionStatus ?? "aguardando") === col.s);
          if (items.length === 0) return null;
          return (
            <section key={col.s} className="rounded-xl border border-border bg-elevated p-3">
              <p className="mb-2 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted">
                {col.l}<span className="rounded-full bg-border/60 px-2 py-0.5 text-[11px]">{items.length}</span>
              </p>
              <div className="space-y-2">
                {items.map((d) => (
                  <button key={d.id} onClick={() => setSel(d.id)} className={`block w-full rounded-lg border p-3 text-left hover:border-brand ${sel === d.id ? "border-brand" : "border-border"} bg-surface`}>
                    <p className="text-sm font-medium">{d.title}</p>
                    <p className="mt-0.5 text-xs text-muted">{d.channel} · {d.type}</p>
                  </button>
                ))}
              </div>
            </section>
          );
        })}
        {pieces.length === 0 && (
          <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted lg:col-span-2 xl:col-span-3">
            Nenhuma peça ainda. Assim que a linha for aprovada pelo cliente, as peças são criadas automaticamente.
          </p>
        )}
      </div>

      {sel && <PiecePanel id={sel} onClose={() => setSel(null)} onChanged={load} />}
    </div>
  );
}

function PiecePanel({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged: () => void }) {
  const [data, setData] = useState<any | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [comment, setComment] = useState("");
  const [assetUrl, setAssetUrl] = useState("");
  const [assetName, setAssetName] = useState("");
  const [assetKind, setAssetKind] = useState("link");

  async function load() {
    setErr(null);
    try { setData((await api<{ piece: any }>(`/deliverables/${id}/production`)).piece); }
    catch (e) { setErr(e instanceof Error ? e.message : "Erro"); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [id]);

  async function act(action: string, extra?: any) {
    setBusy(true); setErr(null);
    try {
      await api(`/deliverables/${id}/production-status`, { method: "POST", body: JSON.stringify({ action, ...extra }) });
      setNote(""); await load(); onChanged();
    } catch (e) { setErr(e instanceof Error ? e.message : "Erro"); } finally { setBusy(false); }
  }
  async function addComment() {
    if (!comment.trim()) return;
    setBusy(true); setErr(null);
    try { await api(`/deliverables/${id}/comments`, { method: "POST", body: JSON.stringify({ body: comment }) }); setComment(""); await load(); }
    catch (e) { setErr(e instanceof Error ? e.message : "Erro"); } finally { setBusy(false); }
  }
  async function addAsset() {
    if (!assetUrl.trim()) return;
    setBusy(true); setErr(null);
    try {
      await api(`/deliverables/${id}/assets`, { method: "POST", body: JSON.stringify({ url: assetUrl, name: assetName || undefined, kind: assetKind }) });
      setAssetUrl(""); setAssetName(""); await load(); onChanged();
    } catch (e) { setErr(e instanceof Error ? e.message : "Erro"); } finally { setBusy(false); }
  }

  const st = data?.productionStatus;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-auto bg-black/40 p-4" onClick={onClose}>
      <div className="my-8 w-full max-w-[820px] rounded-2xl border border-border bg-surface p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        {!data ? <p className="text-sm text-muted">Carregando…</p> : (
          <>
            <div className="mb-3 flex items-start justify-between gap-3 border-b border-border pb-3">
              <div>
                <p className="font-semibold">{data.title}</p>
                <p className="text-xs text-muted">{data.channel} · {data.type} · {COLS.find((c) => c.s === st)?.l ?? st}{data.assignedName ? ` · ${data.assignedName}` : ""}</p>
              </div>
              <button onClick={onClose} className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-elevated">Fechar</button>
            </div>
            {err && <p className="mb-2 text-sm text-crit">{err}</p>}

            {/* Ações por status */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              {st === "aguardando" && <Btn onClick={() => act("start")} busy={busy}>Iniciar produção</Btn>}
              {st === "em_producao" && <Btn onClick={() => act("produced")} busy={busy}>Marcar produzida</Btn>}
              {st === "produzida" && <>
                <Btn onClick={() => act("approve_internal")} busy={busy}>Aprovar (revisão interna)</Btn>
                <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Motivo do ajuste" className="rounded-lg border border-border bg-elevated px-3 py-1.5 text-sm outline-none focus:border-brand" />
                <button onClick={() => act("reject_internal", { note })} disabled={busy || !note.trim()} className="rounded-md border border-crit/50 px-3 py-1.5 text-xs font-medium text-crit hover:bg-crit/5 disabled:opacity-50">Reprovar → produção</button>
              </>}
              {st === "aprovada_interna" && <span className="text-xs text-muted">Aguardando abertura do portal do cliente (quando todas as peças passarem na revisão interna).</span>}
              {st === "aprovacao_cliente" && <span className="text-xs text-warn">Enviada ao cliente — aguardando aprovação no portal.</span>}
              {st === "aprovada" && <span className="text-xs text-ok">Aprovada pelo cliente.</span>}
              {st === "em_producao" && <span className="text-[11px] text-muted">Reaberta para ajuste.</span>}
            </div>

            {/* Arquivos versionados */}
            <Section title="Arquivos enviados (versões)">
              {data.assets.length === 0 ? <p className="text-xs text-muted">Nenhum arquivo. Cole o link do arquivo (Drive, WeTransfer, YouTube, imagem…).</p> : (
                <div className="space-y-1.5">
                  {data.assets.map((a: any) => (
                    <div key={a.id} className="flex items-center gap-2 text-sm">
                      <span className="rounded bg-border/60 px-1.5 py-0.5 text-[10px] font-semibold">v{a.version}</span>
                      <a href={a.url} target="_blank" rel="noreferrer" className="truncate text-brand-strong hover:underline dark:text-brand">{a.name || a.url}</a>
                      <span className="text-[10px] text-muted">{a.kind}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <input value={assetUrl} onChange={(e) => setAssetUrl(e.target.value)} placeholder="Link do arquivo (https://…)" className="min-w-[220px] flex-1 rounded-lg border border-border bg-elevated px-3 py-1.5 text-sm outline-none focus:border-brand" />
                <input value={assetName} onChange={(e) => setAssetName(e.target.value)} placeholder="Nome (opcional)" className="w-40 rounded-lg border border-border bg-elevated px-3 py-1.5 text-sm outline-none focus:border-brand" />
                <select value={assetKind} onChange={(e) => setAssetKind(e.target.value)} className="rounded-lg border border-border bg-elevated px-2 py-1.5 text-sm">
                  <option value="link">Link</option><option value="image">Imagem</option><option value="video">Vídeo</option><option value="file">Arquivo</option>
                </select>
                <button onClick={addAsset} disabled={busy || !assetUrl.trim()} className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50 dark:text-[#00390d]">Enviar (nova versão)</button>
              </div>
            </Section>

            {/* Comentários */}
            <Section title="Comentários (CS · Designer · Audiovisual)">
              {data.threadComments.length === 0 ? <p className="text-xs text-muted">Sem comentários ainda.</p> : (
                <div className="space-y-1.5">
                  {data.threadComments.map((c: any) => (
                    <div key={c.id} className="rounded-md border border-border bg-elevated p-2 text-sm">
                      <p className="text-[11px] text-muted">{c.authorName ?? "—"}{c.role ? ` · ${c.role}` : ""} · {new Date(c.createdAt).toLocaleString("pt-BR")}</p>
                      <p>{c.body}</p>
                    </div>
                  ))}
                </div>
              )}
              <div className="mt-2 flex items-center gap-2">
                <input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Escrever comentário…" className="flex-1 rounded-lg border border-border bg-elevated px-3 py-1.5 text-sm outline-none focus:border-brand" />
                <button onClick={addComment} disabled={busy || !comment.trim()} className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-elevated disabled:opacity-50">Comentar</button>
              </div>
              {data.comments?.filter((c: any) => c.decision === "request_changes").length > 0 && (
                <div className="mt-2 rounded-md border border-warn/40 bg-warn/10 p-2">
                  <p className="text-[11px] font-semibold text-warn">Ajustes pedidos (decisão)</p>
                  {data.comments.filter((c: any) => c.decision === "request_changes").map((c: any) => (
                    <p key={c.id} className="text-xs">“{c.comment}” — {c.authorName}</p>
                  ))}
                </div>
              )}
            </Section>

            {/* Conteúdo/roteiro */}
            <Section title="Conteúdo / roteiro">
              <ErrorBoundary><ThemeContent theme={data.spec} /></ErrorBoundary>
            </Section>

            {/* Histórico */}
            <Section title="Histórico">
              <div className="space-y-1">
                {(data.history ?? []).slice().reverse().map((h: any, i: number) => (
                  <p key={i} className="text-[11px] text-muted">
                    {new Date(h.at).toLocaleString("pt-BR")} · {h.type}{h.to ? ` → ${h.to}` : ""}{h.byName ? ` · ${h.byName}` : ""}{h.note ? ` · ${h.note}` : ""}
                  </p>
                ))}
              </div>
            </Section>
          </>
        )}
      </div>
    </div>
  );
}

function APostar({ pieces, strategy }: { pieces: any[]; strategy: any }) {
  return (
    <div className="rounded-xl border border-ok/40 bg-ok/5 p-4">
      <p className="text-sm font-semibold text-ok">A Postar — V{strategy.version}</p>
      <p className="mt-1 text-xs text-muted">Todas as peças foram aprovadas pelo cliente. Arquivos finais, legendas e ordem de publicação:</p>
      <ol className="mt-2 space-y-2">
        {pieces.map((d, i) => (
          <li key={d.id} className="rounded-lg border border-border bg-elevated p-3">
            <p className="text-sm font-medium"><span className="text-muted">#{String(i + 1).padStart(2, "0")}</span> {d.title}</p>
            <p className="text-xs text-muted">{d.channel} · {d.type}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-4 border-t border-border pt-3">
      <p className="label-caps mb-2 text-muted">{title}</p>
      {children}
    </section>
  );
}
function Btn({ onClick, busy, children }: { onClick: () => void; busy: boolean; children: React.ReactNode }) {
  return <button onClick={onClick} disabled={busy} className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-strong disabled:opacity-50 dark:text-[#00390d]">{children}</button>;
}
function CopyBtn({ url, label }: { url: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="rounded-md border border-border px-3 py-2 text-xs font-medium hover:bg-surface">
      {copied ? "Copiado!" : label}
    </button>
  );
}
