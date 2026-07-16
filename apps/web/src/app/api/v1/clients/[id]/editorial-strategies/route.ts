import { prisma } from "@soie/db";
import { z } from "zod";
import { requireAuth } from "@/server/auth";
import { ok, handle, Errors } from "@/server/http";
import { generateNextStrategyVersion } from "@/server/editorial-version";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Geração em lotes com top-up faz várias chamadas de IA — precisa de janela.
export const maxDuration = 300;

const createInput = z.object({
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
