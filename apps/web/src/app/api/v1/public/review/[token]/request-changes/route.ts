import { prisma } from "@soie/db";
import { requestChangesInput } from "@soie/contracts";
import { ok, handle, Errors } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  return handle(async () => {
    const { token } = await params;
    const input = requestChangesInput.parse(await req.json());
    const link = await prisma.reviewLink.findUnique({
      where: { token },
      include: { deliverable: true },
    });
    if (!link || link.status === "revoked") throw Errors.notFound("Link");
    const d = link.deliverable;

    await prisma.$transaction([
      prisma.reviewComment.create({
        data: {
          organizationId: d.organizationId,
          deliverableId: d.id,
          reviewLinkId: link.id,
          decision: "request_changes",
          comment: input.comment,
          authorName: input.authorName ?? "Cliente",
        },
      }),
      prisma.deliverable.update({ where: { id: d.id }, data: { status: "changes_requested" } }),
      prisma.notification.create({
        data: {
          organizationId: d.organizationId,
          userId: d.createdBy ?? d.organizationId,
          type: "deliverable_changes_requested",
          title: `Cliente pediu ajuste: ${d.title}`,
          body: input.comment.slice(0, 160),
          data: { deliverableId: d.id },
        },
      }),
    ]);
    return ok({ status: "changes_requested" });
  });
}
