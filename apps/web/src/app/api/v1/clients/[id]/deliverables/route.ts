import { prisma } from "@soie/db";
import { requireAuth } from "@/server/auth";
import { ok, handle, Errors } from "@/server/http";
import { resolveDefaultProjectId } from "@/server/client-scope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /clients/:id/deliverables — deliverables of the client's default project,
 * with the originating theme, for the production Kanban. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const { id: clientId } = await params;

    const client = await prisma.client.findFirst({
      where: { id: clientId, organizationId: org, deletedAt: null },
      select: { id: true },
    });
    if (!client) throw Errors.notFound("Cliente");

    const projectId = await resolveDefaultProjectId(clientId, org);
    const deliverables = await prisma.deliverable.findMany({
      where: { organizationId: org, projectId },
      orderBy: { createdAt: "desc" },
      take: 300,
      include: {
        reviewLinks: { orderBy: { createdAt: "desc" }, take: 1 },
        comments: { orderBy: { createdAt: "desc" }, take: 5 },
        originTheme: { select: { id: true, title: true } },
      },
    });
    return ok(deliverables);
  });
}
