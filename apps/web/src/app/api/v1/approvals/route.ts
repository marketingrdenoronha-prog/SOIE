import { prisma } from "@soie/db";
import { requireAuth } from "@/server/auth";
import { ok, handle } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /approvals — everything waiting on a decision across all clients:
 * editorial strategies pending client approval, deliverables in internal review
 * (waiting on the team) and deliverables with the client (waiting on them). */
export async function GET(req: Request) {
  return handle(async () => {
    const { org } = requireAuth(req);

    const [strategies, deliverables] = await Promise.all([
      prisma.editorialStrategy.findMany({
        where: { organizationId: org, status: { in: ["pending_client", "changes_requested"] } },
        orderBy: { submittedAt: "desc" },
        take: 100,
        include: {
          reviewLinks: { where: { status: "open" }, orderBy: { createdAt: "desc" }, take: 1 },
          project: { select: { brand: { select: { name: true, client: { select: { id: true, name: true } } } } } },
        },
      }),
      prisma.deliverable.findMany({
        where: { organizationId: org, status: { in: ["internal_review", "client_review"] } },
        orderBy: { updatedAt: "desc" },
        take: 200,
        include: {
          reviewLinks: { orderBy: { createdAt: "desc" }, take: 1 },
          project: { select: { brand: { select: { name: true, client: { select: { id: true, name: true } } } } } },
        },
      }),
    ]);

    return ok({
      editorial: strategies.map((s) => ({
        id: s.id,
        version: s.version,
        status: s.status,
        positioning: s.positioning,
        clientId: s.project.brand.client?.id ?? null,
        clientName: s.project.brand.client?.name ?? s.project.brand.name,
        token: s.reviewLinks[0]?.token ?? null,
        submittedAt: s.submittedAt,
      })),
      deliverables: deliverables.map((d) => ({
        id: d.id,
        title: d.title,
        channel: d.channel,
        type: d.type,
        status: d.status,
        clientId: d.project.brand.client?.id ?? null,
        clientName: d.project.brand.client?.name ?? d.project.brand.name,
        token: d.reviewLinks[0]?.token ?? null,
        updatedAt: d.updatedAt,
      })),
    });
  });
}
