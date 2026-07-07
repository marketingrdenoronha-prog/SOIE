import type { AIProvider } from "@soie/contracts";
import type { ModelPolicy } from "./ai-gateway.js";
import type { ProviderKeys } from "./adapters/index.js";

/** Default model id per provider used by the platform's agents. */
export const DEFAULT_MODELS: Record<AIProvider, string> = {
  openai: "gpt-4o",
  anthropic: "claude-sonnet-5",
  gemini: "gemini-1.5-pro",
  deepseek: "deepseek-chat",
};

/**
 * Provider preference order. A provider only enters the policy chain when its
 * key is actually configured — this is what stops the gateway from getting
 * stuck on a stubbed provider forever. Because a StubAdapter never throws, the
 * gateway never falls through to the next provider on its own; so the chain
 * must be built from real keys up front.
 *
 * Anthropic is listed first so that setting `ANTHROPIC_API_KEY` immediately makes
 * Claude Sonnet 5 the preferred model — a large jump in copy quality over gpt-4o
 * and gemini-1.5-pro at equal-or-lower cost. OpenAI/Gemini/DeepSeek still lead
 * when they're the only key configured (fallback), preserving offline/free tiers.
 */
const PREFERENCE_ORDER: AIProvider[] = ["anthropic", "openai", "gemini", "deepseek"];

/**
 * Builds a ModelPolicy from the set of configured provider keys.
 *
 * - Only providers with a real key become part of the chain, in preference
 *   order, so the gateway never lands on a deterministic stub while a live
 *   provider is available.
 * - When no key is configured at all, we fall back to a stub-friendly chain so
 *   local/offline runs (tests, demos) still flow end-to-end.
 * - `override` lets a caller force a specific preferred provider/model (e.g. a
 *   per-agent version pin) while keeping the rest of the chain as fallback.
 */
export function defaultModelPolicy(
  keys: ProviderKeys = {},
  override?: { provider: AIProvider; model: string },
): ModelPolicy {
  const available = PREFERENCE_ORDER.filter((p) => Boolean(keys[p]));

  const chain: Array<{ provider: AIProvider; model: string }> =
    available.length > 0
      ? available.map((provider) => ({ provider, model: DEFAULT_MODELS[provider] }))
      : // No keys configured anywhere: keep the historical stub chain so the
        // orchestrator and pipelines still run offline.
        [
          { provider: "openai", model: DEFAULT_MODELS.openai },
          { provider: "anthropic", model: DEFAULT_MODELS.anthropic },
        ];

  if (override) {
    const rest = chain.filter(
      (t) => !(t.provider === override.provider && t.model === override.model),
    );
    return { preferred: override, fallback: rest };
  }

  const [preferred, ...fallback] = chain;
  return { preferred: preferred!, fallback };
}
