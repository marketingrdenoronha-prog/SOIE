import { Injectable, NotFoundException } from "@nestjs/common";
import { QUEUES, enqueue } from "@soie/queue";
import type { OrchestrationKind } from "@soie/contracts";
import { PrismaService } from "../../common/prisma/prisma.service.js";
import { TenantStore } from "../../common/tenant/tenant-context.js";

/**
 * AI module service. Missions are not run in the request — they are persisted
 * as an OrchestrationRun and enqueued to BullMQ; the worker executes the agent
 * DAG and streams progress back (Architecture Phase 1.2 async contract). The
 * API stays fast and never blocks on an LLM call.
 */
@Injectable()
export class AiService {
  constructor(private readonly prisma: PrismaService) {}

  async listExecutions() {
    const { organizationId } = TenantStore.require();
    return this.prisma.forTenant(organizationId, (tx) =>
      tx.aIExecution.findMany({
        where: { organizationId },
        orderBy: { createdAt: "desc" },
        take: 50,
      }),
    );
  }

  async getRun(runId: string) {
    const { organizationId } = TenantStore.require();
    const run = await this.prisma.forTenant(organizationId, (tx) =>
      tx.orchestrationRun.findFirst({ where: { id: runId, organizationId } }),
    );
    if (!run) throw new NotFoundException("Run not found");
    return run;
  }

  /** Persists the run and enqueues it; returns 202-style { runId, jobId }. */
  async startRun(projectId: string, kind: OrchestrationKind, input: unknown) {
    const { organizationId, userId } = TenantStore.require();

    const run = await this.prisma.forTenant(organizationId, (tx) =>
      tx.orchestrationRun.create({
        data: {
          organizationId,
          projectId,
          kind,
          status: "queued",
          input: (input ?? {}) as object,
          triggeredBy: userId,
        },
      }),
    );

    const jobId = await enqueue(
      QUEUES.orchestrate,
      { runId: run.id, organizationId, projectId, kind, input },
      { jobId: run.id },
    );

    return { runId: run.id, jobId, status: "queued" as const };
  }
}
