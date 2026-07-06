import { prisma } from "@soie/db";
import { approveInput } from "@soie/contracts";
import { ok, handle, Errors } from "@/server/http";
import { appendHistory } from "@/server/production-stage";

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
    const authorName = input.authorName ?? "Cliente";
    const history = appendHistory(s.stageHistory, {
      from: s.productionStage,
      to: "approved",
      at: now.toISOString(),
      byId: null,
      byName: authorName,
      note: `Cliente aprovou a linha editorial V${s.version}`,
    });

    await prisma.$transaction([
      prisma.editorialReviewComment.create({
        data: {
          organizationId: s.organizationId,
          strategyId: s.id,
          decision: "approve",
          authorName,
        },
      }),
      prisma.editorialStrategy.update({
        where: { id: s.id },
        data: {
          status: "approved",
          approvedAt: now,
          changesRequestedAt: null,
          productionStage: "approved",
          stageHistory: history,
        },
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
