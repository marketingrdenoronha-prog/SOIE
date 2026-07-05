import { prisma } from "@soie/db";
import { requestChangesInput } from "@soie/contracts";
import { ok, handle, Errors } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  return handle(async () => {
    const { token } = await params;
    const input = requestChangesInput.parse(await req.json());
    const strategy = await prisma.editorialStrategy.findUnique({
      where: { reviewToken: token },
      select: { id: true, organizationId: true, positioning: true },
    });
    if (!strategy) throw Errors.notFound("Link");

    await prisma.$transaction([
      prisma.editorialStrategy.update({
        where: { id: strategy.id },
        data: { status: "changes_requested", clientComment: input.comment, reviewedBy: input.authorName ?? "Cliente" },
      }),
      prisma.notification.create({
        data: {
          organizationId: strategy.organizationId,
          userId: strategy.organizationId,
          type: "strategy_changes_requested",
          title: `Cliente pediu ajuste na linha editorial${strategy.positioning ? `: ${strategy.positioning}` : ""}`,
          body: input.comment.slice(0, 160),
          data: { strategyId: strategy.id },
        },
      }),
    ]);
    return ok({ status: "changes_requested" });
  });
}
