import { AIGateway, AgentRunner, type ModelPrice } from "@soie/ai";
import { env } from "@soie/config";
import { resolvePrice } from "./agent-resolver.js";

/** Shared AI runtime for all processors: one gateway (keyed from env) and a
 * runner whose sync price lookup is served from a primed cache. */
export const gateway = new AIGateway({
  openai: env.OPENAI_API_KEY,
  anthropic: env.ANTHROPIC_API_KEY,
  gemini: env.GEMINI_API_KEY,
  deepseek: env.DEEPSEEK_API_KEY,
});

const COMMON_MODELS = [
  "anthropic:claude-sonnet",
  "openai:gpt-4o",
  "gemini:gemini-1.5-pro",
];

export async function makePricedRunner(): Promise<AgentRunner> {
  const cache = new Map<string, ModelPrice>();
  for (const key of COMMON_MODELS) {
    const [provider, model] = key.split(":") as [string, string];
    cache.set(key, await resolvePrice(provider, model));
  }
  return new AgentRunner({
    gateway,
    resolvePrice: (provider, model) =>
      cache.get(`${provider}:${model}`) ?? {
        provider: provider as ModelPrice["provider"],
        model,
        inputPricePer1k: 0.003,
        outputPricePer1k: 0.015,
      },
  });
}
