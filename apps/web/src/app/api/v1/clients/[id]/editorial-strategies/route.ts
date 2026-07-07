import { prisma } from "@soie/db";
import { z } from "zod";
import { requireAuth } from "@/server/auth";
import { ok, handle, Errors } from "@/server/http";
import { assembleProjectContext } from "@/server/project-context";
import { resolveDefaultProjectId } from "@/server/client-scope";
import { type GenerationContext } from "@/server/editorial-content";
import { generateEditorialThemes, bucketsToLines } from "@/server/editorial-generation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Geração em lotes com top-up faz várias chamadas de IA — precisa de janela.
export const maxDuration = 300;

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

    // `niche` = o SEGMENTO/MERCADO do cliente (campo `industry`). NUNCA o nome do
    // cliente: usar o nome aqui fazia a IA tratar o próprio nome como se fosse o
    // nicho ("empresas de <Nome do Cliente>"), gerando conteúdo fora de contexto.
    const genCtx: GenerationContext = {
      brand: project.brand.name,
      niche: client.industry?.trim() || "seu mercado",
      objective: input.objective,
      observations: input.observations,
    };

    // Geração com GARANTIA DE QUANTIDADE: lotes + top-up até bater o solicitado
    // por formato; a rede de segurança completa o que faltar. Nunca sai parcial.
    const gen = await generateEditorialThemes({
      baseInput: {
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
        brief: [input.brief, input.observations, feedback ? `Feedback do cliente na versão anterior:\n${feedback}` : ""]
          .filter(Boolean)
          .join("\n\n"),
      },
      requested: input.formatCounts,
      genCtx,
      context,
      organizationId: org,
      now: Date.now(),
    });

    const { meta } = gen;
    const strategy = await prisma.editorialStrategy.create({
      data: {
        organizationId: org,
        clientId,
        projectId,
        version: nextVersion,
        parentStrategyId: previous?.id,
        positioning: meta.positioning,
        pillars: (meta.pillars as object) ?? [],
        objectives: (meta.objectives as object) ?? {},
        // Conteúdo demo (sem chave de IA ou provider caiu) não pode se passar
        // por estratégia real: marca no rationale e rebaixa a confiança.
        rationale: meta._demo ? `[MODO DEMO — configure uma chave de IA] ${meta.rationale ?? ""}`.trim() : meta.rationale,
        confidence: meta._demo ? "low" : ((meta.confidence as "high" | "medium" | "low") ?? "medium"),
        status: "draft",
        editorialLines: { create: bucketsToLines(gen.themesByFormat, org) },
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
    select: { id: true, name: true, industry: true },
  });
  if (!client) throw Errors.notFound("Cliente");
  return client;
}
