import { prisma } from "@soie/db";
import { z } from "zod";
import { requireAuth } from "@/server/auth";
import { ok, handle, Errors } from "@/server/http";
import { assembleProjectContext } from "@/server/project-context";
import { rewriteEditorialTheme } from "@/server/ai-runtime";
import { enforceCarouselCopy } from "@/server/editorial-content";
import { effectiveSlideCount, formatDuration, type StructuredCopy } from "@/lib/editorial-format";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const input = z.object({
  // Instruções manuais; se ausente, usa o adjustmentNote já salvo no conteúdo.
  instructions: z.string().max(4000).optional(),
});


/**
 * POST /editorial-strategies/:id/themes/:themeId/rewrite
 *
 * AJUSTE MANUAL por conteúdo: a IA reescreve APENAS este conteúdo a partir das
 * instruções manuais (prioridade máxima), fundamentada no briefing + Base de
 * Conhecimento. NENHUM outro conteúdo da linha é tocado. Grava só neste tema.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string; themeId: string }> }) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const { id, themeId } = await params;
    const body = input.parse(await req.json().catch(() => ({})));

    const theme = await prisma.theme.findFirst({
      where: { id: themeId, organizationId: org, category: { editorialLine: { strategyId: id } } },
      select: {
        id: true, title: true, format: true, channel: true, strategicObjective: true,
        hook: true, cta: true, productionNotes: true, copy: true, adjustmentNote: true,
        category: { select: { editorialLine: { select: { strategy: { select: { id: true, projectId: true, clientId: true, status: true } } } } } },
      },
    });
    if (!theme) throw Errors.notFound("Conteúdo");

    const strategy = theme.category.editorialLine.strategy;
    if (strategy.status === "approved") {
      throw Errors.badRequest("Linha já aprovada — reabra ou gere uma nova versão para ajustar conteúdos.");
    }

    const instructions = (body.instructions ?? theme.adjustmentNote ?? "").trim();
    if (!instructions) throw Errors.badRequest("Escreva as instruções do ajuste manual deste conteúdo.");

    const client = strategy.clientId
      ? await prisma.client.findFirst({ where: { id: strategy.clientId, organizationId: org }, select: { name: true, industry: true } })
      : null;

    const context = await assembleProjectContext(org, strategy.projectId);

    // Preserva a estrutura escolhida (telas do carrossel, duração do vídeo/
    // motion) — só muda se as instruções manuais pedirem explicitamente.
    const currentCopy = theme.copy as StructuredCopy | null;
    const currentSlideCount = effectiveSlideCount(currentCopy);
    const currentDuration = typeof currentCopy?.durationSeconds === "number" ? currentCopy.durationSeconds : undefined;

    const result = await rewriteEditorialTheme(
      {
        instructions,
        slideCount: currentSlideCount,
        durationSeconds: currentDuration,
        theme: {
          title: theme.title, format: theme.format, channel: theme.channel,
          strategicObjective: theme.strategicObjective, hook: theme.hook, cta: theme.cta,
          productionNotes: theme.productionNotes, copy: theme.copy,
        },
        clientName: client?.name,
        niche: client?.industry ?? undefined,
      },
      context,
      { organizationId: org },
    );

    // Repara a estrutura: carrossel mantém a contagem de telas; vídeo/motion
    // mantém a duração. Estático passa intacto.
    const resultCopy = result.copy as StructuredCopy | undefined;
    const fmt = resultCopy?.format ?? currentCopy?.format;
    let finalCopy: unknown = result.copy ?? theme.copy;
    if (fmt === "carrossel") {
      finalCopy = enforceCarouselCopy(resultCopy, currentSlideCount ?? 5, { brand: client?.name ?? "", niche: client?.industry ?? "seu mercado" }, 0);
    } else if ((fmt === "video" || fmt === "motion") && currentDuration) {
      finalCopy = { ...(resultCopy ?? currentCopy ?? { format: fmt }), format: fmt, durationSeconds: currentDuration, estimatedDuration: formatDuration(currentDuration) };
    }

    // Grava SOMENTE neste tema. Marca como "revisar" para o operador conferir o
    // resultado do ajuste antes de aprovar. adjustmentNote é preservado.
    const updated = await prisma.theme.update({
      where: { id: themeId },
      data: {
        title: result.title ?? theme.title,
        format: result.format ?? theme.format,
        channel: result.channel ?? theme.channel,
        strategicObjective: result.strategicObjective ?? theme.strategicObjective,
        hook: result.hook ?? theme.hook,
        cta: result.cta ?? theme.cta,
        productionNotes: result.productionNotes ?? theme.productionNotes,
        copy: finalCopy as never,
        contentStatus: "revisar",
      },
      select: {
        id: true, title: true, format: true, channel: true, strategicObjective: true,
        hook: true, cta: true, productionNotes: true, copy: true, contentStatus: true, adjustmentNote: true,
      },
    });

    return ok({ theme: updated, demo: Boolean(result._demo) });
  });
}
