"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { SpecView } from "@/components/spec-view";
import { ErrorBoundary } from "@/components/error-boundary";

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Piece {
  id: string;
  title: string;
  channel: string | null;
  format: string | null;
  copy: unknown;
  microthemes: unknown;
  deliverable: {
    id: string;
    title: string;
    type: string;
    channel: string;
    status: string;
    brief: string | null;
    spec: unknown;
  } | null;
}
interface HistoryEvent {
  from: string | null;
  to: string;
  at: string;
  byId: string | null;
  byName: string | null;
  note?: string | null;
}
interface Comment {
  decision: string;
  comment: string | null;
  authorName: string | null;
  createdAt: string;
}
interface Line {
  id: string;
  version: number;
  status: string;
  productionStage: string;
  positioning: string | null;
  clientId: string | null;
  clientName: string;
  lineName: string;
  responsibleName: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  createdAt: string;
  token: string | null;
  stageHistory: HistoryEvent[];
  reviewComments: Comment[];
  piecesCount: number;
  producedCount: number;
  pieces: Piece[];
}

const COLUMNS: Array<{ stage: string; label: string }> = [
  { stage: "client_review", label: "Em Revisão do Cliente" },
  { stage: "approved", label: "Aprovada" },
  { stage: "design", label: "Designer / Audiovisual" },
  { stage: "final_review", label: "Em Aprovação Final" },
  { stage: "to_post", label: "A Postar" },
];

const STAGE_LABELS: Record<string, string> = {
  client_review: "Em Revisão do Cliente",
  approved: "Aprovada",
  design: "Designer / Audiovisual",
  final_review: "Em Aprovação Final",
  to_post: "A Postar",
  editorial: "Devolvida ao Editorial",
};

