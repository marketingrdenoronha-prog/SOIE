import type { Job } from "@soie/queue";
import { prisma } from "@soie/db";
import { logger } from "@soie/config";
import { produceDeliverable } from "@soie/ai";
import type { Channel, DeliverableType } from "@soie/contracts";
import { resolveAgent } from "../agent-resolver.js";
import { makePricedRunner } from "../runtime.js";

export interface DeliverableJob {
  kind: "deliverable";
  deliverableId: string;
  organizationId: string;
  projectId: string;
  channel: Channel;
  type: DeliverableType;
}

/**
 * Produces one deliverable's roteiro end-to-end and advances its pipeline
 * status. On success it lands in `internal_review` (ready for a human to send
 * to the client); on failure it stays visible with the error.
 */
export async function processDeliverable(job: Job<DeliverableJob>): Promise<void> {
  const { deliverableId, organizationId, projectId, channel, type } = job.data;
  const log = logger.child({ deliverableId, module: "deliverable" });

  await prisma.deliverable.update({
    where: { id: deliverableId },
    data: { status: "generating" },
  });

  const deliverable = await prisma.deliverable.findUnique({ where: { id: deliverableId } });
  const runner = await makePricedRunner();

  try {
    const produced = await produceDeliverable({
      runId: deliverableId,
      type,
      channel,
      brief: deliverable?.brief ?? undefined,
      runner,
      resolveAgent,
    });

    // Record an AIExecution row per pipeline step (cost/tokens accounting).
    for (const step of produced.steps) {
      await prisma.aIExecution.create({
        data: {
          organizationId,
          provider: "anthropic",
          model: "claude-sonnet",
          costUsd: step.costUsd,
          status: step.status === "ok" ? "success" : "error",
        },
      });
    }

    await prisma.deliverable.update({
      where: { id: deliverableId },
      data: {
        spec: produced.spec as object,
        confidence: produced.confidence,
        evaluationScore: produced.evaluationScore,
        status: "internal_review",
      },
    });
    log.info({ cost: produced.costUsd, type, channel }, "deliverable produced");
  } catch (err) {
    await prisma.deliverable.update({
      where: { id: deliverableId },
      data: { status: "draft" },
    });
    log.error({ err }, "deliverable production failed");
    throw err;
  }
  void projectId;
}
