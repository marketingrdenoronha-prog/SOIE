import { prisma } from "@soie/db";
import type { Channel, DeliverableType } from "@soie/contracts";
import { requireAuth } from "@/server/auth";
import { ok, handle, Errors } from "@/server/http";
import { produceInline } from "@/server/ai-runtime";
import { assembleProjectContext } from "@/server/project-context";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Regenerate a deliverable, folding the client's change requests into the brief
 * so the new roteiro addresses the feedback. Bumps the version and returns to
 * internal review for the team to check before re-sending to the client.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const { id } = await params;

    const deliverable = await prisma.deliverable.findFirst({
      where: { id, organizationId: org },
      include: {
        comments: { where: { decision: "request_changes" }, orderBy: { createdAt: "desc" }, take: 10 },
      },
    });
    if (!deliverable) throw Errors.notFound("Entrega");

    const feedback = deliverable.comments
      .map((c) => c.comment)
      .filter(Boolean)
      .join("\n- ");
    const brief = [
      deliverable.brief,
      feedback ? `Ajustes pedidos pelo cliente:\n- ${feedback}` : "",
    ].filter(Boolean).join("\n\n");

    const context = await assembleProjectContext(org, deliverable.projectId);

    await prisma.deliverable.update({ where: { id }, data: { status: "generating" } });

    let produced;
    try {
      produced = await produceInline(
        id,
        deliverable.type as DeliverableType,
        deliverable.channel as Channel,
        brief || undefined,
        context,
      );
    } catch (err) {
      await prisma.deliverable.update({ where: { id }, data: { status: "internal_review" } });
      throw err;
    }

    const updated = await prisma.deliverable.update({
      where: { id },
      data: {
        spec: produced.spec as object,
        confidence: produced.confidence,
        evaluationScore: produced.evaluationScore,
        status: "internal_review",
        version: { increment: 1 },
      },
    });

    return ok({ deliverable: updated });
  });
}
