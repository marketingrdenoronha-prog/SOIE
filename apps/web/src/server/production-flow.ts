/* eslint-disable @typescript-eslint/no-explicit-any */
import { randomBytes } from "node:crypto";
import { prisma } from "@soie/db";
import type { Channel, DeliverableType } from "@soie/contracts";
import { appendHistory } from "./production-stage";

/**
 * FLUXO PÓS-APROVAÇÃO DA LINHA EDITORIAL.
 *
 * Depois que o cliente aprova a linha, o SOIE assume toda a produção:
 *  1. materializeProductionPieces — transforma cada tema da linha em uma peça
 *     (Deliverable) com tema, objetivo, formato, copy completa, briefing,
 *     roteiro, referências e observações vindos da própria linha editorial.
 *  2. Cada peça anda no ciclo aguardando → em_producao → produzida →
 *     aprovada_interna → aprovacao_cliente → aprovada.
 *  3. syncStrategyStage recomputa a coluna da linha na esteira (design →
 *     final_review → to_post) a partir do estado das peças.
 *  4. openClientPortalIfReady gera o portal público quando a revisão interna
 *     termina.
 */

export const PIECE_STATUSES = [
  "aguardando",
  "em_producao",
  "produzida",
  "aprovada_interna",
  "aprovacao_cliente",
  "aprovada",
] as const;
export type PieceStatus = (typeof PIECE_STATUSES)[number];

export const PIECE_LABELS: Record<PieceStatus, string> = {
  aguardando: "Aguardando Produção",
  em_producao: "Em Produção",
  produzida: "Produzida",
  aprovada_interna: "Aprovada internamente",
  aprovacao_cliente: "Em aprovação do cliente",
  aprovada: "Aprovada pelo cliente",
};

const CHANNELS = ["instagram", "tiktok", "youtube", "linkedin", "blog", "email", "meta_ads", "google_ads"];
const TYPES = ["video_script", "motion_script", "design_brief", "carousel", "copy", "article", "email_sequence", "ad"];

function toChannel(v?: string | null): Channel {
  const s = (v ?? "").toLowerCase().trim();
  if (CHANNELS.includes(s)) return s as Channel;
  if (s.includes("insta")) return "instagram";
  if (s.includes("tiktok")) return "tiktok";
  if (s.includes("you")) return "youtube";
  if (s.includes("linkedin")) return "linkedin";
  if (s.includes("blog")) return "blog";
  if (s.includes("mail")) return "email";
  if (s.includes("google")) return "google_ads";
  if (s.includes("meta") || s.includes("face") || s.includes("ads")) return "meta_ads";
  return "instagram";
}
function toType(v?: string | null): DeliverableType {
  const s = (v ?? "").toLowerCase().trim();
  if (TYPES.includes(s)) return s as DeliverableType;
  if (s.includes("motion")) return "motion_script";
  if (s.includes("vídeo") || s.includes("video") || s.includes("reel") || s.includes("roteiro")) return "video_script";
  if (s.includes("carrossel") || s.includes("carousel") || s.includes("slide")) return "carousel";
  if (s.includes("estát") || s.includes("estat") || s.includes("arte") || s.includes("design") || s.includes("thumb")) return "design_brief";
  if (s.includes("artigo") || s.includes("blog") || s.includes("article")) return "article";
  if (s.includes("mail")) return "email_sequence";
  if (s.includes("anún") || s.includes("anun") || s.includes("ad")) return "ad";
  if (s.includes("copy") || s.includes("legenda")) return "copy";
  return "video_script";
}

export interface PieceEvent {
  at: string;
  type: string; // status | comment | asset | approval | note
  from?: string | null;
  to?: string | null;
  byId?: string | null;
  byName?: string | null;
  note?: string | null;
}
export function pushPieceEvent(existing: unknown, ev: Omit<PieceEvent, "at">): any {
  const list = Array.isArray(existing) ? existing : [];
  return [...list, { at: new Date().toISOString(), ...ev }];
}

const withThemes = {
  editorialLines: { include: { categories: { include: { themes: { orderBy: { priority: "asc" as const }, include: { deliverable: true } } } } } },
};

/** Cria uma peça por tema da linha (idempotente: pula temas que já têm peça).
 * A peça já nasce com TODO o conteúdo vindo da linha editorial. */
