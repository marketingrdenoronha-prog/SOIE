import { prisma } from "@soie/db";
import { approveInput } from "@soie/contracts";
import { ok, handle, Errors } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  return handle(async () => {
    const { token } = await params;
    const input = approveInput.parse(await req.json().catch(() => ({})));
    const link = await loadDeliverable(token);
    const d = link.deliverable;

    await prisma.$transaction([
      prisma.reviewComment.create({
        data: {
          organizationId: d.organizationId,
          deliverableId: d.id,
          reviewLinkId: link.id,
          decision: "approve",
          authorName: input.authorName ?? "Cliente",
        },
      }),
      prisma.deliverable.update({ where: { id: d.id }, data: { status: "approved" } }),
      prisma.reviewLink.update({ where: { id: link.id }, data: { status: "decided" } }),
      prisma.notification.create({
        data: {
          organizationId: d.organizationId,
          userId: d.createdBy ?? d.organizationId,
          type: "deliverable_approved",
          title: `Cliente aprovou: ${d.title}`,
          data: { deliverableId: d.id },
        },
      }),
    ]);
    return ok({ status: "approved" });
  });
}

async function loadDeliverable(token: string) {
  const link = await prisma.reviewLink.findUnique({
    where: { token },
    include: { deliverable: true },
  });
  if (!link || link.status === "revoked") throw Errors.notFound("Link");
  return link;
}
