import { prisma } from "@soie/db";
import { buildAgentPrompt, defaultModelPolicy, type AgentDefinition, type ModelPrice } from "@soie/ai";
import { env } from "@soie/config";
import type { AgentKey } from "@soie/contracts";

/** Provider chain built from whichever keys are configured (env). Set
 * OPENAI_API_KEY and gpt-4o becomes the preferred model automatically, instead
 * of the gateway getting stuck on a deterministic stub that never fails. */
const MODEL_POLICY = defaultModelPolicy({
  openai: env.OPENAI_API_KEY,
  anthropic: env.ANTHROPIC_API_KEY,
  gemini: env.GEMINI_API_KEY,
  deepseek: env.DEEPSEEK_API_KEY,
});

/**
 * Resolves the active agent definition from the DB (agents + agent_versions +
 * prompt_versions). Falls back to a sane default when a version/prompt is not
 * yet configured, so runs never hard-fail on missing config. The default prompt
 * includes the agent's structured output contract so queued runs produce the
 * same shape the inline (serverless) flow does.
 */
export async function resolveAgent(key: AgentKey): Promise<AgentDefinition> {
  const agent = await prisma.agent.findFirst({
    where: { key, organizationId: null },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });
  const version = agent?.versions[0];
  const configuredPrompt = (version?.modelPolicy as any)?.systemPrompt as string | undefined;
  return {
    key,
    version: version?.version ?? 1,
    systemPrompt: configuredPrompt ?? buildAgentPrompt(key),
    modelPolicy: MODEL_POLICY,
  };
}

/** Reads the current price for a provider/model from ai_price_book. */
export async function resolvePrice(provider: string, model: string): Promise<ModelPrice> {
  const row = await prisma.aIPriceBook.findFirst({
    where: { provider: provider as any, model, effectiveTo: null },
    orderBy: { effectiveFrom: "desc" },
  });
  return {
    provider: provider as ModelPrice["provider"],
    model,
    inputPricePer1k: row?.inputPricePer1k ?? 0.003,
    outputPricePer1k: row?.outputPricePer1k ?? 0.015,
  };
}
