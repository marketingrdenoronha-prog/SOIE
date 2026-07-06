import { prisma } from "@soie/db";
import { requireAuth } from "@/server/auth";
import { ok, handle, Errors } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /deliverables/:id/deliver — final step of the flow: mark as delivered
 * (only makes sense once the client approved it). */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const { id } = await params;

    const deliverable = await prisma.deliverable.findFirst({
      where: { id, organizationId: org },
      select: { id: true, status: true },
    });
    if (!deliverable) throw Errors.notFound("Entrega");
    if (deliverable.status !== "approved") {
      throw Errors.badRequest("A entrega precisa estar aprovada pelo cliente antes de marcar como entregue.");
    }

    const updated = await prisma.deliverable.update({
      where: { id },
      data: { status: "delivered", deliveredAt: new Date() },
    });
    return ok({ status: updated.status, deliveredAt: updated.deliveredAt });
  });
}
