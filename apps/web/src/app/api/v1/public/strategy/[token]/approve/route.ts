import { prisma } from "@soie/db";
import { approveInput } from "@soie/contracts";
import { ok, handle, Errors } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  return handle(async () => {
    const { token } = await params;
    const input = approveInput.parse(await req.json().catch(() => ({})));
    const strategy = await prisma.editorialStrategy.findUnique({
      where: { reviewToken: token },
      select: { id: true, organizationId: true, positioning: true },
    });
    if (!strategy) throw Errors.notFound("Link");

    await prisma.$transaction([
      prisma.editorialStrategy.update({
        where: { id: strategy.id },
        data: { status: "approved", approvedAt: new Date(), reviewedBy: input.authorName ?? "Cliente" },
      }),
      prisma.notification.create({
        data: {
          organizationId: strategy.organizationId,
          userId: strategy.organizationId,
          type: "strategy_approved",
          title: `Cliente aprovou a linha editorial${strategy.positioning ? `: ${strategy.positioning}` : ""}`,
          data: { strategyId: strategy.id },
        },
      }),
    ]);
    return ok({ status: "approved" });
  });
}
