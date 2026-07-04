import { randomUUID } from "node:crypto";
import { prisma } from "@soie/db";
import {
  AIGateway,
  AgentRunner,
  produceDeliverable,
  type AgentDefinition,
  type ModelPrice,
  type ProducedDeliverable,
} from "@soie/ai";
import { env } from "@soie/config";
import type { AgentKey, AgentRequest, Channel, DeliverableType } from "@soie/contracts";

/** Inline AI runtime for serverless (no worker/queue): produces a deliverable's
 * roteiro directly in the request. Uses provider keys from env; falls back to
 * deterministic stubs when no key is set, so it works for free out of the box. */
const gateway = new AIGateway({
  openai: env.OPENAI_API_KEY,
  anthropic: env.ANTHROPIC_API_KEY,
  gemini: env.GEMINI_API_KEY,
  deepseek: env.DEEPSEEK_API_KEY,
});

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
    systemPrompt: `Você é o Agente ${key} do SOIE. Siga a Constituição: contexto antes de conteúdo, justifique decisões, responda em pt-BR.`,
    modelPolicy: {
      preferred: { provider: "anthropic", model: "claude-sonnet-5" },
      fallback: [{ provider: "openai", model: "gpt-4o" }],
    },
  };
}

export async function produceInline(
  runId: string,
  type: DeliverableType,
  channel: Channel,
  brief?: string,
): Promise<ProducedDeliverable> {
  const cache = new Map<string, ModelPrice>();
  for (const key of ["anthropic:claude-sonnet-5", "openai:gpt-4o"]) {
    const [p, m] = key.split(":") as [string, string];
    cache.set(key, await resolvePrice(p, m));
  }
  const runner = new AgentRunner({
    gateway,
    resolvePrice: (p, m) =>
      cache.get(`${p}:${m}`) ?? { provider: p as any, model: m, inputPricePer1k: 0.003, outputPricePer1k: 0.015 },
  });
  return produceDeliverable({ runId, type, channel, brief, runner, resolveAgent });
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
  for (const key of ["anthropic:claude-sonnet-5", "openai:gpt-4o"]) {
    const [p, m] = key.split(":") as [string, string];
    cache.set(key, await resolvePrice(p, m));
  }
  return new AgentRunner({
    gateway,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolvePrice: (p, m) => cache.get(`${p}:${m}`) ?? { provider: p as any, model: m, inputPricePer1k: 0.003, outputPricePer1k: 0.015 },
  });
}
