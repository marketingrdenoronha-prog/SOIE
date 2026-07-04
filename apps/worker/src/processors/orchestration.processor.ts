import type { Job } from "@soie/queue";
import { prisma } from "@soie/db";
import { logger } from "@soie/config";
import {
  AIGateway,
  AgentRunner,
  Orchestrator,
  computeCost,
} from "@soie/ai";
import type { OrchestrationKind } from "@soie/contracts";
import { env } from "@soie/config";
import { resolveAgent, resolvePrice } from "../agent-resolver.js";

export interface OrchestrationJob {
  runId: string;
  organizationId: string;
  projectId: string;
  kind: OrchestrationKind;
  input: unknown;
}

const gateway = new AIGateway({
  openai: env.OPENAI_API_KEY,
  anthropic: env.ANTHROPIC_API_KEY,
  gemini: env.GEMINI_API_KEY,
  deepseek: env.DEEPSEEK_API_KEY,
});

/**
 * Runs one mission end-to-end: executes the agent DAG, writes an AIExecution
 * row per step (cost/tokens accounting), streams progress into the run's steps
 * array, and finalizes the run status. This is the async backbone the API
 * enqueues to (Architecture Phase 1.8 / 4.3).
 */
export async function processOrchestration(job: Job<OrchestrationJob>): Promise<void> {
  const { runId, organizationId, projectId, kind, input } = job.data;
  const log = logger.child({ runId, organizationId, module: "orchestration" });

  const priceCache = new Map<string, Awaited<ReturnType<typeof resolvePrice>>>();
  const runner = new AgentRunner({
    gateway,
    resolvePrice: (provider, model) => {
      // Runner needs sync price; prime the cache before the run (below).
      return priceCache.get(`${provider}:${model}`) ?? {
        provider: provider as any,
        model,
        inputPricePer1k: 0.003,
        outputPricePer1k: 0.015,
      };
    },
  });

  // Prime price cache for the models this run may touch.
  for (const p of ["anthropic:claude-sonnet", "openai:gpt-4o", "gemini:gemini-1.5-pro"]) {
    const [provider, model] = p.split(":") as [string, string];
    priceCache.set(p, await resolvePrice(provider, model));
  }

  const steps: unknown[] = [];
  const orchestrator = new Orchestrator({
    runner,
    resolveAgent,
    onStep: async (step) => {
      steps.push(step);
      // Persist an AIExecution row for the step's LLM usage.
      if (step.response) {
        const u = step.response.usage;
        await prisma.aIExecution.create({
          data: {
            organizationId,
            orchestrationRunId: runId,
            provider: u.provider,
            model: u.model,
            inputTokens: u.inputTokens,
            outputTokens: u.outputTokens,
            costUsd: u.costUsd,
            status: step.status === "ok" ? "success" : "error",
            error: step.error,
          },
        });
      }
      await prisma.orchestrationRun.update({
        where: { id: runId },
        data: { steps: steps as object },
      });
      log.info({ step: step.step, status: step.status }, "step finished");
    },
  });

  const result = await orchestrator.run({ runId, organizationId, projectId, kind, input });

  await prisma.orchestrationRun.update({
    where: { id: runId },
    data: {
      status: result.status,
      totalCost: result.totalCostUsd,
      steps: result.steps as unknown as object,
      finishedAt: new Date(),
    },
  });
  log.info({ status: result.status, cost: result.totalCostUsd }, "run finished");
  void computeCost; // exported helper available for richer per-step pricing
}
