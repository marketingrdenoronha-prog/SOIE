import { randomBytes } from "node:crypto";
import { prisma } from "@soie/db";
import { requireAuth } from "@/server/auth";
import { ok, handle, Errors } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /editorial/:id/review → send the editorial strategy for client approval:
 * mark it in_review and mint (or reuse) an opaque token for the public link. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const { id } = await params;

    const strategy = await prisma.editorialStrategy.findFirst({
      where: { id, organizationId: org },
      select: { id: true, reviewToken: true },
    });
    if (!strategy) throw Errors.notFound("Estratégia");

    const token = strategy.reviewToken ?? randomBytes(24).toString("base64url");
    await prisma.editorialStrategy.update({
      where: { id },
      data: { status: "in_review", reviewToken: token, approvedAt: null, clientComment: null },
    });

    return ok({ token, reviewUrl: `/strategy-review/${token}` });
  });
}
