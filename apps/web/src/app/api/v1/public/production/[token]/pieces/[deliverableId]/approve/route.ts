import { z } from "zod";
import { prisma } from "@soie/db";
import { ok, handle, Errors } from "@/server/http";
import { pushPieceEvent, syncStrategyStage } from "@/server/production-flow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const input = z.object({ authorName: z.string().max(200).optional() });

/** POST /public/production/:token/pieces/:deliverableId/approve
 * Cliente aprova UMA peça. As demais permanecem como estão. Quando todas as
 * peças forem aprovadas, a linha vai automaticamente para "A Postar". */
export async function POST(req: Request, { params }: { params: Promise<{ token: string; deliverableId: string }> }) {
  return handle(async () => {
    const { token, deliverableId } = await params;
    const { authorName } = input.parse(await req.json().catch(() => ({})));

    const strategy = await prisma.editorialStrategy.findFirst({
      where: { productionPortalToken: token },
      select: { id: true, organizationId: true, version: true },
    });
    if (!strategy) throw Errors.notFound("Portal");

    const piece = await prisma.deliverable.findFirst({
      where: { id: deliverableId, organizationId: strategy.organizationId },
      select: { id: true, title: true, productionStatus: true, history: true, createdBy: true },
    });
    if (!piece) throw Errors.notFound("Peça");
    if (piece.productionStatus === "aprovada") return ok({ productionStatus: "aprovada" });
    if (piece.productionStatus !== "aprovacao_cliente") {
      throw Errors.badRequest("Esta peça não está disponível para aprovação do cliente.");
    }

    const who = authorName?.trim() || "Cliente";
    await prisma.$transaction([
      prisma.deliverable.update({
        where: { id: piece.id },
        data: {
          productionStatus: "aprovada",
          history: pushPieceEvent(piece.history, { type: "approval", to: "aprovada", byName: who, note: "Cliente aprovou a peça" }),
        },
      }),
      prisma.reviewComment.create({
        data: { organizationId: strategy.organizationId, deliverableId: piece.id, decision: "approve", authorName: who },
      }),
      prisma.notification.create({
        data: {
          organizationId: strategy.organizationId,
          userId: piece.createdBy ?? strategy.organizationId,
          type: "production_piece_approved",
          title: `Cliente aprovou a peça: ${piece.title}`,
          data: { deliverableId: piece.id, strategyId: strategy.id },
        },
      }),
    ]);

    // Recalcula a coluna da linha — quando todas aprovadas, vai para A Postar.
    await syncStrategyStage(strategy.organizationId, strategy.id, { id: null, name: who });

    return ok({ productionStatus: "aprovada" });
  });
}
