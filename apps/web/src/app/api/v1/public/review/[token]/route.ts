import { prisma } from "@soie/db";
import { ok, handle, Errors } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Public review view — no auth; the opaque token is the capability. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  return handle(async () => {
    const { token } = await params;
    const link = await prisma.reviewLink.findUnique({
      where: { token },
      include: { deliverable: { include: { project: { include: { brand: true } } } } },
    });
    if (!link || link.status === "revoked") throw Errors.notFound("Link");
    if (link.expiresAt && link.expiresAt < new Date()) throw Errors.gone("Link expirado");

    await prisma.reviewLink.update({ where: { id: link.id }, data: { lastViewedAt: new Date() } });
    const d = link.deliverable;
    const comments = await prisma.reviewComment.findMany({
      where: { deliverableId: d.id },
      orderBy: { createdAt: "asc" },
    });

    return ok({
      token,
      status: d.status,
      brand: d.project.brand.name,
      project: d.project.name,
      deliverable: { title: d.title, channel: d.channel, type: d.type, spec: d.spec },
      history: comments.map((c) => ({
        decision: c.decision,
        comment: c.comment,
        at: c.createdAt.toISOString(),
        author: c.authorName,
      })),
    });
  });
}
