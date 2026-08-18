import { z } from "zod";
import { prisma } from "@soie/db";
import { ok, handle, Errors } from "@/server/http";
import { pushPieceEvent, syncStrategyStage } from "@/server/production-flow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const input = z.object({
  comment: z.string().min(1).max(4000),
  authorName: z.string().max(200).optional(),
});

/** POST /public/production/:token/pieces/:deliverableId/request-changes
 * Cliente pede alteração em UMA peça: só ela volta para produção; as demais
 * permanecem aprovadas. O comentário fica registrado. */
export async function POST(req: Request, { params }: { params: Promise<{ token: string; deliverableId: string }> }) {
  return handle(async () => {
    const { token, deliverableId } = await params;
    const { comment, authorName } = input.parse(await req.json());

    const strategy = await prisma.editorialStrategy.findFirst({
      where: { productionPortalToken: token },
      select: { id: true, organizationId: true },
    });
    if (!strategy) throw Errors.notFound("Portal");

    const piece = await prisma.deliverable.findFirst({
      where: { id: deliverableId, organizationId: strategy.organizationId },
      select: { id: true, title: true, productionStatus: true, history: true, createdBy: true },
    });
    if (!piece) throw Errors.notFound("Peça");

    const who = authorName?.trim() || "Cliente";
    await prisma.$transaction([
      prisma.deliverable.update({
        where: { id: piece.id },
        data: {
          // Só esta peça volta para produção.
          productionStatus: "em_producao",
          history: pushPieceEvent(piece.history, { type: "approval", to: "em_producao", byName: who, note: `Cliente pediu ajuste: ${comment}` }),
        },
      }),
      prisma.reviewComment.create({
        data: { organizationId: strategy.organizationId, deliverableId: piece.id, decision: "request_changes", comment, authorName: who },
      }),
      prisma.deliverableComment.create({
        data: { organizationId: strategy.organizationId, deliverableId: piece.id, authorName: who, role: "cliente", body: comment },
      }),
      prisma.notification.create({
        data: {
          organizationId: strategy.organizationId,
          userId: piece.createdBy ?? strategy.organizationId,
          type: "production_piece_changes_requested",
          title: `Cliente pediu ajuste: ${piece.title}`,
          body: comment.slice(0, 160),
          data: { deliverableId: piece.id, strategyId: strategy.id },
        },
      }),
    ]);

    // A linha volta a refletir produção em andamento (Designer/Audiovisual).
    await syncStrategyStage(strategy.organizationId, strategy.id, { id: null, name: who });

    return ok({ productionStatus: "em_producao" });
  });
}
