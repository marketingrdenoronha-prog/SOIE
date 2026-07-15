"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { api, apiUpload } from "@/lib/api";
import { ErrorBoundary } from "@/components/error-boundary";
import { ThemeContent } from "@/components/editorial-doc";
import { AdjustmentsBoard } from "@/components/adjustments-board";

/** Teto do corpo de request no serverless da Vercel (~4,5 MB). Como os arquivos
 * vão para o banco (Neon) por request normal, cada arquivo fica abaixo disso. */
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Asset {
  id: string;
  version: number;
  kind: string;
  url: string;
  name: string | null;
  note: string | null;
  createdAt: string;
}
interface Piece {
  id: string;
  title: string;
  channel: string | null;
  format: string | null;
  copy: unknown;
  microthemes: unknown;
  strategicObjective: string | null;
  hook: string | null;
  cta: string | null;
  productionNotes: string | null;
  deliverable: {
    id: string;
    title: string;
    type: string;
    channel: string;
    status: string;
    productionStatus: string;
    brief: string | null;
    spec: unknown;
    assets: Asset[];
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
  productionPortalToken: string | null;
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

      {/* Colunas de ALTERAÇÃO dentro da esteira: o que o cliente pediu para
          mudar, separado em Linha Editorial (ajuste manual/IA) e Materiais
          (o Designer refaz). */}
      <section className="space-y-3 border-t border-border pt-6">
        <div>
          <h2 className="text-lg font-semibold">Alterações solicitadas pelo cliente</h2>
          <p className="text-sm text-muted">
            Pedidos de mudança separados por tipo — a linha editorial tem ajuste manual e automático (IA); o material
            pronto volta para o Designer refazer.
          </p>
        </div>
        <AdjustmentsBoard />
      </section>

      {open && (
        <SidePanel line={open} onClose={() => setOpenId(null)} onMove={move} onStart={() => startProduction(open.id)} onReload={load} busy={busy === open.id} />
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
          <button onClick={onOpen}
            className="rounded-md bg-brand px-2 py-1 text-[11px] font-semibold text-white hover:bg-brand-strong dark:text-[#00390d]">
            Anexar peças / gerar link
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
        {line.productionStage === "to_post" && (
          <button onClick={onOpen}
            className="rounded-md bg-brand px-2 py-1 text-[11px] font-semibold text-white hover:bg-brand-strong dark:text-[#00390d]">
            📅 Agendar postagens
          </button>
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

function SidePanel({ line, onClose, onMove, onStart, onReload, busy }: {
  line: Line;
  onClose: () => void;
  onMove: (id: string, stage: string, note?: string) => void;
  onStart: () => void;
  onReload: () => Promise<void> | void;
  busy: boolean;
}) {
  const [tab, setTab] = useState<"info" | "history" | "pieces">(
    line.productionStage === "design" ? "pieces" : "info",
  );
  const [schedOpen, setSchedOpen] = useState(false);

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
          {tab === "pieces" && <PiecesTab line={line} onReload={onReload} />}

          {line.productionStage === "design" && (
            <DesignActions line={line} onMove={onMove} onReload={onReload} busy={busy} />
          )}
          {line.productionStage === "final_review" && (
            <>
              <ProducedPiecesLink
                line={line}
                onReload={onReload}
                title="Link de aprovação final (copies + arte)"
                help="Envie este link externo ao cliente para a aprovação final — ele vê a copy e a arte/vídeo de cada peça e aprova ou pede alteração."
              />
              <FinalChecklist line={line} onMove={onMove} busy={busy} />
            </>
          )}
          {line.productionStage === "approved" && (
            <button onClick={onStart} disabled={busy}
              className="w-full rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-50 dark:text-[#00390d]">
              {busy ? "Produzindo peças…" : "Iniciar produção → Designer / Audiovisual"}
            </button>
          )}
          {line.productionStage === "to_post" && (
            <div className="space-y-3">
              <p className="rounded-lg border border-ok/40 bg-ok/10 p-3 text-sm text-ok">
                ✓ Tudo aprovado pelo cliente. Agora é agendar as postagens.
              </p>
              <button onClick={() => setSchedOpen(true)}
                className="w-full rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong dark:text-[#00390d]">
                📅 Agendar postagens
              </button>
            </div>
          )}
        </div>
      </div>
      {schedOpen && <ScheduleModal line={line} onClose={() => setSchedOpen(false)} />}
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

function PiecesTab({ line, onReload }: { line: Line; onReload: () => Promise<void> | void }) {
  if (line.pieces.length === 0) return <p className="text-sm text-muted">Nenhuma peça nesta linha editorial.</p>;
  // Designer trabalha as peças (anexar artes/vídeos + aprovação) enquanto a
  // linha está na coluna "Designer / Audiovisual".
  const canProduce = line.productionStage === "design";
  return (
    <div className="space-y-2">
      {line.pieces.map((p) => <PieceRow key={p.id} p={p} canProduce={canProduce} onReload={onReload} />)}
    </div>
  );
}

const PRODUCTION_LABELS: Record<string, [string, string]> = {
  aguardando: ["Aguardando produção", "bg-border/60 text-muted"],
  em_producao: ["Em produção", "bg-sky-500/15 text-sky-500"],
  produzida: ["Produzida", "bg-violet-500/15 text-violet-500"],
  aprovada_interna: ["Aprovada internamente", "bg-indigo-500/15 text-indigo-500"],
  aprovacao_cliente: ["Com o cliente", "bg-amber-500/15 text-amber-500"],
  aprovada: ["Aprovada pelo cliente", "bg-ok/15 text-ok"],
};

function ProductionChip({ status }: { status: string }) {
  const [label, cls] = PRODUCTION_LABELS[status] ?? [status, "bg-border/60 text-muted"];
  return <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${cls}`}>{label}</span>;
}

function PieceRow({ p, canProduce, onReload }: { p: Piece; canProduce: boolean; onReload: () => Promise<void> | void }) {
  const [open, setOpen] = useState(false);
  const d = p.deliverable;
  return (
    <div className="rounded-lg border border-border bg-surface">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left">
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium">{p.title}</span>
          <span className="block text-[11px] text-muted">{[p.channel, p.format].filter(Boolean).join(" · ") || "—"}</span>
        </span>
        <span className="flex items-center gap-2">
          {d ? <ProductionChip status={d.productionStatus} /> : <span className="rounded-full bg-border/60 px-2 py-0.5 text-[10px] text-muted">a produzir</span>}
          {d && d.assets.length > 0 && <span className="text-[10px] text-muted">📎 {d.assets.length}</span>}
          <span className="text-muted">{open ? "▲" : "▼"}</span>
        </span>
      </button>
      {open && (
        <div className="space-y-3 border-t border-border px-3 py-3">
          {canProduce && d && <PieceProduction d={d} onReload={onReload} />}
          {!canProduce && d && d.assets.length > 0 && <AssetList assets={d.assets} />}
          {/* Conteúdo pronto para produção vindo da Linha Editorial. */}
          <details>
            <summary className="cursor-pointer text-xs font-medium text-muted hover:text-foreground">Ver conteúdo / roteiro</summary>
            <div className="mt-2 border-t border-border pt-2">
              <ErrorBoundary><ThemeContent theme={p} /></ErrorBoundary>
            </div>
          </details>
        </div>
      )}
    </div>
  );
}

/** Regras de upload por formato da peça: só arquivo (sem link), tipo travado. */
function uploadSpec(type: string): { accept: string; multiple: boolean; kind: "image" | "video"; label: string; hint: string } {
  if (type === "video_script" || type === "motion_script") {
    return { accept: ".mov,.mp4,video/quicktime,video/mp4", multiple: false, kind: "video", label: "Anexar vídeo", hint: "MOV ou MP4 · até 4 MB" };
  }
  if (type === "carousel") {
    return { accept: ".png,.jpg,.jpeg,image/png,image/jpeg", multiple: true, kind: "image", label: "Anexar telas do carrossel", hint: "1 PNG ou JPG por tela · pode selecionar vários · até 4 MB cada" };
  }
  return { accept: ".png,.jpg,.jpeg,image/png,image/jpeg", multiple: false, kind: "image", label: "Anexar arte", hint: "PNG ou JPG · até 4 MB" };
}

/** Painel de produção de UMA peça na coluna do Designer: fazer UPLOAD dos
 * arquivos finais (arte PNG/JPG, telas de carrossel, vídeo MOV/MP4) para o
 * banco (Neon) + mover a peça no fluxo (produção → aprovação interna). */
function PieceProduction({ d, onReload }: {
  d: NonNullable<Piece["deliverable"]>;
  onReload: () => Promise<void> | void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const spec = uploadSpec(d.type);

  async function onFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const selected = Array.from(fileList);
    // Limite do serverless: arquivos vão para o banco (Neon) via request normal.
    const tooBig = selected.find((f) => f.size > MAX_UPLOAD_BYTES);
    if (tooBig) {
      setErr(`"${tooBig.name}" tem ${(tooBig.size / 1024 / 1024).toFixed(1)} MB. Máximo ${(MAX_UPLOAD_BYTES / 1024 / 1024).toFixed(0)} MB por arquivo (os arquivos são guardados no banco Neon).`);
      return;
    }
    setBusy(true); setErr(null);
    try {
      const uploaded: Array<{ url: string; name: string; kind: string }> = [];
      for (let i = 0; i < selected.length; i++) {
        const file = selected[i]!;
        setProgress(selected.length > 1 ? `Enviando ${i + 1}/${selected.length}: ${file.name}…` : `Enviando ${file.name}…`);
        // Upload direto para o Neon (multipart → asset_blobs). Retorna a URL de
        // download da peça.
        const res = await apiUpload<{ url: string; name: string; kind: string }>(`/deliverables/${d.id}/upload`, file);
        uploaded.push({ url: res.url, name: res.name, kind: res.kind });
      }
      setProgress("Salvando…");
      await api(`/deliverables/${d.id}/assets`, { method: "POST", body: JSON.stringify({ files: uploaded }) });
      if (fileRef.current) fileRef.current.value = "";
      await onReload();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro ao enviar arquivo");
    } finally {
      setBusy(false); setProgress(null);
    }
  }

  async function status(action: string, actionNote?: string) {
    setBusy(true); setErr(null);
    try {
      await api(`/deliverables/${d.id}/production-status`, {
        method: "POST",
        body: JSON.stringify({ action, note: actionNote }),
      });
      await onReload();
    } catch (e) { setErr(e instanceof Error ? e.message : "Erro"); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-elevated/50 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Produção da peça</p>
        <ProductionChip status={d.productionStatus} />
      </div>

      {d.assets.length > 0 && <AssetList assets={d.assets} />}

      {/* Upload dos arquivos finais — só arquivo, tipo travado por formato. */}
      <div className="space-y-2 rounded-md border border-dashed border-border p-3 text-center">
        <input
          ref={fileRef}
          type="file"
          accept={spec.accept}
          multiple={spec.multiple}
          disabled={busy}
          onChange={(e) => onFiles(e.target.files)}
          className="hidden"
          id={`file-${d.id}`}
        />
        <label
          htmlFor={`file-${d.id}`}
          className={`inline-flex cursor-pointer items-center gap-2 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-strong dark:text-[#00390d] ${busy ? "pointer-events-none opacity-50" : ""}`}
        >
          {spec.kind === "video" ? "🎬" : "🖼"} {busy ? "Enviando…" : spec.label}
        </label>
        <p className="text-[11px] text-muted">{spec.hint}</p>
        {progress && <p className="text-[11px] text-brand-strong dark:text-brand">{progress}</p>}
      </div>

      {err && <p className="text-xs text-crit">{err}</p>}

      {/* Fluxo da peça. */}
      <div className="flex flex-wrap gap-1.5">
        {(d.productionStatus === "aguardando" || d.productionStatus === "em_producao") && (
          <>
            {d.productionStatus === "aguardando" && (
              <button onClick={() => status("start")} disabled={busy}
                className="rounded-md border border-border px-2.5 py-1 text-[11px] hover:bg-surface">
                Iniciar produção
              </button>
            )}
            <button onClick={() => status("produced")} disabled={busy || d.assets.length === 0}
              title={d.assets.length === 0 ? "Anexe ao menos um arquivo antes de marcar como produzida" : ""}
              className="rounded-md bg-brand px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-brand-strong disabled:opacity-50 dark:text-[#00390d]">
              Marcar produzida →
            </button>
          </>
        )}
        {d.productionStatus === "produzida" && (
          <>
            <button onClick={() => status("approve_internal")} disabled={busy}
              className="rounded-md bg-ok px-2.5 py-1 text-[11px] font-semibold text-white hover:opacity-90 disabled:opacity-50">
              Aprovar internamente ✓
            </button>
            <button onClick={() => { const n = prompt("O que ajustar nesta peça?"); if (n) status("reject_internal", n); }} disabled={busy}
              className="rounded-md border border-border px-2.5 py-1 text-[11px] hover:bg-surface">
              Reprovar / ajustar
            </button>
          </>
        )}
        {(d.productionStatus === "aprovada_interna" || d.productionStatus === "aprovacao_cliente") && (
          <button onClick={() => status("reopen")} disabled={busy}
            className="rounded-md border border-border px-2.5 py-1 text-[11px] hover:bg-surface">
            Reabrir para ajuste
          </button>
        )}
        {d.productionStatus === "aprovada" && (
          <span className="text-[11px] text-ok">✓ Aprovada pelo cliente</span>
        )}
      </div>
    </div>
  );
}

function AssetList({ assets }: { assets: Asset[] }) {
  // Só a última versão de cada peça (o array já vem ordenado desc por versão).
  const latest = assets.length ? assets[0].version : 0;
  const shown = assets.filter((a) => a.version === latest);
  return (
    <div className="space-y-1.5">
      <p className="text-[11px] font-medium text-muted">
        Arquivos enviados {shown.length > 1 && <span className="text-muted/70">({shown.length})</span>}
        {latest > 1 && <span className="text-muted/70"> · v{latest}</span>}
      </p>
      <div className="grid grid-cols-3 gap-1.5">
        {shown.map((a) => (
          <a key={a.id} href={a.url} target="_blank" rel="noreferrer" title={a.name || a.url}
            className="group relative block overflow-hidden rounded-md border border-border bg-surface">
            {a.kind === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.url} alt={a.name || ""} className="aspect-square w-full object-cover" />
            ) : a.kind === "video" ? (
              <video src={a.url} className="aspect-square w-full object-cover" muted />
            ) : (
              <span className="flex aspect-square w-full items-center justify-center text-lg">📄</span>
            )}
            <span className="absolute inset-x-0 bottom-0 truncate bg-black/50 px-1 py-0.5 text-[9px] text-white opacity-0 group-hover:opacity-100">
              {a.name || "arquivo"}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}

/** Bloco do LINK EXTERNO das peças produzidas (portal público /producao/:token)
 * — mostra as copies + as artes/vídeos de cada peça para o cliente aprovar.
 * Reutilizado na coluna do Designer e na Aprovação Final. */
function ProducedPiecesLink({ line, onReload, title, help }: {
  line: Line;
  onReload: () => Promise<void> | void;
  title: string;
  help: string;
}) {
  const [genBusy, setGenBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const token = line.productionPortalToken;
  const portalUrl = token && typeof window !== "undefined" ? `${window.location.origin}/producao/${token}` : null;

  const producedCount = line.pieces.filter(
    (p) => p.deliverable && ["produzida", "aprovada_interna", "aprovacao_cliente", "aprovada"].includes(p.deliverable.productionStatus),
  ).length;

  async function generate() {
    setGenBusy(true); setErr(null);
    try {
      await api(`/editorial-strategies/${line.id}/production-portal`, { method: "POST" });
      await onReload();
    } catch (e) { setErr(e instanceof Error ? e.message : "Erro ao gerar link"); }
    finally { setGenBusy(false); }
  }

  function copy() {
    if (portalUrl) { navigator.clipboard.writeText(portalUrl); setCopied(true); setTimeout(() => setCopied(false), 1500); }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border bg-surface p-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">{title}</p>
        <span className="text-[11px] text-muted">{producedCount}/{line.piecesCount} produzidas</span>
      </div>
      <p className="text-xs text-muted">{help}</p>

      {err && <p className="text-xs text-crit">{err}</p>}

      {portalUrl ? (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-elevated px-2.5 py-1.5">
            <span className="min-w-0 flex-1 truncate text-xs text-muted">{portalUrl}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={copy} className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-strong dark:text-[#00390d]">
              {copied ? "Copiado!" : "Copiar link"}
            </button>
            <a href={portalUrl} target="_blank" rel="noreferrer" className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-elevated">Abrir ↗</a>
            <button onClick={generate} disabled={genBusy} className="rounded-md border border-border px-3 py-1.5 text-xs hover:bg-elevated disabled:opacity-50">
              {genBusy ? "Atualizando…" : "Atualizar peças no link"}
            </button>
          </div>
        </div>
      ) : (
        <button onClick={generate} disabled={genBusy || producedCount === 0}
          title={producedCount === 0 ? "Marque ao menos uma peça como produzida" : ""}
          className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-strong disabled:opacity-50 dark:text-[#00390d]">
          {genBusy ? "Gerando…" : "Gerar link das peças produzidas"}
        </button>
      )}
    </div>
  );
}

/** Ações da coluna do Designer no nível da LINHA: gerar/copiar o link público
 * com as peças produzidas para o cliente aprovar, e avançar para Aprovação
 * Final quando a produção terminar. */
function DesignActions({ line, onMove, onReload, busy }: {
  line: Line;
  onMove: (id: string, stage: string, note?: string) => void;
  onReload: () => Promise<void> | void;
  busy: boolean;
}) {
  return (
    <div className="space-y-3">
      <ProducedPiecesLink
        line={line}
        onReload={onReload}
        title="Link das peças produzidas"
        help="Anexe as artes/vídeos em cada peça, marque como produzidas e gere o link público (copies + arte) para o cliente aprovar."
      />
      <button onClick={() => onMove(line.id, "final_review")} disabled={busy}
        className="w-full rounded-md bg-ok px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50">
        Enviar para Aprovação Final →
      </button>
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

function statusLabel(status: string): string {
  return ({ draft: "Rascunho", pending_client: "Aguardando cliente", approved: "Aprovada", changes_requested: "Ajuste pedido" } as Record<string, string>)[status] ?? status;
}

// ---------------------------------------------------------------------------
// Agendamento de postagens (aba "A Postar")
// ---------------------------------------------------------------------------

interface SchedPiece {
  deliverableId: string;
  title: string;
  channel: string;
  type: string;
  brief: string | null;
  hook: string | null;
  cta: string | null;
  assets: Array<{ kind: string; url: string; name: string | null }>;
  schedule: { channel: string; caption: string | null; scheduledFor: string | null; status: string; externalId: string | null; error: string | null } | null;
}
interface SchedData {
  strategyId: string;
  clientId: string | null;
  version: number;
  social: { configured: boolean; connected: boolean; accounts: Array<{ accountId: string; platform: string; name: string | null }> };
  pieces: SchedPiece[];
}
interface Row { channel: string; caption: string; scheduledFor: string /* datetime-local */ }

const CONNECT_PLATFORMS = ["instagram", "facebook", "tiktok", "linkedin", "youtube"] as const;

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Tela de agendamento: por peça, data/hora + legenda (IA ou manual) + canal;
 * conecta as redes do cliente e agenda tudo no Zernio. */
function ScheduleModal({ line, onClose }: { line: Line; onClose: () => void }) {
  const [data, setData] = useState<SchedData | null>(null);
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [captionBusy, setCaptionBusy] = useState<string | null>(null);

  async function load() {
    setErr(null);
    try {
      const d = await api<SchedData>(`/editorial-strategies/${line.id}/schedule`);
      setData(d);
      const r: Record<string, Row> = {};
      for (const p of d.pieces) {
        r[p.deliverableId] = {
          channel: p.schedule?.channel ?? p.channel,
          caption: p.schedule?.caption ?? "",
          scheduledFor: toLocalInput(p.schedule?.scheduledFor ?? null),
        };
      }
      setRows(r);
    } catch (e) { setErr(e instanceof Error ? e.message : "Erro"); }
  }
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  function setRow(id: string, patch: Partial<Row>) {
    setRows((prev) => ({ ...prev, [id]: { ...prev[id]!, ...patch } }));
  }

  async function connect(platform: string) {
    if (!line.clientId) return;
    setBusy(`connect:${platform}`); setErr(null);
    try {
      const r = await api<{ url: string }>(`/clients/${line.clientId}/social/connect`, { method: "POST", body: JSON.stringify({ platform }) });
      window.open(r.url, "_blank", "noopener");
      setMsg("Abrimos a autorização em outra aba. Depois de conectar, clique em “Atualizar contas”.");
    } catch (e) { setErr(e instanceof Error ? e.message : "Erro ao conectar"); }
    finally { setBusy(null); }
  }

  async function genCaption(p: SchedPiece) {
    setCaptionBusy(p.deliverableId); setErr(null);
    try {
      const r = await api<{ caption: string }>(`/deliverables/${p.deliverableId}/caption`, { method: "POST", body: JSON.stringify({ channel: rows[p.deliverableId]?.channel }) });
      setRow(p.deliverableId, { caption: r.caption });
    } catch (e) { setErr(e instanceof Error ? e.message : "Erro ao gerar legenda"); }
    finally { setCaptionBusy(null); }
  }

  async function save(): Promise<boolean> {
    setErr(null);
    const items = Object.entries(rows).map(([deliverableId, r]) => ({
      deliverableId,
      channel: r.channel,
      caption: r.caption || undefined,
      scheduledFor: r.scheduledFor ? new Date(r.scheduledFor).toISOString() : null,
    }));
    await api(`/editorial-strategies/${line.id}/schedule`, { method: "PUT", body: JSON.stringify({ items }) });
    return true;
  }

  async function onSave() {
    setBusy("save"); setMsg(null);
    try { await save(); setMsg("Agendamento salvo."); }
    catch (e) { setErr(e instanceof Error ? e.message : "Erro ao salvar"); }
    finally { setBusy(null); }
  }

  async function onPublish() {
    setBusy("publish"); setMsg(null); setErr(null);
    try {
      await save();
      const r = await api<{ scheduled: number; skipped: number; failures: Array<{ error: string }> }>(
        `/editorial-strategies/${line.id}/schedule/publish`, { method: "POST" },
      );
      setMsg(`${r.scheduled} agendada(s) no Zernio${r.failures.length ? ` · ${r.failures.length} falha(s): ${r.failures[0].error}` : ""}.`);
      await load();
    } catch (e) { setErr(e instanceof Error ? e.message : "Erro ao agendar"); }
    finally { setBusy(null); }
  }

  const accounts = data?.social.accounts ?? [];

  return (
    <div className="fixed inset-0 z-[60] flex justify-center overflow-y-auto bg-black/50 p-4" onClick={onClose}>
      <div className="my-4 h-max w-full max-w-3xl rounded-xl border border-border bg-elevated shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 rounded-t-xl border-b border-border bg-elevated px-5 py-4">
          <div>
            <p className="text-base font-semibold">📅 Agendar postagens</p>
            <p className="text-xs text-muted">{line.clientName} · {line.lineName} · V{line.version}</p>
          </div>
          <button onClick={onClose} className="rounded-md border border-border px-2 py-1 text-sm hover:bg-surface">✕</button>
        </div>

        <div className="space-y-5 p-5">
          {err && <p className="rounded-md border border-crit/40 bg-crit/10 p-2 text-sm text-crit">{err}</p>}
          {msg && <p className="rounded-md border border-ok/40 bg-ok/10 p-2 text-sm text-ok">{msg}</p>}

          {/* Conexão das redes do cliente. */}
          <section className="rounded-lg border border-border bg-surface p-3">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Redes do cliente</p>
              <button onClick={load} className="rounded-md border border-border px-2 py-1 text-[11px] hover:bg-elevated">Atualizar contas</button>
            </div>
            {data && !data.social.configured ? (
              <p className="mt-2 text-xs text-warn">
                Publicação automática não configurada. Defina a chave <code>ZERNIO_API_KEY</code> nas variáveis do projeto (veja o tutorial em docs/TUTORIAL-AGENDAMENTO.md). Você ainda pode salvar o plano de agendamento abaixo.
              </p>
            ) : (
              <>
                {accounts.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {accounts.map((a) => (
                      <span key={a.accountId} className="rounded-full bg-ok/15 px-2 py-0.5 text-[11px] text-ok">✓ {a.platform}{a.name ? ` · ${a.name}` : ""}</span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted">Nenhuma conta conectada ainda. Conecte cada rede do cliente:</p>
                )}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {CONNECT_PLATFORMS.map((pl) => (
                    <button key={pl} onClick={() => connect(pl)} disabled={busy === `connect:${pl}`}
                      className="rounded-md border border-border px-2.5 py-1 text-[11px] hover:bg-elevated disabled:opacity-50">
                      {busy === `connect:${pl}` ? "…" : `Conectar ${pl}`}
                    </button>
                  ))}
                </div>
              </>
            )}
          </section>

          {/* Peças. */}
          {data === null ? (
            <p className="text-sm text-muted">Carregando…</p>
          ) : data.pieces.length === 0 ? (
            <p className="text-sm text-muted">Nenhuma peça produzida nesta linha.</p>
          ) : (
            <div className="space-y-3">
              {data.pieces.map((p) => {
                const r = rows[p.deliverableId];
                const art = p.assets.find((a) => a.kind === "image") ?? p.assets[0];
                return (
                  <div key={p.deliverableId} className="flex gap-3 rounded-lg border border-border bg-surface p-3">
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md border border-border bg-elevated">
                      {art ? (art.kind === "video"
                        // eslint-disable-next-line jsx-a11y/media-has-caption
                        ? <video src={art.url} className="h-full w-full object-cover" muted />
                        // eslint-disable-next-line @next/next/no-img-element
                        : <img src={art.url} alt="" className="h-full w-full object-cover" />)
                        : <span className="flex h-full w-full items-center justify-center text-xs text-muted">sem arte</span>}
                    </div>
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-medium">{p.title}</p>
                        {p.schedule?.status === "scheduled" && <span className="shrink-0 rounded-full bg-ok/15 px-2 py-0.5 text-[10px] text-ok">agendada</span>}
                        {p.schedule?.status === "failed" && <span className="shrink-0 rounded-full bg-crit/15 px-2 py-0.5 text-[10px] text-crit">falhou</span>}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <label className="text-[11px] text-muted">
                          Data/hora
                          <input type="datetime-local" value={r?.scheduledFor ?? ""} onChange={(e) => setRow(p.deliverableId, { scheduledFor: e.target.value })}
                            className="mt-0.5 block rounded-md border border-border bg-surface px-2 py-1 text-sm outline-none focus:border-brand" />
                        </label>
                        <label className="text-[11px] text-muted">
                          Canal
                          <input value={r?.channel ?? ""} onChange={(e) => setRow(p.deliverableId, { channel: e.target.value })}
                            className="mt-0.5 block w-32 rounded-md border border-border bg-surface px-2 py-1 text-sm outline-none focus:border-brand" />
                        </label>
                      </div>
                      <div>
                        <div className="mb-1 flex items-center justify-between">
                          <span className="text-[11px] text-muted">Legenda</span>
                          <button onClick={() => genCaption(p)} disabled={captionBusy === p.deliverableId}
                            className="rounded-md border border-border px-2 py-0.5 text-[11px] hover:bg-elevated disabled:opacity-50">
                            {captionBusy === p.deliverableId ? "Gerando…" : "✨ Gerar com IA"}
                          </button>
                        </div>
                        <textarea value={r?.caption ?? ""} onChange={(e) => setRow(p.deliverableId, { caption: e.target.value })} rows={3}
                          placeholder="Legenda da postagem (gere com IA ou escreva)"
                          className="w-full rounded-md border border-border bg-surface px-2.5 py-1.5 text-sm outline-none focus:border-brand" />
                      </div>
                      {p.schedule?.error && <p className="text-[11px] text-crit">{p.schedule.error}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 rounded-b-xl border-t border-border bg-elevated px-5 py-4">
          <button onClick={onSave} disabled={busy !== null}
            className="rounded-md border border-border px-4 py-2 text-sm font-medium hover:bg-surface disabled:opacity-50">
            {busy === "save" ? "Salvando…" : "Salvar plano"}
          </button>
          <button onClick={onPublish} disabled={busy !== null || !data?.social.connected}
            title={!data?.social.connected ? "Conecte as redes do cliente para agendar" : ""}
            className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-strong disabled:opacity-50 dark:text-[#00390d]">
            {busy === "publish" ? "Agendando…" : "Agendar no Zernio →"}
          </button>
        </div>
      </div>
    </div>
  );
}
