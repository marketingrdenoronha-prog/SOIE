"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { arr, text } from "@/lib/render";
import { EditorialThemesEditor } from "@/components/editorial-themes-editor";
import {
  EDITORIAL_FORMATS,
  EMPTY_FORMAT_COUNTS,
  reconcileContentConfigs,
  formatLabel,
  CAROUSEL_MIN_SLIDES,
  CAROUSEL_MAX_SLIDES,
  type FormatCounts,
  type FormatKey,
  type ContentItemConfig,
} from "@/lib/editorial-format";

type Strategy = any;

/** Monta o payload de contentConfigs enviado à API: só formatos com
 * quantidade > 0, cada item com os campos do seu formato. */
function buildContentConfigsPayload(counts: FormatCounts, configs: Record<FormatKey, ContentItemConfig[]>) {
  const theme = (t?: string) => (t && t.trim() ? t.trim() : undefined);
  const out: Record<string, unknown> = {};
  if (counts.video > 0) out.video = configs.video.slice(0, counts.video).map((it) => ({ theme: theme(it.theme), durationSeconds: it.durationSeconds ?? 30 }));
  if (counts.motion > 0) out.motion = configs.motion.slice(0, counts.motion).map((it) => ({ theme: theme(it.theme), durationSeconds: it.durationSeconds ?? 15 }));
  if (counts.carrossel > 0) out.carrossel = configs.carrossel.slice(0, counts.carrossel).map((it) => ({ theme: theme(it.theme), slideCount: it.slideCount ?? 5 }));
  if (counts.estatico > 0) out.estatico = configs.estatico.slice(0, counts.estatico).map((it) => ({ theme: theme(it.theme) }));
  return Object.keys(out).length > 0 ? out : undefined;
}

const FORMAT_PLURAL: Record<FormatKey, string> = { video: "Vídeos", motion: "Motions", carrossel: "Carrosséis", estatico: "Estáticos" };

/** Seção de configuração individual de um formato (referência de UX: o antigo
 * "Telas por carrossel", generalizado). Tema opcional em todos; duração em
 * vídeo/motion; telas em carrossel. */
