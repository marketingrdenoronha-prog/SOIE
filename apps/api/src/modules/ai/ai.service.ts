import { Injectable } from "@nestjs/common";
import {
  AIGateway,
  AgentRunner,
  Orchestrator,
  type AgentDefinition,
  type ModelPrice,
} from "@soie/ai";
import type { OrchestrationKind } from "@soie/contracts";
import { PrismaService } from "../../common/prisma/prisma.service.js";
import { TenantStore } from "../../common/tenant/tenant-context.js";

/**
 * Bridges the API to the AI package. In production the actual run is enqueued
 * to BullMQ and executed by a worker; here we wire the orchestrator directly
 * so the flow is exercisable. Agent definitions and prices are resolved from
 * the database (agents/agent_versions, ai_price_book).
 */
@Injectable()
export class AiService {
  private readonly gateway = new AIGateway();
  private readonly runner = new AgentRunner({
    gateway: this.gateway,
    resolvePrice: (provider, model) => this.priceFallback(provider, model),
  });

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

  async startRun(projectId: string, kind: OrchestrationKind, input: unknown) {
    const { organizationId, userId } = TenantStore.require();

    const run = await this.prisma.forTenant(organizationId, (tx) =>
      tx.orchestrationRun.create({
        data: {
          organizationId,
          projectId,
          kind,
          status: "running",
          input: input as object,
          triggeredBy: userId,
          startedAt: new Date(),
        },
      }),
    );

    const orchestrator = new Orchestrator({
      runner: this.runner,
      resolveAgent: (key) => this.resolveAgent(key),
      onStep: async (step) => {
        // Real impl emits WebSocket progress + appends to orchestration_runs.steps
        void step;
      },
    });

    const result = await orchestrator.run({
      runId: run.id,
      organizationId,
      projectId,
      kind,
      input,
    });

    await this.prisma.forTenant(organizationId, (tx) =>
      tx.orchestrationRun.update({
        where: { id: run.id },
        data: {
          status: result.status,
          totalCost: result.totalCostUsd,
          steps: result.steps as unknown as object,
          finishedAt: new Date(),
        },
      }),
    );

    return { runId: run.id, status: result.status, totalCostUsd: result.totalCostUsd };
  }

  private async resolveAgent(
    key: AgentDefinition["key"],
  ): Promise<AgentDefinition> {
    // Simplified: real impl loads the active agent_version + prompt_version.
    return {
      key,
      version: 1,
      systemPrompt: `Você é o Agente ${key} do SOIE. Siga a Constituição do sistema.`,
      modelPolicy: {
        preferred: { provider: "anthropic", model: "claude-sonnet" },
        fallback: [
          { provider: "openai", model: "gpt-4o" },
          { provider: "gemini", model: "gemini-1.5-pro" },
        ],
      },
    };
  }

  private priceFallback(provider: string, model: string): ModelPrice {
    return {
      provider: provider as ModelPrice["provider"],
      model,
      inputPricePer1k: 0.003,
      outputPricePer1k: 0.015,
    };
  }
}
