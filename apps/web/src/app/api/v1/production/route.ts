import { prisma } from "@soie/db";
import { requireAuth } from "@/server/auth";
import { ok, handle } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /production — the designer/filmmaker queue across all clients: every
 * deliverable that is being produced or moving through review, with its client
 * so the operator can jump straight into the client's production board. */
export async function GET(req: Request) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const deliverables = await prisma.deliverable.findMany({
      where: {
        organizationId: org,
        status: { in: ["generating", "draft", "internal_review", "client_review", "changes_requested", "approved"] },
      },
      orderBy: { updatedAt: "desc" },
      take: 300,
      include: {
        project: { select: { name: true, brand: { select: { name: true, client: { select: { id: true, name: true } } } } } },
        reviewLinks: { orderBy: { createdAt: "desc" }, take: 1 },
        originTheme: { select: { title: true } },
      },
    });

    return ok(
      deliverables.map((d) => ({
        id: d.id,
        title: d.title,
        channel: d.channel,
        type: d.type,
        status: d.status,
        theme: d.originTheme?.title ?? null,
        clientId: d.project.brand.client?.id ?? null,
        clientName: d.project.brand.client?.name ?? d.project.brand.name,
        token: d.reviewLinks[0]?.token ?? null,
        updatedAt: d.updatedAt,
      })),
    );
  });
}
