import type { AIProvider } from "@soie/contracts";
import type {
  CompletionRequest,
  CompletionResult,
  EmbeddingRequest,
  EmbeddingResult,
  ProviderAdapter,
} from "./types.js";
import { ProviderError } from "./types.js";
import { buildAdapters, type ProviderKeys } from "./adapters/index.js";

export interface ModelPolicy {
  /** Preferred provider/model per task; "auto" lets the gateway pick. */
  preferred: { provider: AIProvider; model: string };
  /** Ordered fallback chain used when the preferred provider fails. */
  fallback: Array<{ provider: AIProvider; model: string }>;
}

export interface GatewayResult extends CompletionResult {
  /** Set when the preferred provider failed and a fallback answered. */
  fallbackFrom?: AIProvider;
}

/**
 * Multi-provider gateway (Architecture Phase 8.1–8.2). Normalizes OpenAI,
 * Anthropic, Gemini and DeepSeek behind one interface and applies the model
 * policy's fallback chain on retryable failures.
 */
export class AIGateway {
  private readonly adapters: Record<AIProvider, ProviderAdapter>;

  /** Pass provider keys to enable real HTTP adapters, or a ready-made adapter
   * map (tests). With neither, all providers use deterministic stubs. */
  constructor(opts?: ProviderKeys | { adapters: Record<AIProvider, ProviderAdapter> }) {
    if (opts && "adapters" in opts) {
      this.adapters = opts.adapters;
    } else {
      this.adapters = buildAdapters(opts);
    }
  }

  async complete(
    req: Omit<CompletionRequest, "provider" | "model">,
    policy: ModelPolicy,
  ): Promise<GatewayResult> {
    const chain = [policy.preferred, ...policy.fallback];
    let lastError: unknown;

    for (let i = 0; i < chain.length; i++) {
      const target = chain[i]!;
      const adapter = this.adapters[target.provider];
      try {
        const result = await adapter.complete({
          ...req,
          provider: target.provider,
          model: target.model,
        });
        return i === 0
          ? result
          : { ...result, fallbackFrom: policy.preferred.provider };
      } catch (err) {
        lastError = err;
        const retryable = err instanceof ProviderError ? err.retryable : true;
        if (!retryable) break;
      }
    }
    throw lastError ?? new Error("AIGateway: all providers failed");
  }

  async embed(req: EmbeddingRequest & { provider: AIProvider }): Promise<EmbeddingResult> {
    return this.adapters[req.provider].embed(req);
  }
}