function FormatConfigSection({ format, items, onChange }: {
  format: FormatKey; items: ContentItemConfig[]; onChange: (format: FormatKey, i: number, patch: Partial<ContentItemConfig>) => void;
}) {
  const singular = formatLabel(format);
  const isDur = format === "video" || format === "motion";
  const isCar = format === "carrossel";
  return (
    <div className="mt-3 rounded-lg border border-border bg-surface p-3">
      <p className="label-caps mb-2 text-muted">Configuração dos {FORMAT_PLURAL[format]}</p>
      <div className="space-y-2">
        {items.map((it, i) => (
          <div key={i} className="rounded-md border border-border bg-elevated p-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium">{singular} {i + 1}</span>
              {isDur && (
                <label className="flex items-center gap-2">
                  <span className="text-xs text-muted">Duração</span>
                  <input
                    type="number" min={1}
                    value={it.durationSeconds ?? (format === "motion" ? 15 : 30)}
                    onChange={(e) => onChange(format, i, { durationSeconds: Math.max(1, Math.round(Number(e.target.value) || 0)) })}
                    className="w-20 rounded-md border border-border bg-surface px-2 py-1.5 text-sm outline-none focus:border-brand"
                  />
                  <span className="text-xs text-muted">seg</span>
                </label>
              )}
              {isCar && (
                <label className="flex items-center gap-2">
                  <span className="text-xs text-muted">Telas</span>
                  <select
                    value={it.slideCount ?? 5}
                    onChange={(e) => onChange(format, i, { slideCount: Number(e.target.value) })}
                    className="rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-brand"
                  >
                    {Array.from({ length: CAROUSEL_MAX_SLIDES - CAROUSEL_MIN_SLIDES + 1 }, (_, k) => CAROUSEL_MIN_SLIDES + k).map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <input
              type="text"
              value={it.theme ?? ""}
              onChange={(e) => onChange(format, i, { theme: e.target.value })}
              placeholder="Tema (opcional) — ex.: Como escolher o produto ideal para… (deixe em branco para a IA definir)"
              className="mt-2 w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-brand"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function EditorialTab({ clientId }: { clientId: string }) {
  const [items, setItems] = useState<Strategy[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [submitBusy, setSubmitBusy] = useState<string | null>(null);
  const [sendBusy, setSendBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [counts, setCounts] = useState<FormatCounts>({ ...EMPTY_FORMAT_COUNTS });
  // Config INDIVIDUAL por conteúdo, por formato (tema + duração/telas).
  const [configs, setConfigs] = useState<Record<FormatKey, ContentItemConfig[]>>({ video: [], motion: [], carrossel: [], estatico: [] });
  const [objective, setObjective] = useState("");
  const [observations, setObservations] = useState("");
  const [momento, setMomento] = useState("");
  const total = counts.video + counts.motion + counts.carrossel + counts.estatico;

  // Reage às quantidades: preserva o que já foi digitado, cria novos com o
  // padrão e remove excedentes — nunca há mais configs que conteúdos.
  useEffect(() => {
    setConfigs((prev) => reconcileContentConfigs(prev, counts));
  }, [counts.video, counts.motion, counts.carrossel, counts.estatico]);

  function setItem(format: FormatKey, i: number, patch: Partial<ContentItemConfig>) {
    setConfigs((prev) => ({ ...prev, [format]: prev[format].map((it, idx) => (idx === i ? { ...it, ...patch } : it)) }));
  }

  async function load() {
    setErr(null);
    try {
      setItems(await api<Strategy[]>(`/clients/${clientId}/editorial-strategies`));
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro");
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [clientId]);

  async function generate() {
    setBusy(true); setErr(null);
    try {
      await api(`/clients/${clientId}/editorial-strategies`, {
        method: "POST",
        body: JSON.stringify({
          formatCounts: counts,
          contentConfigs: buildContentConfigsPayload(counts, configs),
          objective: objective || undefined,
          observations: observations || undefined,
          momento: momento || undefined,
        }),
      });
      setObjective("");
      setObservations("");
      setMomento("");
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro ao gerar linha editorial");
    } finally {
      setBusy(false);
    }
  }

  async function submit(id: string) {
    setSubmitBusy(id); setErr(null);
    try {
      await api(`/editorial-strategies/${id}/submit`, { method: "POST" });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro ao enviar para aprovação");
    } finally {
      setSubmitBusy(null);
    }
  }

  /** Envia a linha APROVADA ao cliente (mensagem/documento) — entra no estoque. */
  async function sendToStock(id: string, method: "message" | "document") {
    setSendBusy(id); setErr(null);
    try {
      await api(`/editorial-strategies/${id}/send`, {
        method: "POST",
        body: JSON.stringify({ method }),
      });
      await load();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro ao enviar ao cliente");
    } finally {
      setSendBusy(null);
    }
  }

  const latest = items?.[0];

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-border bg-elevated p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">Nova versão da linha editorial</p>
            <p className="mt-1 text-xs text-muted">
              Escolha a quantidade de cada formato. Cada conteúdo sai pronto para produção
              (tema, objetivo, gancho, copy completa, CTA e observações) — o Designer/Filmaker só executa.
            </p>
          </div>
          {latest && (
            <span className="rounded-full bg-border/60 px-2.5 py-0.5 text-xs text-muted">
              Última: V{latest.version} · {labelStatus(latest.status)}
            </span>
          )}
        </div>

        <div className="mt-3">
          <p className="label-caps mb-1 text-muted">Quantidade por formato</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {EDITORIAL_FORMATS.map((f) => (
              <label key={f.key} className="block">
                <span className="text-xs font-medium text-muted">{f.label}</span>
                <input
                  type="number" min={0} max={50}
                  value={counts[f.key]}
                  onChange={(e) => setCounts((c) => ({ ...c, [f.key]: Math.max(0, Math.min(50, Number(e.target.value) || 0)) }))}
                  className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
                />
              </label>
            ))}
          </div>
          <p className="mt-1 text-[11px] text-muted">Total: {total} conteúdo(s){total === 0 ? " — deixe zerado para uma distribuição sugerida." : ""}</p>
        </div>

        {EDITORIAL_FORMATS.filter((f) => counts[f.key] > 0).map((f) => (
          <FormatConfigSection key={f.key} format={f.key} items={configs[f.key].slice(0, counts[f.key])} onChange={setItem} />
        ))}

        <label className="mt-3 block">
          <span className="text-xs font-medium text-muted">Objetivo da linha editorial (opcional)</span>
          <input
            value={objective}
            onChange={(e) => setObjective(e.target.value)}
            placeholder="Ex.: gerar autoridade e agendar avaliações; aquecer para a Black Friday…"
            className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
          />
        </label>
        <label className="mt-3 block">
          <span className="text-xs font-medium text-muted">Momento / atualidade para os ganchos de vídeo (opcional)</span>
          <input
            value={momento}
            onChange={(e) => setMomento(e.target.value)}
            placeholder="Ex.: Copa do Mundo, BBB, Black Friday, volta às aulas — a IA usa isso p/ criar o gancho (newsjacking) nos vídeos."
            className="mt-1 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-brand"
          />
        </label>
        <label className="mt-3 block">
          <span className="text-xs font-medium text-muted">Observações (opcional)</span>
          <textarea
            value={observations}
            onChange={(e) => setObservations(e.target.value)}
            rows={2}
            placeholder="Direção adicional (ex.: focar em prova social, evitar repetir temas anteriores, tom mais direto…)."
            className="mt-1 w-full resize-none rounded-lg border border-border bg-surface p-3 text-sm outline-none focus:border-brand"
          />
        </label>

        <div className="mt-3 flex items-center justify-between">
          {err ? <p className="text-sm text-crit">{err}</p> : <span />}
          <button
            onClick={generate}
            disabled={busy}
            className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-50 dark:text-[#00390d]"
          >
            {busy ? "Gerando…" : latest ? `Gerar V${(latest.version ?? 0) + 1}` : "Gerar V1"}
          </button>
        </div>
      </div>

      {items === null ? (
        <p className="text-sm text-muted">Carregando linhas editoriais…</p>
      ) : items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted">
          Nenhuma linha editorial ainda. Gere a primeira versão para enviar ao cliente.
        </p>
      ) : (
        <div className="space-y-4">
          {items.map((s) => (
            <StrategyCard
              key={s.id}
              s={s}
              submitBusy={submitBusy === s.id}
              sendBusy={sendBusy === s.id}
              onSubmit={() => submit(s.id)}
              onSendToStock={(method) => sendToStock(s.id, method)}
              onReload={load}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StrategyCard({ s, submitBusy, sendBusy, onSubmit, onSendToStock, onReload }: {
  s: any; submitBusy: boolean; sendBusy: boolean; onSubmit: () => void; onSendToStock: (method: "message" | "document") => void; onReload: () => Promise<void> | void;
}) {
  const [copied, setCopied] = useState(false);
  const openLink = s.reviewLinks?.find((l: any) => l.status === "open") ?? s.reviewLinks?.[0];
  const reviewUrl = openLink && typeof window !== "undefined" ? `${window.location.origin}/editorial-review/${openLink.token}` : null;
  const requested = s.reviewComments?.filter((c: any) => c.decision === "request_changes") ?? [];

  return (
    <article className="rounded-xl border border-border bg-elevated p-5">
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        <p className="font-semibold">Linha Editorial V{s.version}</p>
        <StatusBadge status={s.status} />
        {s.inStock && <span className="rounded-full bg-ok/15 px-2 py-0.5 text-xs font-medium text-ok">No estoque</span>}
        {s.approvedAt && <span className="text-xs text-muted">aprovada em {new Date(s.approvedAt).toLocaleDateString("pt-BR")}</span>}
        <div className="ml-auto flex flex-wrap gap-2">
          {reviewUrl && (
            <>
              <a href={reviewUrl} target="_blank" className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface">
                Abrir link ↗
              </a>
              <button
                onClick={() => { navigator.clipboard.writeText(reviewUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface"
              >
                {copied ? "Copiado!" : "Copiar link"}
              </button>
            </>
          )}
          {s.status !== "approved" ? (
            <button
              onClick={onSubmit}
              disabled={submitBusy}
              className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-strong disabled:opacity-50 dark:text-[#00390d]"
            >
              {submitBusy ? "Enviando…" : s.status === "draft" ? "Enviar para Cliente" : "Reenviar"}
            </button>
          ) : (
            // Linha aprovada: envio final ao cliente (mensagem/documento) → arquiva no Estoque Editorial.
            <>
              <button
                onClick={() => onSendToStock("message")}
                disabled={sendBusy}
                className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-strong disabled:opacity-50 dark:text-[#00390d]"
              >
                {sendBusy ? "Enviando…" : s.inStock ? "Reenviar por mensagem" : "Enviar por mensagem"}
              </button>
              <button
                onClick={() => onSendToStock("document")}
                disabled={sendBusy}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface disabled:opacity-50"
              >
                {sendBusy ? "Enviando…" : s.inStock ? "Reenviar por documento" : "Enviar por documento"}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mt-4 space-y-4">
        {text(s.positioning) && (
          <div>
            <p className="label-caps text-muted">Posicionamento</p>
            <p className="mt-1 text-sm">{text(s.positioning)}</p>
          </div>
        )}
        {arr(s.pillars).length > 0 && (
          <div>
            <p className="label-caps text-muted">Pilares</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {arr(s.pillars).map((p: unknown, i: number) => <span key={i} className="rounded-md bg-brand/10 px-2 py-0.5 text-xs text-brand">{text(p)}</span>)}
            </div>
          </div>
        )}
        {requested.length > 0 && (
          <div className="rounded-lg border border-warn/40 bg-warn/10 p-3">
            <p className="text-xs font-semibold text-warn">Feedback do cliente</p>
            <ul className="mt-1 space-y-1 text-sm">
              {requested.map((c: any) => <li key={c.id}>“{text(c.comment)}”</li>)}
            </ul>
          </div>
        )}
        <div>
          <p className="label-caps mb-2 text-muted">Conteúdos propostos</p>
          <EditorialThemesEditor
            strategyId={s.id}
            lines={s.editorialLines}
            editable={s.status !== "approved"}
            onChanged={onReload}
          />
        </div>
      </div>
    </article>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    draft: ["Rascunho", "bg-border/60 text-muted"],
    pending_client: ["Aguardando cliente", "bg-warn/15 text-warn"],
    approved: ["Aprovada", "bg-ok/15 text-ok"],
    changes_requested: ["Ajuste pedido", "bg-crit/15 text-crit"],
  };
  const [label, cls] = map[status] ?? [status, "bg-border/60 text-muted"];
  return <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}
function labelStatus(status: string) {
  return ({ draft: "rascunho", pending_client: "aguardando", approved: "aprovada", changes_requested: "ajuste" } as Record<string, string>)[status] ?? status;
}
