import { prisma } from "@soie/db";
import { approveInput } from "@soie/contracts";
import { ok, handle, Errors } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  return handle(async () => {
    const { token } = await params;
    const input = approveInput.parse(await req.json().catch(() => ({})));
    const link = await prisma.editorialReviewLink.findUnique({
      where: { token },
      include: { strategy: true },
    });
    if (!link || link.status === "revoked") throw Errors.notFound("Link");
    const s = link.strategy;
    const now = new Date();

    await prisma.$transaction([
      prisma.editorialReviewComment.create({
        data: {
          organizationId: s.organizationId,
          strategyId: s.id,
          decision: "approve",
          authorName: input.authorName ?? "Cliente",
        },
      }),
      prisma.editorialStrategy.update({
        where: { id: s.id },
        data: { status: "approved", approvedAt: now, changesRequestedAt: null },
      }),
      ...(s.clientId
        ? [prisma.client.update({ where: { id: s.clientId }, data: { activeStrategyId: s.id } })]
        : []),
      prisma.editorialReviewLink.update({ where: { id: link.id }, data: { status: "decided" } }),
      prisma.notification.create({
        data: {
          organizationId: s.organizationId,
          userId: link.createdBy ?? s.organizationId,
          type: "editorial_strategy_approved",
          title: `Cliente aprovou a linha editorial V${s.version}`,
          data: { strategyId: s.id },
        },
      }),
    ]);
    return ok({ status: "approved" });
  });
}
