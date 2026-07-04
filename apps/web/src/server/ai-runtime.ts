import { randomUUID } from "node:crypto";
import { prisma } from "@soie/db";
import {
  AIGateway,
  AgentRunner,
  buildAgentPrompt,
  defaultModelPolicy,
  produceDeliverable,
  type AgentDefinition,
  type ModelPrice,
  type ModelPolicy,
  type ProducedDeliverable,
} from "@soie/ai";
import { env } from "@soie/config";
import type { AgentKey, AgentRequest, Channel, DeliverableType } from "@soie/contracts";

/** Inline AI runtime for serverless (no worker/queue): produces a deliverable's
 * roteiro directly in the request. Uses provider keys from env; falls back to
 * deterministic stubs when no key is set, so it works for free out of the box. */
const providerKeys = {
  openai: env.OPENAI_API_KEY,
  anthropic: env.ANTHROPIC_API_KEY,
  gemini: env.GEMINI_API_KEY,
  deepseek: env.DEEPSEEK_API_KEY,
};
const gateway = new AIGateway(providerKeys);

/** Chain built from whichever keys are actually configured. Set OPENAI_API_KEY
 * and gpt-4o becomes the preferred model automatically. */
const MODEL_POLICY: ModelPolicy = defaultModelPolicy(providerKeys);

/** Models that can appear in the policy chain — primed into the price cache. */
const PRICEABLE_MODELS = [
  MODEL_POLICY.preferred,
  ...MODEL_POLICY.fallback,
].map((t) => `${t.provider}:${t.model}`);

async function resolvePrice(provider: string, model: string): Promise<ModelPrice> {
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

async function resolveAgent(key: AgentKey): Promise<AgentDefinition> {
  return {
    key,
    version: 1,
    systemPrompt: buildAgentPrompt(key),
    modelPolicy: MODEL_POLICY,
  };
}

export async function produceInline(
  runId: string,
  type: DeliverableType,
  channel: Channel,
  brief?: string,
  context?: Record<string, unknown>,
): Promise<ProducedDeliverable> {
  const runner = await makeRunner();
  return produceDeliverable({ runId, type, channel, brief, context, runner, resolveAgent });
}

/** Runs one agent with an arbitrary JSON input and returns its parsed output as
 * a plain object. If the agent (or stub) returns non-JSON text, wraps it in
 * `{ text }` so callers always get an object. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function runAgent(key: AgentKey, input: any): Promise<any> {
  const runner = await makeRunner();
  const def = await resolveAgent(key);
  const req: AgentRequest = {
    runId: randomUUID(),
    step: "run",
    agentKey: key,
    agentVersion: def.version,
    context: { retrieved: [], memories: [], previousSteps: {} },
    input,
    constraints: { model: "auto", locale: "pt-BR" },
  };
  const res = await runner.run(def, req);
  const out = res.output as unknown;
  if (out && typeof out === "object" && !Array.isArray(out)) {
    return { ...(out as Record<string, unknown>), confidence: res.confidence };
  }
  return { text: String(out ?? ""), confidence: res.confidence };
}

async function makeRunner(): Promise<AgentRunner> {
  const cache = new Map<string, ModelPrice>();
  for (const key of PRICEABLE_MODELS) {
    const [p, m] = key.split(":") as [string, string];
    cache.set(key, await resolvePrice(p, m));
  }
  return new AgentRunner({
    gateway,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolvePrice: (p, m) => cache.get(`${p}:${m}`) ?? { provider: p as any, model: m, inputPricePer1k: 0.003, outputPricePer1k: 0.015 },
  });
}
