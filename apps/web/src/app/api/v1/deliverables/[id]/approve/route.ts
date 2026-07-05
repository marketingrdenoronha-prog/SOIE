import { randomBytes } from "node:crypto";
import { prisma } from "@soie/db";
import { requireAuth } from "@/server/auth";
import { ok, handle, Errors } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Internal approval: moves a deliverable from internal review to client review
 * and opens (or reuses) a public review link. Returns the token so the UI can
 * show/copy the client link.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { org, sub } = requireAuth(req);
    const { id } = await params;

    const deliverable = await prisma.deliverable.findFirst({
      where: { id, organizationId: org },
      include: { reviewLinks: { where: { status: "open" }, take: 1 } },
    });
    if (!deliverable) throw Errors.notFound("Entrega");

    let token = deliverable.reviewLinks[0]?.token;
    if (!token) {
      token = randomBytes(24).toString("base64url");
      await prisma.reviewLink.create({
        data: { organizationId: org, deliverableId: id, token, createdBy: sub },
      });
    }

    await prisma.deliverable.update({
      where: { id },
      data: { status: "client_review" },
    });

    return ok({ token, reviewUrl: `/review/${token}` });
  });
}
