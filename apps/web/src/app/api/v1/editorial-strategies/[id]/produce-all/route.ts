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
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
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

    const context = await assembleProjectContext(org, strategy.projectId);

    const themes = strategy.editorialLines
      .flatMap((l) => l.categories.flatMap((c) => c.themes))
      .filter((t) => !t.deliverableId); // skip already produced

    let produced = 0;
    let failed = 0;

    await pool(themes, 3, async (theme) => {
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
          brief: theme.title,
          status: "generating",
          createdBy: sub,
        },
      });
      // Link the theme → deliverable up front so a re-run won't duplicate it.
      await prisma.theme.update({ where: { id: theme.id }, data: { deliverableId: deliverable.id } });

      try {
        const out = await produceInline(deliverable.id, type, channel, theme.title, context, theme.title);
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
        await prisma.deliverable.update({ where: { id: deliverable.id }, data: { status: "draft" } });
        failed++;
      }
    });

    return ok({ produced, failed, skipped: 0, totalThemes: themes.length }, 201);
  });
}
