import { prisma } from "@soie/db";
import { Errors } from "@/server/http";
import { assembleProjectContext } from "@/server/project-context";
import { resolveDefaultProjectId } from "@/server/client-scope";
import { type GenerationContext } from "@/server/editorial-content";
import { generateEditorialThemes, bucketsToLines } from "@/server/editorial-generation";
import { type FormatCounts } from "@/lib/editorial-format";

/**
 * Gera a PRÓXIMA versão da linha editorial de um cliente. Ponto ÚNICO de
 * geração de versão — usado tanto por POST /clients/:id/editorial-strategies
 * quanto por POST /editorial-strategies/:id/adjust (ajuste manual/automático).
 *
 * Nunca sobrescreve: a versão mais recente vira `parentStrategyId` e o agente
 * recebe as anteriores + o feedback do cliente via assembleProjectContext.
 * O `niche` sai SEMPRE de `client.industry` (nunca do nome do cliente).
 */
export async function generateNextStrategyVersion(
  organizationId: string,
  clientId: string,
  opts: {
    brief?: string;
    objective?: string;
    observations?: string;
    /** Direção do operador para um ajuste (modo manual). Vai para o brief e as
     * observações de geração. */
    guidance?: string;
    formatCounts?: Partial<FormatCounts>;
  } = {},
) {
  const client = await prisma.client.findFirst({
    where: { id: clientId, organizationId, deletedAt: null },
    select: { id: true, name: true, industry: true },
  });
  if (!client) throw Errors.notFound("Cliente");

  const projectId = await resolveDefaultProjectId(clientId, organizationId);

  const [project, previous, context] = await Promise.all([
    prisma.project.findFirst({
      where: { id: projectId, organizationId },
      include: { brand: true, personas: { include: { pains: true, desires: true } } },
    }),
    prisma.editorialStrategy.findFirst({
      where: { organizationId, clientId },
      orderBy: [{ version: "desc" }, { createdAt: "desc" }],
      include: { reviewComments: { where: { decision: "request_changes" }, orderBy: { createdAt: "desc" }, take: 5 } },
    }),
    assembleProjectContext(organizationId, projectId),
  ]);
  if (!project) throw Errors.notFound("Projeto");

  const nextVersion = (previous?.version ?? 0) + 1;
  const feedback = previous?.reviewComments
    ?.map((c) => c.comment)
    .filter((x): x is string => Boolean(x && x.trim()))
    .join("\n");

  const observations = [opts.observations, opts.guidance].filter(Boolean).join("\n\n") || undefined;

  // `niche` = SEGMENTO/MERCADO do cliente (industry). NUNCA o nome do cliente:
  // usar o nome fazia a IA tratar o próprio nome como se fosse o nicho.
  const genCtx: GenerationContext = {
    brand: project.brand.name,
    niche: client.industry?.trim() || "seu mercado",
    objective: opts.objective,
    observations,
  };

  const brief = [
    opts.brief,
    opts.guidance ? `Direção do operador para o ajuste:\n${opts.guidance}` : "",
    opts.observations,
    feedback ? `Feedback do cliente na versão anterior:\n${feedback}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

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
      objective: opts.objective,
      observations,
      brief,
    },
    requested: opts.formatCounts,
    genCtx,
    context,
    organizationId,
    now: Date.now(),
  });

  const { meta } = gen;
  return prisma.editorialStrategy.create({
    data: {
      organizationId,
      clientId,
      projectId,
      version: nextVersion,
      parentStrategyId: previous?.id,
      positioning: meta.positioning,
      pillars: (meta.pillars as object) ?? [],
      objectives: (meta.objectives as object) ?? {},
      // Conteúdo demo (sem chave de IA) não pode se passar por estratégia real.
      rationale: meta._demo ? `[MODO DEMO — configure uma chave de IA] ${meta.rationale ?? ""}`.trim() : meta.rationale,
      confidence: meta._demo ? "low" : ((meta.confidence as "high" | "medium" | "low") ?? "medium"),
      status: "draft",
      editorialLines: { create: bucketsToLines(gen.themesByFormat, organizationId) },
    },
    include: {
      editorialLines: { include: { categories: { include: { themes: true } } } },
      reviewLinks: true,
      reviewComments: true,
    },
  });
}
