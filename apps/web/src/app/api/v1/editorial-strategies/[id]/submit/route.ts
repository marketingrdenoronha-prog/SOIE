import { randomBytes } from "node:crypto";
import { prisma } from "@soie/db";
import { requireAuth } from "@/server/auth";
import { ok, handle, Errors } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /editorial-strategies/:id/submit
 * Opens (or reuses) a client approval link and moves the strategy into
 * pending_client. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { org, sub } = requireAuth(req);
    const { id } = await params;
    const strategy = await prisma.editorialStrategy.findFirst({
      where: { id, organizationId: org },
      select: { id: true, organizationId: true, status: true, reviewLinks: { where: { status: "open" }, take: 1 } },
    });
    if (!strategy) throw Errors.notFound("Linha editorial");

    const existing = strategy.reviewLinks[0];
    const token = existing?.token ?? randomBytes(24).toString("base64url");

    if (!existing) {
      await prisma.editorialReviewLink.create({
        data: { organizationId: org, strategyId: strategy.id, token, createdBy: sub },
      });
    }
    await prisma.editorialStrategy.update({
      where: { id: strategy.id },
      data: { status: "pending_client", submittedAt: new Date() },
    });

    return ok({ token, reviewUrl: `/editorial-review/${token}` });
  });
}
