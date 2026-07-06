import { prisma } from "@soie/db";
import { FORMAT_CATALOG } from "@soie/ai";
import type { Channel, DeliverableType } from "@soie/contracts";
import { requireAuth } from "@/server/auth";
import { ok, handle, Errors } from "@/server/http";
import { produceInline } from "@/server/ai-runtime";
import { assembleProjectContext } from "@/server/project-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CHANNELS: Channel[] = ["instagram", "tiktok", "youtube", "linkedin", "blog", "email", "meta_ads", "google_ads"];
const TYPES: DeliverableType[] = ["video_script", "motion_script", "design_brief", "carousel", "copy", "article", "email_sequence", "ad"];

/** Maps a free-text channel (from the editorial theme) to a valid Channel. */
function toChannel(v?: string | null): Channel {
  const s = (v ?? "").toLowerCase().trim();
  if ((CHANNELS as string[]).includes(s)) return s as Channel;
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

/** Maps a free-text format (from the editorial theme) to a valid DeliverableType. */
function toType(v?: string | null): DeliverableType {
  const s = (v ?? "").toLowerCase().trim();
  if ((TYPES as string[]).includes(s)) return s as DeliverableType;
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

/** Runs tasks with a bounded concurrency so we don't fan out dozens of AI calls. */
async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      results[idx] = await fn(items[idx]!);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * POST /editorial-strategies/:id/produce-all
 * One click after approval: produces a deliverable for every theme of the
 * approved strategy (bounded concurrency). Themes already produced (theme has a
 * deliverableId) are skipped, so re-clicking only fills the gaps.
 */
/** Builds the production brief from EVERYTHING the client approved on the
 * theme — copy, hook, CTA, strategic objective, production notes — not just the
 * title. The approved copy is the anchor: production refines and formats it,
 * it must not reinvent the content the client already signed off on. */
function themeBrief(theme: {
  title: string;
  strategicObjective?: string | null;
  hook?: string | null;
  cta?: string | null;
  productionNotes?: string | null;
  copy?: unknown;
}): string {
  const parts: string[] = [`Tema: ${theme.title}`];
  if (theme.strategicObjective) parts.push(`Objetivo estratégico: ${theme.strategicObjective}`);
  if (theme.hook) parts.push(`Gancho aprovado: ${theme.hook}`);
  if (theme.cta) parts.push(`CTA aprovada: ${theme.cta}`);
  if (theme.productionNotes) parts.push(`Observações de produção: ${theme.productionNotes}`);
  if (theme.copy && typeof theme.copy === "object") {
    parts.push(
      "COPY APROVADA PELO CLIENTE (base obrigatória — refine e formate para produção, NÃO reinvente o conteúdo):\n" +
        JSON.stringify(theme.copy).slice(0, 6000),
    );
  }
  return parts.join("\n\n");
}

/** Deliverables stuck in "generating" (a previous run died mid-flight) are
 * unlinked and removed after this grace period, so the re-click reproduces
 * their themes instead of skipping them forever. */
const STUCK_GENERATING_MS = 15 * 60 * 1000;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const startedAt = Date.now();
    const { org, sub } = requireAuth(req);
    const { id } = await params;

    const strategy = await prisma.editorialStrategy.findFirst({
      where: { id, organizationId: org },
      include: {
        editorialLines: { include: { categories: { include: { themes: true } } } },
      },
    });
    if (!strategy) throw Errors.notFound("Linha editorial");
    if (strategy.status !== "approved") {
      throw Errors.badRequest("A linha editorial precisa estar aprovada pelo cliente para produzir.");
    }

    const allThemes = strategy.editorialLines.flatMap((l) => l.categories.flatMap((c) => c.themes));

    // Heal: destrava temas cuja produção anterior morreu no meio (deliverable
    // preso em "generating" além do prazo) para que este run os reproduza.
    const stuck = await prisma.deliverable.findMany({
      where: {
        organizationId: org,
        themeId: { in: allThemes.map((t) => t.id) },
        status: "generating",
        updatedAt: { lt: new Date(Date.now() - STUCK_GENERATING_MS) },
      },
      select: { id: true, themeId: true },
    });
    if (stuck.length > 0) {
      await prisma.$transaction([
        prisma.theme.updateMany({
          where: { id: { in: stuck.map((s) => s.themeId!).filter(Boolean) } },
          data: { deliverableId: null },
        }),
        prisma.deliverable.deleteMany({ where: { id: { in: stuck.map((s) => s.id) } } }),
      ]);
      const healedIds = new Set(stuck.map((s) => s.id));
      for (const t of allThemes) if (t.deliverableId && healedIds.has(t.deliverableId)) t.deliverableId = null;
    }

    const context = await assembleProjectContext(org, strategy.projectId);

    const themes = allThemes.filter((t) => !t.deliverableId); // skip already produced

    let produced = 0;
    let failed = 0;
    let skippedByBudget = 0;

    // Orçamento de tempo: para de INICIAR novos temas perto do maxDuration da
    // rota, senão a plataforma mata o request no meio e deixa peças travadas.
    const TIME_BUDGET_MS = 240_000;

    await pool(themes, 3, async (theme) => {
      if (Date.now() - startedAt > TIME_BUDGET_MS) {
        skippedByBudget++;
        return;
      }
      const type = toType(theme.format);
      const channel = toChannel(theme.channel);
      const format = FORMAT_CATALOG[type];

      const deliverable = await prisma.deliverable.create({
        data: {
          organizationId: org,
          projectId: strategy.projectId,
          themeId: theme.id,
          channel,
          type,
          title: `${format.label(channel)} · ${theme.title}`,
          brief: themeBrief(theme),
          status: "generating",
          createdBy: sub,
        },
      });
      // Link the theme → deliverable up front so a re-run won't duplicate it.
      await prisma.theme.update({ where: { id: theme.id }, data: { deliverableId: deliverable.id } });

      try {
        const out = await produceInline(deliverable.id, type, channel, themeBrief(theme), context, theme.title, { organizationId: org });
        await prisma.deliverable.update({
          where: { id: deliverable.id },
          data: {
            spec: out.spec as object,
            confidence: out.confidence,
            evaluationScore: out.evaluationScore,
            status: "internal_review",
          },
        });
        produced++;
      } catch {
        // Desfaz o placeholder e destrava o tema — senão o tema fica linkado a
        // um deliverable vazio para sempre e o re-clique nunca o reproduz.
        await prisma.theme.update({ where: { id: theme.id }, data: { deliverableId: null } }).catch(() => {});
        await prisma.deliverable.delete({ where: { id: deliverable.id } }).catch(() => {});
        failed++;
      }
    });

    return ok({ produced, failed, skipped: skippedByBudget, totalThemes: themes.length }, 201);
  });
}
