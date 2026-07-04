import type { AIProvider } from "@soie/contracts";
import type {
  CompletionRequest,
  CompletionResult,
  EmbeddingRequest,
  EmbeddingResult,
  ProviderAdapter,
} from "../types.js";

/**
 * Placeholder adapter. Each vendor gets its own subclass wiring the real HTTP
 * SDK; this base returns a deterministic stub so the orchestrator, cost
 * accounting and pipelines can be exercised end-to-end without live API keys.
 * Swap `callProvider` for the real client per provider.
 */
export abstract class BaseAdapter implements ProviderAdapter {
  abstract readonly provider: AIProvider;

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const startedAt = Date.now();
    const text = await this.callProvider(req);
    const inputTokens = estimateTokens(req.messages.map((m) => m.content).join("\n"));
    const outputTokens = estimateTokens(text);
    return {
      provider: this.provider,
      model: req.model,
      text,
      usage: { inputTokens, outputTokens },
      latencyMs: Date.now() - startedAt,
      finishReason: "stop",
    };
  }

  async embed(req: EmbeddingRequest): Promise<EmbeddingResult> {
    const vectors = req.input.map(() => new Array(1536).fill(0));
    return {
      provider: this.provider,
      model: req.model,
      vectors,
      usage: { inputTokens: estimateTokens(req.input.join(" ")), outputTokens: 0 },
    };
  }

  /** Override with the real vendor SDK call. */
  protected async callProvider(req: CompletionRequest): Promise<string> {
    const last = req.messages.at(-1)?.content ?? "";
    return `[stub:${this.provider}:${req.model}] ${last.slice(0, 80)}`;
  }
}

/** Rough token estimate (~4 chars/token) for stubbing and pre-flight budgets. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
