import { prisma } from "@soie/db";
import { z } from "zod";
import { requireAuth } from "@/server/auth";
import { ok, handle, Errors } from "@/server/http";
import { runAgent } from "@/server/ai-runtime";
import { assembleProjectContext } from "@/server/project-context";
import { resolveDefaultProjectId } from "@/server/client-scope";
import {
  buildGenerationContext,
  coerceTheme,
  enforceDistribution,
  groupByFormat,
  normalizeFormatCounts,
  type GenerationContext,
} from "@/server/editorial-content";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createInput = z.object({
  brief: z.string().max(4000).optional(),
  objective: z.string().max(500).optional(),
  observations: z.string().max(4000).optional(),
  formatCounts: z
    .object({
      video: z.number().int().min(0).max(50).optional(),
      motion: z.number().int().min(0).max(50).optional(),
      carrossel: z.number().int().min(0).max(50).optional(),
      estatico: z.number().int().min(0).max(50).optional(),
    })
    .optional(),
});

/** GET /clients/:id/editorial-strategies
 * Lists every editorial strategy version for a client (newest first). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const { id: clientId } = await params;
    await ensureClient(org, clientId);

    const strategies = await prisma.editorialStrategy.findMany({
      where: { organizationId: org, clientId },
      include: {
        editorialLines: { include: { categories: { include: { themes: true } } } },
        reviewLinks: { orderBy: { createdAt: "desc" }, take: 1 },
        reviewComments: { orderBy: { createdAt: "desc" }, take: 5 },
      },
      orderBy: [{ version: "desc" }, { createdAt: "desc" }],
    });
    return ok(strategies);
  });
}

/** POST /clients/:id/editorial-strategies
 * Generates a new version. It never overwrites an old strategy: the latest
 * strategy becomes parentStrategyId and the agent receives prior strategies +
 * client feedback via assembleProjectContext. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const { id: clientId } = await params;
    const input = createInput.parse(await req.json().catch(() => ({})));
    const client = await ensureClient(org, clientId);
    const projectId = await resolveDefaultProjectId(clientId, org);

    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: org },
      include: { brand: true, personas: { include: { pains: true, desires: true } } },
    });
    if (!project) throw Errors.notFound("Projeto");

    const previous = await prisma.editorialStrategy.findFirst({
      where: { organizationId: org, clientId },
      orderBy: [{ version: "desc" }, { createdAt: "desc" }],
      include: { reviewComments: { orderBy: { createdAt: "desc" }, take: 3 } },
    });

    const nextVersion = (previous?.version ?? 0) + 1;
    const feedback = previous?.reviewComments
      ?.filter((c) => c.decision === "request_changes" && c.comment)
      .map((c) => c.comment)
      .join("\n");

    const context = await assembleProjectContext(org, projectId);
    const result = await runAgent("planning", {
      brand: project.brand.name,
      client: client.name,
      positioning: project.brand.positioning,
      objectives: project.brand.objectives,
      personas: project.personas.map((p) => ({ name: p.name, pains: p.pains.map((x) => x.description) })),
      version: nextVersion,
      parentStrategyId: previous?.id,
      clientFeedback: feedback || undefined,
      objective: input.objective,
      observations: input.observations,
      formatCounts: input.formatCounts,
      brief: [input.brief, input.observations, feedback ? `Feedback do cliente na versão anterior:\n${feedback}` : ""]
        .filter(Boolean)
        .join("\n\n"),
    }, context);

    // Cada tema sai PRONTO PARA PRODUÇÃO. Contexto rico (dossiê, onboarding,
    // personas, voz da marca) alimenta a copy; a saída é coada/validada e a
    // QUANTIDADE por formato é garantida (corta excedentes, completa faltas).
    const genCtx: GenerationContext = buildGenerationContext(
      { brand: project.brand.name, positioning: project.brand.positioning, objective: input.objective, observations: input.observations },
      context,
    );
    const counts = normalizeFormatCounts(input.formatCounts);

    // Achata os temas gerados (independente de como o modelo agrupou), coage
    // cada um e força a distribuição exata pedida pelo usuário.
    const rawThemes: any[] = (result.lines ?? []).flatMap((l: any) =>
      (l?.categories ?? []).flatMap((c: any) => c?.themes ?? []),
    );
    const coerced = rawThemes.map((raw, i) => coerceTheme(raw, genCtx, i));
    const finalThemes = enforceDistribution(coerced, counts, genCtx);
    const grouped = groupByFormat(finalThemes);

    let themeIndex = 0;
    const strategy = await prisma.editorialStrategy.create({
      data: {
        organizationId: org,
        clientId,
        projectId,
        version: nextVersion,
        parentStrategyId: previous?.id,
        positioning: result.positioning,
        pillars: result.pillars ?? [],
        objectives: result.objectives ?? {},
        rationale: result.rationale,
        confidence: (result.confidence as "high" | "medium" | "low") ?? "medium",
        status: "draft",
        editorialLines: {
          create: [{
            organizationId: org,
            name: "Linha Editorial",
            objective: "authority" as never,
            funnelStage: "tofu" as never,
            platforms: ["instagram"],
            categories: {
              create: grouped.map((cat) => ({
                organizationId: org,
                name: cat.name,
                themes: {
                  create: cat.themes.map((t) => {
                    const priority = themeIndex;
                    themeIndex += 1;
                    return {
                      organizationId: org,
                      title: t.title,
                      channel: t.channel,
                      format: t.format,
                      copy: t.copy as never,
                      strategicObjective: t.strategicObjective,
                      hook: t.hook,
                      cta: t.cta,
                      productionNotes: t.productionNotes,
                      priority,
                    };
                  }),
                },
              })),
            },
          }],
        },
      },
      include: {
        editorialLines: { include: { categories: { include: { themes: true } } } },
        reviewLinks: true,
        reviewComments: true,
      },
    });
    return ok(strategy, 201);
  });
}

async function ensureClient(organizationId: string, clientId: string) {
  const client = await prisma.client.findFirst({
    where: { id: clientId, organizationId, deletedAt: null },
    select: { id: true, name: true },
  });
  if (!client) throw Errors.notFound("Cliente");
  return client;
}