export async function materializeProductionPieces(
  organizationId: string,
  strategyId: string,
  actor: { id?: string | null; name?: string | null },
): Promise<number> {
  const strategy = await prisma.editorialStrategy.findFirst({
    where: { id: strategyId, organizationId },
    include: withThemes,
  });
  if (!strategy) return 0;

  const themes = strategy.editorialLines.flatMap((l) =>
    l.categories.flatMap((c) => c.themes),
  );
  let created = 0;
  for (const t of themes) {
    if (t.deliverableId) continue; // já materializada
    const type = toType(t.format);
    const channel = toChannel(t.channel);
    // A "spec" da peça carrega o conteúdo completo do tema para renderização.
    const spec = {
      title: t.title,
      format: t.format,
      channel: t.channel,
      strategicObjective: t.strategicObjective,
      hook: t.hook,
      cta: t.cta,
      copy: t.copy,
      productionNotes: t.productionNotes,
    };
    const briefParts = [
      t.title,
      t.strategicObjective ? `Objetivo: ${t.strategicObjective}` : "",
      t.hook ? `Gancho: ${t.hook}` : "",
      t.cta ? `CTA: ${t.cta}` : "",
      t.productionNotes ? `Observações: ${t.productionNotes}` : "",
    ].filter(Boolean);

    const deliverable = await prisma.deliverable.create({
      data: {
        organizationId,
        projectId: strategy.projectId,
        themeId: t.id,
        channel,
        type,
        title: t.title,
        brief: briefParts.join("\n"),
        spec: spec as object,
        status: "draft",
        productionStatus: "aguardando",
        createdBy: actor.id ?? undefined,
        history: pushPieceEvent([], {
          type: "status",
          to: "aguardando",
          byId: actor.id ?? null,
          byName: actor.name ?? null,
          note: "Peça criada a partir da linha editorial aprovada",
        }),
      },
    });
    await prisma.theme.update({ where: { id: t.id }, data: { deliverableId: deliverable.id } });
    created++;
  }
  return created;
}

/** Carrega as peças (Deliverables) de uma linha editorial. */
export async function collectPieces(organizationId: string, strategyId: string) {
  const strategy = await prisma.editorialStrategy.findFirst({
    where: { id: strategyId, organizationId },
    include: withThemes,
  });
  if (!strategy) return [];
  return strategy.editorialLines
    .flatMap((l) => l.categories.flatMap((c) => c.themes))
    .map((t) => t.deliverable)
    .filter((d): d is NonNullable<typeof d> => Boolean(d));
}

/** Recomputa a coluna da linha na esteira a partir do estado das peças:
 *  - alguma peça ainda em produção → design (Designer/Audiovisual)
 *  - todas produzidas ou além → final_review (Em Aprovação Final)
 *  - todas aprovadas pelo cliente → to_post (A Postar) */
export async function syncStrategyStage(
  organizationId: string,
  strategyId: string,
  actor: { id?: string | null; name?: string | null },
): Promise<string | null> {
  const strategy = await prisma.editorialStrategy.findFirst({
    where: { id: strategyId, organizationId },
    select: { id: true, productionStage: true, stageHistory: true },
  });
  if (!strategy) return null;

  const pieces = await collectPieces(organizationId, strategyId);
  if (pieces.length === 0) return strategy.productionStage;

  const statuses = pieces.map((p) => p.productionStatus);
  const all = (fn: (s: string) => boolean) => statuses.every(fn);

  const producedPlus = new Set(["produzida", "aprovada_interna", "aprovacao_cliente", "aprovada"]);
  let target: string;
  if (all((s) => s === "aprovada")) target = "to_post";
  else if (all((s) => producedPlus.has(s))) target = "final_review";
  else target = "design";

  if (target !== strategy.productionStage) {
    const label: Record<string, string> = {
      design: "Designer / Audiovisual",
      final_review: "Em Aprovação Final",
      to_post: "A Postar",
    };
    await prisma.editorialStrategy.update({
      where: { id: strategy.id },
      data: {
        productionStage: target,
        stageHistory: appendHistory(strategy.stageHistory, {
          from: strategy.productionStage,
          to: target,
          at: new Date().toISOString(),
          byId: actor.id ?? null,
          byName: actor.name ?? null,
          note: `Avançou automaticamente para ${label[target] ?? target} (estado das peças)`,
        }),
      },
    });
  }
  return target;
}

/** Quando TODAS as peças passam na revisão interna, gera o portal do cliente e
 * move as peças para aprovacao_cliente. Idempotente (só gera 1 token). */
export async function openClientPortalIfReady(
  organizationId: string,
  strategyId: string,
  actor: { id?: string | null; name?: string | null },
): Promise<string | null> {
  const strategy = await prisma.editorialStrategy.findFirst({
    where: { id: strategyId, organizationId },
    select: { id: true, version: true, clientId: true, productionPortalToken: true },
  });
  if (!strategy) return null;

  const pieces = await collectPieces(organizationId, strategyId);
  if (pieces.length === 0) return null;
  const allInternallyApproved = pieces.every((p) => p.productionStatus === "aprovada_interna");
  if (!allInternallyApproved) return strategy.productionPortalToken;

  const token = strategy.productionPortalToken ?? randomBytes(24).toString("base64url");
  await prisma.$transaction([
    prisma.editorialStrategy.update({
      where: { id: strategy.id },
      data: { productionPortalToken: token },
    }),
    prisma.deliverable.updateMany({
      where: { id: { in: pieces.map((p) => p.id) }, productionStatus: "aprovada_interna" },
      data: { productionStatus: "aprovacao_cliente" },
    }),
    prisma.notification.create({
      data: {
        organizationId,
        userId: actor.id ?? organizationId,
        type: "production_client_portal_ready",
        title: `Portal do cliente pronto — linha editorial V${strategy.version}`,
        body: "Todas as peças passaram na revisão interna. Envie o portal ao cliente.",
        data: { strategyId: strategy.id, token },
      },
    }),
  ]);
  return token;
}
