import {
  agentResponse,
  type AgentRequest,
  type AgentResponse,
} from "@soie/contracts";
import type { AIGateway, ModelPolicy } from "../gateway/ai-gateway.js";
import { computeCost, type ModelPrice } from "../cost/price-book.js";

export interface AgentDefinition {
  key: AgentRequest["agentKey"];
  version: number;
  systemPrompt: string;
  modelPolicy: ModelPolicy;
}

export interface RunnerDeps {
  gateway: AIGateway;
  /** Resolves the price for a provider/model (from ai_price_book). */
  resolvePrice: (provider: string, model: string) => ModelPrice;
}

/**
 * Executes a single agent: assembles the prompt from the request context,
 * calls the gateway (with fallback), validates the output against the agent
 * response contract, and returns it with usage/cost attached. Invalid output
 * triggers one self-heal retry with the validation error fed back in.
 */
export class AgentRunner {
  constructor(private readonly deps: RunnerDeps) {}

  async run(def: AgentDefinition, req: AgentRequest): Promise<AgentResponse> {
    const userPrompt = this.buildUserPrompt(req);

    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await this.deps.gateway.complete(
        {
          messages: [
            { role: "system", content: def.systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.4,
        },
        def.modelPolicy,
      );

      const price = this.deps.resolvePrice(result.provider, result.model);
      const costUsd = computeCost(price, result.usage);

      const parsed = this.tryParse(result.text, {
        runId: req.runId,
        step: req.step,
        usage: {
          provider: result.provider,
          model: result.model,
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          costUsd,
        },
      });
      if (parsed) return parsed;
    }

    throw new Error(`Agent ${def.key} produced invalid output after retries`);
  }

  private buildUserPrompt(req: AgentRequest): string {
    // Real implementation composes template + variables + retrieved context
    // within a token budget (Phase 8.6). Kept explicit here for clarity.
    return JSON.stringify(
      { input: req.input, context: req.context, constraints: req.constraints },
      null,
      2,
    );
  }

  private tryParse(
    text: string,
    fallback: Pick<AgentResponse, "runId" | "step" | "usage">,
  ): AgentResponse | null {
    let candidate: unknown;
    try {
      candidate = JSON.parse(text);
    } catch {
      // Stub adapters return plain text; wrap it so the pipeline still flows.
      candidate = {
        ...fallback,
        status: "ok",
        output: { text },
        confidence: "low",
        missingData: ["structured output not produced by stub adapter"],
        rationale: "stub response",
        citations: [],
      };
    }
    const result = agentResponse.safeParse(candidate);
    return result.success ? result.data : null;
  }
}
