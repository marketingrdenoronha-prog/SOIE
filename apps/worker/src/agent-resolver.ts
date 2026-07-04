import { prisma } from "@soie/db";
import type { AgentDefinition, ModelPrice } from "@soie/ai";
import type { AgentKey } from "@soie/contracts";

/**
 * Resolves the active agent definition from the DB (agents + agent_versions +
 * prompt_versions). Falls back to a sane default when a version/prompt is not
 * yet configured, so runs never hard-fail on missing config.
 */
export async function resolveAgent(key: AgentKey): Promise<AgentDefinition> {
  const agent = await prisma.agent.findFirst({
    where: { key, organizationId: null },
    include: { versions: { orderBy: { version: "desc" }, take: 1 } },
  });
  const version = agent?.versions[0];
  return {
    key,
    version: version?.version ?? 1,
    systemPrompt:
      (version?.modelPolicy as any)?.systemPrompt ??
      `Você é o Agente ${key} do SOIE. Siga a Constituição do sistema: contexto antes de conteúdo, pesquisa antes de opinião, e justifique cada decisão. Responda em pt-BR.`,
    // Model IDs used against each provider's real API. Configurable per agent
    // version later; these are sensible defaults with cross-provider fallback.
    modelPolicy: {
      preferred: { provider: "anthropic", model: "claude-sonnet-5" },
      fallback: [
        { provider: "openai", model: "gpt-4o" },
        { provider: "gemini", model: "gemini-1.5-pro" },
      ],
    },
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