function competence(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
}
function dt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** Produção — esteira (Kanban) da agência. Cada card é UMA Linha Editorial. */
export function ProductionClient() {
  const [items, setItems] = useState<Line[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  async function load() {
    setErr(null);
    try { setItems(await api<Line[]>("/production")); }
    catch (e) { setErr(e instanceof Error ? e.message : "Erro"); }
  }
  useEffect(() => { load(); }, []);

  async function move(id: string, stage: string, note?: string) {
    setBusy(id);
    try {
      await api(`/editorial-strategies/${id}/stage`, { method: "POST", body: JSON.stringify({ stage, note }) });
      await load();
    } catch (e) { setErr(e instanceof Error ? e.message : "Erro"); }
    finally { setBusy(null); }
  }

  async function startProduction(id: string) {
    setBusy(id);
    try {
      await api(`/editorial-strategies/${id}/produce-all`, { method: "POST" });
      await api(`/editorial-strategies/${id}/stage`, { method: "POST", body: JSON.stringify({ stage: "design", note: "Produção iniciada" }) });
      await load();
    } catch (e) { setErr(e instanceof Error ? e.message : "Erro ao iniciar produção"); }
    finally { setBusy(null); }
  }

  const open = useMemo(() => items?.find((i) => i.id === openId) ?? null, [items, openId]);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <div>
        <h1 className="text-[32px] font-bold leading-tight tracking-[-0.03em]">Produção</h1>
        <p className="text-sm text-muted">
          Ciclo de vida das Linhas Editoriais — cada card é uma linha, com suas peças dentro.
        </p>
      </div>

      {err && <p className="text-sm text-crit">{err}</p>}

      {items === null ? (
        <p className="text-sm text-muted">Carregando…</p>
      ) : items.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted">
          Nenhuma Linha Editorial na esteira. Dentro de um cliente, gere a linha editorial e clique em
          “Enviar para Cliente” para ela entrar aqui em “Em Revisão do Cliente”.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
          {COLUMNS.map((col) => {
            const list = items.filter((i) => i.productionStage === col.stage);
            return (
              <section key={col.stage} className="rounded-xl border border-border bg-elevated/50 p-3">
                <p className="mb-3 flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted">
                  {col.label}
                  <span className="rounded-full bg-border/60 px-2 py-0.5 text-[11px]">{list.length}</span>
                </p>
                <div className="space-y-2.5">
                  {list.map((line) => (
                    <Card
                      key={line.id}
                      line={line}
                      busy={busy === line.id}
                      onOpen={() => setOpenId(line.id)}
                      onMove={move}
                      onStart={() => startProduction(line.id)}
                    />
                  ))}
                  {list.length === 0 && <p className="px-1 py-2 text-[11px] text-muted/70">Vazio</p>}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {open && (
        <SidePanel line={open} onClose={() => setOpenId(null)} onMove={move} onStart={() => startProduction(open.id)} busy={busy === open.id} />
      )}
    </div>
  );
}

function Card({ line, busy, onOpen, onMove, onStart }: {
  line: Line;
  busy: boolean;
  onOpen: () => void;
  onMove: (id: string, stage: string, note?: string) => void;
  onStart: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const reviewUrl = line.token && typeof window !== "undefined" ? `${window.location.origin}/editorial-review/${line.token}` : null;

  return (
    <div className="rounded-lg border border-border bg-surface p-3 transition-shadow hover:shadow-sm">
      <button onClick={onOpen} className="block w-full text-left">
        <p className="text-sm font-semibold leading-snug">{line.clientName}</p>
        <p className="mt-0.5 text-xs text-muted">{line.lineName} · V{line.version}</p>
        <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-[11px] text-muted">
          <span>📅 {competence(line.submittedAt ?? line.createdAt)}</span>
          <span>🧩 {line.producedCount}/{line.piecesCount} peças</span>
          <span className="truncate">👤 {line.responsibleName ?? "—"}</span>
          <span>🕓 {line.submittedAt ? new Date(line.submittedAt).toLocaleDateString("pt-BR") : "—"}</span>
        </div>
      </button>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {line.productionStage === "client_review" && reviewUrl && (
          <>
            <button
              onClick={() => { navigator.clipboard.writeText(reviewUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }}
              className="rounded-md border border-border px-2 py-1 text-[11px] hover:bg-elevated"
            >
              {copied ? "Copiado!" : "Copiar link cliente"}
            </button>
            <a href={reviewUrl} target="_blank" className="rounded-md border border-border px-2 py-1 text-[11px] hover:bg-elevated">Abrir ↗</a>
          </>
        )}
        {line.productionStage === "approved" && (
          <button onClick={onStart} disabled={busy}
            className="rounded-md bg-brand px-2 py-1 text-[11px] font-semibold text-white hover:bg-brand-strong disabled:opacity-50 dark:text-[#00390d]">
            {busy ? "Produzindo…" : "Iniciar produção →"}
          </button>
        )}
        {line.productionStage === "design" && (
          <button onClick={() => onMove(line.id, "final_review")} disabled={busy}
            className="rounded-md bg-brand px-2 py-1 text-[11px] font-semibold text-white hover:bg-brand-strong disabled:opacity-50 dark:text-[#00390d]">
            Enviar p/ Aprovação Final →
          </button>
        )}
        {line.productionStage === "final_review" && (
          <>
            <button onClick={() => onMove(line.id, "to_post")} disabled={busy}
              className="rounded-md bg-ok px-2 py-1 text-[11px] font-semibold text-white hover:opacity-90 disabled:opacity-50">
              Aprovar → A Postar
            </button>
            <button onClick={() => onMove(line.id, "design")} disabled={busy}
              className="rounded-md border border-border px-2 py-1 text-[11px] hover:bg-elevated">
              Retornar p/ Designer
            </button>
          </>
        )}
        {line.clientId && (
          <Link href={`/clients/${line.clientId}`} className="rounded-md border border-border px-2 py-1 text-[11px] hover:bg-elevated">
            Abrir cliente
          </Link>
        )}
      </div>
    </div>
  );
}

function SidePanel({ line, onClose, onMove, onStart, busy }: {
  line: Line;
  onClose: () => void;
  onMove: (id: string, stage: string, note?: string) => void;
  onStart: () => void;
  busy: boolean;
}) {
  const [tab, setTab] = useState<"info" | "history" | "pieces">("info");

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose}>
      <div className="h-full w-full max-w-xl overflow-y-auto border-l border-border bg-elevated shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-elevated px-5 py-4">
          <div className="min-w-0">
            <p className="truncate text-base font-semibold">{line.clientName}</p>
            <p className="text-xs text-muted">{line.lineName} · V{line.version} · {STAGE_LABELS[line.productionStage] ?? line.productionStage}</p>
          </div>
          <button onClick={onClose} className="rounded-md border border-border px-2 py-1 text-sm hover:bg-surface">✕</button>
        </div>

        <div className="flex gap-1 border-b border-border px-3">
          {([["info", "Informações"], ["history", "Histórico"], ["pieces", `Peças (${line.piecesCount})`]] as const).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              className={`relative px-3 py-2 text-sm ${tab === id ? "font-semibold text-foreground" : "text-muted hover:text-foreground"}`}>
              {label}
              {tab === id && <span className="absolute -bottom-px left-0 h-0.5 w-full bg-brand" />}
            </button>
          ))}
        </div>

        <div className="space-y-5 p-5">
          {tab === "info" && <InfoTab line={line} />}
          {tab === "history" && <HistoryTab line={line} />}
          {tab === "pieces" && <PiecesTab line={line} />}

          {line.productionStage === "final_review" && (
            <FinalChecklist line={line} onMove={onMove} busy={busy} />
          )}
          {line.productionStage === "approved" && (
            <button onClick={onStart} disabled={busy}
              className="w-full rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-50 dark:text-[#00390d]">
              {busy ? "Produzindo peças…" : "Iniciar produção → Designer / Audiovisual"}
            </button>
          )}
          {line.productionStage === "to_post" && (
            <p className="rounded-lg border border-ok/40 bg-ok/10 p-3 text-sm text-ok">
              ✓ Pronto para publicar. Todas as artes, vídeos, legendas e arquivos finais estão na aba Peças.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoTab({ line }: { line: Line }) {
  const rows: Array<[string, string]> = [
    ["Cliente", line.clientName],
    ["Linha Editorial", `${line.lineName} · V${line.version}`],
    ["Status (cliente)", statusLabel(line.status)],
    ["Etapa", STAGE_LABELS[line.productionStage] ?? line.productionStage],
    ["Competência", competence(line.submittedAt ?? line.createdAt)],
    ["Responsável", line.responsibleName ?? "—"],
    ["Data de envio", dt(line.submittedAt)],
    ["Data de aprovação", dt(line.approvedAt)],
    ["Criada em", dt(line.createdAt)],
    ["Peças", `${line.producedCount}/${line.piecesCount} produzidas`],
  ];
  return (
    <dl className="divide-y divide-border rounded-lg border border-border">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-4 px-3 py-2 text-sm">
          <dt className="text-muted">{k}</dt>
          <dd className="text-right font-medium">{v}</dd>
        </div>
      ))}
      {line.positioning && (
        <div className="px-3 py-2 text-sm">
          <dt className="mb-1 text-muted">Posicionamento</dt>
          <dd>{line.positioning}</dd>
        </div>
      )}
    </dl>
  );
}

function HistoryTab({ line }: { line: Line }) {
  const events = [
    ...line.stageHistory.map((h) => ({
      at: h.at,
      title: `${h.from ? (STAGE_LABELS[h.from] ?? h.from) + " → " : ""}${STAGE_LABELS[h.to] ?? h.to}`,
      by: h.byName,
      note: h.note ?? null,
      kind: "move" as const,
    })),
    ...line.reviewComments.map((c) => ({
      at: c.createdAt,
      title: c.decision === "approve" ? "Cliente aprovou" : "Cliente pediu ajuste",
      by: c.authorName,
      note: c.comment,
      kind: c.decision === "approve" ? ("approve" as const) : ("changes" as const),
    })),
  ].sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());

  if (events.length === 0) return <p className="text-sm text-muted">Sem histórico ainda.</p>;

  return (
    <ol className="relative space-y-3 border-l border-border pl-4">
      {events.map((e, i) => (
        <li key={i} className="relative">
          <span className={`absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full ${
            e.kind === "approve" ? "bg-ok" : e.kind === "changes" ? "bg-crit" : "bg-brand"
          }`} />
          <p className="text-sm font-medium">{e.title}</p>
          <p className="text-[11px] text-muted">{dt(e.at)}{e.by ? ` · ${e.by}` : ""}</p>
          {e.note && <p className="mt-0.5 text-xs text-muted">{e.note}</p>}
        </li>
      ))}
    </ol>
  );
}

function PiecesTab({ line }: { line: Line }) {
  if (line.pieces.length === 0) return <p className="text-sm text-muted">Nenhuma peça nesta linha editorial.</p>;
  return (
    <div className="space-y-2">
      {line.pieces.map((p) => <PieceRow key={p.id} p={p} />)}
    </div>
  );
}

function PieceRow({ p }: { p: Piece }) {
  const [open, setOpen] = useState(false);
  const copy = normalizeCopy(p.copy);
  return (
    <div className="rounded-lg border border-border bg-surface">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left">
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{p.title}</span>
          <span className="block text-[11px] text-muted">{[p.channel, p.format].filter(Boolean).join(" · ") || "—"}</span>
        </span>
        <span className="flex items-center gap-2">
          {p.deliverable ? <StatusChip status={p.deliverable.status} /> : <span className="rounded-full bg-border/60 px-2 py-0.5 text-[10px] text-muted">não produzida</span>}
          <span className="text-muted">{open ? "▲" : "▼"}</span>
        </span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-border px-3 py-3 text-sm">
          {p.deliverable?.brief && (
            <div><p className="label-caps text-muted">Briefing</p><p className="mt-1">{p.deliverable.brief}</p></div>
          )}
          {copy.length > 0 && (
            <div>
              <p className="label-caps text-muted">Copy</p>
              {copy.length === 1 ? <p className="mt-1 whitespace-pre-wrap">{copy[0]}</p> : (
                <ol className="mt-1 list-decimal space-y-1 pl-4">{copy.map((c, i) => <li key={i} className="whitespace-pre-wrap">{c}</li>)}</ol>
              )}
            </div>
          )}
          {p.deliverable ? (
            <div>
              <p className="label-caps text-muted">Roteiro</p>
              <div className="mt-1">
                <ErrorBoundary><SpecView type={p.deliverable.type} spec={p.deliverable.spec} /></ErrorBoundary>
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted">Peça ainda não produzida. Use “Iniciar produção” na etapa Aprovada.</p>
          )}
        </div>
      )}
    </div>
  );
}

function FinalChecklist({ line, onMove, busy }: { line: Line; onMove: (id: string, stage: string, note?: string) => void; busy: boolean }) {
  const ITEMS = [
    "Todas as peças produzidas",
    "Identidade visual conferida",
    "Copy revisada",
    "Roteiro aprovado",
    "Arquivos enviados",
    "Qualidade conferida",
  ];
  const [checked, setChecked] = useState<boolean[]>(ITEMS.map(() => false));
  const allChecked = checked.every(Boolean);
  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <p className="mb-2 text-sm font-semibold">Checklist de Aprovação Final</p>
      <ul className="space-y-1.5">
        {ITEMS.map((label, i) => (
          <li key={label}>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input type="checkbox" checked={checked[i]} onChange={() => setChecked((c) => c.map((v, j) => (j === i ? !v : v)))} />
              {label}
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex flex-wrap gap-2">
        <button onClick={() => onMove(line.id, "to_post")} disabled={busy || !allChecked}
          className="rounded-md bg-ok px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">
          Aprovar produção → A Postar
        </button>
        <button onClick={() => onMove(line.id, "design", "Erro encontrado na revisão final")} disabled={busy}
          className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-elevated">
          Retornar p/ Designer
        </button>
      </div>
      {!allChecked && <p className="mt-2 text-[11px] text-muted">Marque todos os itens para liberar “A Postar”.</p>}
    </div>
  );
}

function StatusChip({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    generating: ["gerando", "bg-sky-500/15 text-sky-500"],
    draft: ["rascunho", "bg-border/60 text-muted"],
    internal_review: ["produzida", "bg-violet-500/15 text-violet-500"],
    client_review: ["com cliente", "bg-amber-500/15 text-amber-500"],
    approved: ["aprovada", "bg-ok/15 text-ok"],
    delivered: ["entregue", "bg-ok/15 text-ok"],
  };
  const [label, cls] = map[status] ?? [status, "bg-border/60 text-muted"];
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}>{label}</span>;
}

function statusLabel(status: string): string {
  return ({ draft: "Rascunho", pending_client: "Aguardando cliente", approved: "Aprovada", changes_requested: "Ajuste pedido" } as Record<string, string>)[status] ?? status;
}

function normalizeCopy(copy: unknown): string[] {
  if (copy == null) return [];
  if (typeof copy === "string") return copy.trim() ? [copy] : [];
  if (Array.isArray(copy)) return copy.map((c) => (typeof c === "string" ? c : JSON.stringify(c))).filter(Boolean);
  return [];
}
