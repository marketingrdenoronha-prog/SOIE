import { randomBytes } from "node:crypto";
import { prisma } from "@soie/db";
import { requireAuth } from "@/server/auth";
import { ok, handle, Errors } from "@/server/http";
import { appendHistory } from "@/server/production-stage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /editorial-strategies/:id/submit — "Enviar para Cliente".
 * Abre (ou reusa) o link de aprovação do cliente, move a linha para
 * pending_client E a coloca na esteira de Produção em "Em Revisão do Cliente",
 * registrando a movimentação no histórico. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { org, sub } = requireAuth(req);
    const { id } = await params;
    const strategy = await prisma.editorialStrategy.findFirst({
      where: { id, organizationId: org },
      select: {
        id: true,
        organizationId: true,
        status: true,
        productionStage: true,
        stageHistory: true,
        reviewLinks: { where: { status: "open" }, take: 1 },
      },
    });
    if (!strategy) throw Errors.notFound("Linha editorial");

    const existing = strategy.reviewLinks[0];
    const token = existing?.token ?? randomBytes(24).toString("base64url");
    if (!existing) {
      await prisma.editorialReviewLink.create({
        data: { organizationId: org, strategyId: strategy.id, token, createdBy: sub },
      });
    }

    const user = await prisma.user.findUnique({ where: { id: sub }, select: { name: true } });
    const resend = strategy.productionStage === "client_review";
    const history = appendHistory(strategy.stageHistory, {
      from: strategy.productionStage,
      to: "client_review",
      at: new Date().toISOString(),
      byId: sub,
      byName: user?.name ?? null,
      note: resend ? "Reenviado para o cliente" : "Enviado para o cliente",
    });

    await prisma.editorialStrategy.update({
      where: { id: strategy.id },
      data: {
        status: "pending_client",
        submittedAt: new Date(),
        productionStage: "client_review",
        responsibleUserId: sub,
        stageHistory: history,
      },
    });

    return ok({ token, reviewUrl: `/editorial-review/${token}` });
  });
}
