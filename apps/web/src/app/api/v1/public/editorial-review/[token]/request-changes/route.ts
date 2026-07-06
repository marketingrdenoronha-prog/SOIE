import { prisma } from "@soie/db";
import { requestChangesInput } from "@soie/contracts";
import { ok, handle, Errors } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  return handle(async () => {
    const { token } = await params;
    const input = requestChangesInput.parse(await req.json());
    const link = await prisma.editorialReviewLink.findUnique({
      where: { token },
      include: { strategy: true },
    });
    if (!link || link.status === "revoked") throw Errors.notFound("Link");
    const s = link.strategy;

    await prisma.$transaction([
      prisma.editorialReviewComment.create({
        data: {
          organizationId: s.organizationId,
          strategyId: s.id,
          decision: "request_changes",
          comment: input.comment,
          authorName: input.authorName ?? "Cliente",
        },
      }),
      prisma.editorialStrategy.update({
        where: { id: s.id },
        data: { status: "changes_requested", changesRequestedAt: new Date() },
      }),
      prisma.notification.create({
        data: {
          organizationId: s.organizationId,
          userId: link.createdBy ?? s.organizationId,
          type: "editorial_strategy_changes_requested",
          title: `Cliente pediu ajuste na linha editorial V${s.version}`,
          body: input.comment.slice(0, 160),
          data: { strategyId: s.id },
        },
      }),
    ]);
    return ok({ status: "changes_requested" });
  });
}
