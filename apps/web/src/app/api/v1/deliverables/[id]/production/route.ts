import { prisma } from "@soie/db";
import { requireAuth } from "@/server/auth";
import { ok, handle, Errors } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /deliverables/:id/production
 * Detalhe completo de uma peça para o painel de produção: conteúdo (spec/brief),
 * status, responsável, assets versionados, comentários e histórico. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const { id } = await params;

    const piece = await prisma.deliverable.findFirst({
      where: { id, organizationId: org },
      include: {
        assets: { orderBy: { version: "desc" } },
        threadComments: { orderBy: { createdAt: "asc" } },
        comments: { orderBy: { createdAt: "asc" } },
      },
    });
    if (!piece) throw Errors.notFound("Peça");

    let assignedName: string | null = null;
    if (piece.assignedToId) {
      const u = await prisma.user.findUnique({ where: { id: piece.assignedToId }, select: { name: true } });
      assignedName = u?.name ?? null;
    }
    return ok({ piece: { ...piece, assignedName } });
  });
}
