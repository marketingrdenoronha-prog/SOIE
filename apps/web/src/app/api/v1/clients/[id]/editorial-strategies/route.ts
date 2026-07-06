import { prisma } from "@soie/db";
import { z } from "zod";
import { requireAuth } from "@/server/auth";
import { ok, handle, Errors } from "@/server/http";
import { runAgent } from "@/server/ai-runtime";
import { assembleProjectContext } from "@/server/project-context";
import { resolveDefaultProjectId } from "@/server/client-scope";
import { coerceTheme, type GenerationContext } from "@/server/editorial-content";
import { toFormatKey } from "@/lib/editorial-format";

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

    // As três leituras são independentes — uma onda paralela em vez de três
    // round-trips sequenciais ao banco (relevante em lambda + Neon).
    const [project, previous, context] = await Promise.all([
      prisma.project.findFirst({
        where: { id: projectId, organizationId: org },
        include: { brand: true, personas: { include: { pains: true, desires: true } } },
      }),
      prisma.editorialStrategy.findFirst({
        where: { organizationId: org, clientId },
        orderBy: [{ version: "desc" }, { createdAt: "desc" }],
        include: { reviewComments: { orderBy: { createdAt: "desc" }, take: 3 } },
      }),
      assembleProjectContext(org, projectId),
    ]);
    if (!project) throw Errors.notFound("Projeto");

    const nextVersion = (previous?.version ?? 0) + 1;
    const feedback = previous?.reviewComments
      ?.filter((c) => c.decision === "request_changes" && c.comment)
      .map((c) => c.comment)
      .join("\n");
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
    }, context, { organizationId: org });

    // Cada tema sai PRONTO PARA PRODUÇÃO: coage/valida a saída (real ou demo)
    // para o shape padronizado, preenchendo faltas com profundidade.
    const genCtx: GenerationContext = {
      brand: project.brand.name,
      niche: project.brand.positioning ?? client.name,
      objective: input.objective,
      observations: input.observations,
    };
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
        // Conteúdo demo (sem chave de IA ou provider caiu) não pode se passar
        // por estratégia real: marca no rationale e rebaixa a confiança.
        rationale: result._demo ? `[MODO DEMO — configure uma chave de IA] ${result.rationale ?? ""}`.trim() : result.rationale,
        confidence: result._demo ? "low" : ((result.confidence as "high" | "medium" | "low") ?? "medium"),
        status: "draft",
        editorialLines: {
          create: (result.lines ?? []).map((line: {
            name: string; objective: string; funnelStage: string; platforms?: string[]; categories?: { name: string; themes?: { title: string; channel?: string; format?: string; copy?: unknown }[] }[];
          }) => ({
            organizationId: org,
            name: line.name,
            objective: line.objective as never,
            funnelStage: line.funnelStage as never,
            platforms: line.platforms ?? [],
            categories: {
              create: (line.categories ?? []).map((cat) => ({
                organizationId: org,
                name: cat.name,
                themes: {
                  create: (cat.themes ?? []).map((raw) => {
                    const t = coerceTheme(raw, genCtx, themeIndex);
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
          })),
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
