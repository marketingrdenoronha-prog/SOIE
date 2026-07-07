import { prisma } from "@soie/db";
import { requireAuth } from "@/server/auth";
import { ok, handle, Errors } from "@/server/http";
import { materializeProductionPieces, syncStrategyStage } from "@/server/production-flow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/** POST /editorial-strategies/:id/start-production
 * Cria as peças de produção da linha aprovada (idempotente) e a coloca na
 * esteira. Útil para linhas aprovadas antes da automação, ou para reprocessar. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { org, sub } = requireAuth(req);
    const { id } = await params;

    const strategy = await prisma.editorialStrategy.findFirst({
      where: { id, organizationId: org },
      select: { id: true, status: true },
    });
    if (!strategy) throw Errors.notFound("Linha editorial");
    if (strategy.status !== "approved") {
      throw Errors.badRequest("A linha precisa estar aprovada pelo cliente para iniciar a produção.");
    }

    const user = await prisma.user.findUnique({ where: { id: sub }, select: { name: true } });
    const created = await materializeProductionPieces(org, id, { id: sub, name: user?.name });
    const stage = await syncStrategyStage(org, id, { id: sub, name: user?.name });

    return ok({ created, productionStage: stage }, 201);
  });
}
