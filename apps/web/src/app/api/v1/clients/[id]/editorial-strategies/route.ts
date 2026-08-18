import { prisma } from "@soie/db";
import { z } from "zod";
import { requireAuth } from "@/server/auth";
import { ok, handle, Errors } from "@/server/http";
import { generateNextStrategyVersion } from "@/server/editorial-version";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Geração em lotes com top-up faz várias chamadas de IA — precisa de janela.
export const maxDuration = 300;

const createInput = z
  .object({
    brief: z.string().max(4000).optional(),
    objective: z.string().max(500).optional(),
    observations: z.string().max(4000).optional(),
    momento: z.string().max(500).optional(),
    formatCounts: z
      .object({
        video: z.number().int().min(0).max(50).optional(),
        motion: z.number().int().min(0).max(50).optional(),
        carrossel: z.number().int().min(0).max(50).optional(),
        estatico: z.number().int().min(0).max(50).optional(),
      })
      .optional(),
    // Configuração INDIVIDUAL de telas por carrossel. slideCount inteiro 2–8.
    carouselConfigs: z
      .array(z.object({ index: z.number().int().min(0).max(49), slideCount: z.number().int().min(2).max(8) }))
      .max(50)
      .optional(),
  })
  // A API não confia na UI: a quantidade de configs precisa bater exatamente
  // com a quantidade de carrosséis pedida.
  .superRefine((v, ctx) => {
    const carrossel = v.formatCounts?.carrossel ?? 0;
    const configs = v.carouselConfigs ?? [];
    if (carrossel > 0 && configs.length > 0 && configs.length !== carrossel) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["carouselConfigs"], message: `Configure exatamente ${carrossel} carrossel(éis) (recebido ${configs.length}).` });
    }
    if (carrossel === 0 && configs.length > 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["carouselConfigs"], message: "Sem carrosséis, não deve haver configuração de telas." });
    }
    const seen = new Set<number>();
    for (const c of configs) {
      if (c.index >= Math.max(carrossel, configs.length)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["carouselConfigs"], message: `Índice de carrossel fora do intervalo: ${c.index}.` });
      if (seen.has(c.index)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["carouselConfigs"], message: `Índice de carrossel duplicado: ${c.index}.` });
      seen.add(c.index);
    }
  });

/** Converte carouselConfigs (index+slideCount) numa lista ordenada de telas. */
function toCarouselSlides(configs: { index: number; slideCount: number }[] | undefined, carrossel: number): number[] | undefined {
  if (!carrossel) return undefined;
  const out = Array.from({ length: carrossel }, () => 5);
  for (const c of configs ?? []) {
    if (c.index >= 0 && c.index < carrossel) out[c.index] = Math.min(8, Math.max(2, Math.round(c.slideCount)));
  }
  return out;
}

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
    await ensureClient(org, clientId);

    // Ponto único de geração de versão (compartilhado com o ajuste da linha):
    // dobra o feedback do cliente da versão anterior, garante quantidade por
    // formato e nunca sobrescreve (a anterior vira parentStrategyId).
    const strategy = await generateNextStrategyVersion(org, clientId, {
      brief: input.brief,
      objective: input.objective,
      observations: input.observations,
      momento: input.momento,
      formatCounts: input.formatCounts,
      carouselSlides: toCarouselSlides(input.carouselConfigs, input.formatCounts?.carrossel ?? 0),
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
