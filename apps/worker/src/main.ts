import { QUEUES, registerWorker } from "@soie/queue";
import { logger } from "@soie/config";
import {
  processOrchestration,
  type OrchestrationJob,
} from "./processors/orchestration.processor.js";
import {
  processDeliverable,
  type DeliverableJob,
} from "./processors/deliverable.processor.js";

/**
 * Worker entrypoint. Registers one processor per queue; scales horizontally by
 * running more instances. IA orchestration is the primary consumer today;
 * embedding/export/email/billing processors slot in the same way.
 */
async function main(): Promise<void> {
  const workers = [
    registerWorker<OrchestrationJob>(QUEUES.orchestrate, processOrchestration, 4),
    registerWorker<DeliverableJob>(QUEUES.agent, processDeliverable, 6),
  ];

  for (const w of workers) {
    w.on("failed", (job, err) =>
      logger.error({ jobId: job?.id, err }, `job failed on ${w.name}`),
    );
  }

  logger.info(`SOIE worker up — consuming: ${workers.map((w) => w.name).join(", ")}`);

  const shutdown = async () => {
    logger.info("worker shutting down");
    await Promise.all(workers.map((w) => w.close()));
    process.exit(0);
  };
  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((err) => {
  logger.error({ err }, "worker failed to start");
  process.exit(1);
});
