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
 * SOIE roda EXCLUSIVAMENTE em Claude Sonnet 5: só `anthropic` participa da
 * cadeia. gpt-4o, gemini e deepseek foram removidos de propósito — mesmo que a
 * chave deles esteja setada, não são usados. Se a `ANTHROPIC_API_KEY` não estiver
 * presente, cai no modo demo (sem custo), nunca em outro provedor pago.
 */
const PREFERENCE_ORDER: AIProvider[] = ["anthropic"];

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
      : // Sem chave: chain só com Anthropic (Sonnet 5). O runtime já cai em modo
        // demo quando não há chave — este stub mantém orquestrador/pipelines
        // rodando offline sem referenciar outro provedor.
        [{ provider: "anthropic", model: DEFAULT_MODELS.anthropic }];

  if (override) {
    const rest = chain.filter(
      (t) => !(t.provider === override.provider && t.model === override.model),
    );
    return { preferred: override, fallback: rest };
  }

  const [preferred, ...fallback] = chain;
  return { preferred: preferred!, fallback };
}
