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
import { demoAgentOutput, demoDeliverableSpec } from "./ai-demo";

/** Inline AI runtime for serverless (no worker/queue): produces module results
 * and deliverables directly in the request. Uses provider keys from env; when
 * NO key is set it returns rich, structured demo content so every module shows
 * a real, editable result out of the box (free tier). */
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

/** True when at least one real provider key is configured. */
const HAS_AI_KEY = Boolean(
  env.OPENAI_API_KEY || env.ANTHROPIC_API_KEY || env.GEMINI_API_KEY || env.DEEPSEEK_API_KEY,
);

/** JSON schema hint per agent, so a real model returns the exact shape each
 * module reads. Keys mirror what the route handlers consume. */
const OUTPUT_SCHEMA: Partial<Record<AgentKey, string>> = {
  market:
    '{"summary":string,"swot":{"strengths":string[],"weaknesses":string[],"opportunities":string[],"threats":string[]},"trends":string[],"opportunities":string[],"threats":string[],"confidence":"high"|"medium"|"low"}',
  competition:
    '{"summary":string,"competitors":[{"name":string,"url":string,"positioning":string,"strengths":string[],"weaknesses":string[]}],"confidence":"high"|"medium"|"low"}',
  persona:
    '{"name":string,"demographics":object,"psychographics":object,"channels":string[],"awarenessLevel":string,"languageNotes":object,"pains":[{"description":string,"intensity":1-5}],"objections":[{"description":string,"counter":string}],"desires":[{"description":string,"strength":1-5}],"confidence":"high"|"medium"|"low"}',
  language:
    '{"tone":object,"formality":"low"|"medium"|"high","emojisPolicy":object,"do":string[],"dont":string[],"examples":string[],"archetypes":[{"archetype":string,"weight":0-1,"rationale":string}],"vocabulary":[{"kind":string,"term":string,"note":string}],"confidence":"high"|"medium"|"low"}',
  planning:
    '{"positioning":string,"pillars":string[],"objectives":object,"rationale":string,"lines":[{"name":string,"objective":"authority"|"trust"|"educate"|"reduce_objection"|"attract"|"identify"|"position"|"desire"|"relationship"|"convert","funnelStage":"tofu"|"mofu"|"bofu","platforms":string[],"categories":[{"name":string,"themes":[{"title":string}]}]}],"confidence":"high"|"medium"|"low"}',
};

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
  const schema = OUTPUT_SCHEMA[key];
  const jsonRule = schema
    ? `\n\nResponda EXCLUSIVAMENTE com um JSON válido (sem markdown, sem crases, sem texto fora do JSON) neste formato: ${schema}. Preencha em pt-BR com conteúdo específico e acionável para a marca informada.`
    : "\n\nResponda em JSON válido quando fizer sentido; caso contrário, texto claro em pt-BR.";
  return {
    key,
    version: 1,
    systemPrompt: buildAgentPrompt(key) + jsonRule,
    modelPolicy: MODEL_POLICY,
  };
}

/** Extracts a JSON object from a model response that may be wrapped in prose or
 * ```json fences. Returns null if nothing parseable is found. */
function extractJson(text: string): Record<string, unknown> | null {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fenced?.[1], text];
  for (const c of candidates) {
    if (!c) continue;
    try {
      const parsed = JSON.parse(c.trim());
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch {
      /* try next */
    }
    const start = c.indexOf("{");
    const end = c.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        const parsed = JSON.parse(c.slice(start, end + 1));
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
      } catch {
        /* give up on this candidate */
      }
    }
  }
  return null;
}

export async function produceInline(
  runId: string,
  type: DeliverableType,
  channel: Channel,
  brief?: string,
  context?: Record<string, unknown>,
  theme?: string,
): Promise<ProducedDeliverable> {
  // Sem chave: entrega estruturada de demonstração, pronta para revisão.
  if (!HAS_AI_KEY) {
    return {
      type,
      channel,
      spec: demoDeliverableSpec(type, channel, theme ?? brief),
      confidence: "medium",
      evaluationScore: 82,
      rationale: "Gerado em modo demo (sem chave de IA). Edite livremente.",
      costUsd: 0,
      steps: [{ step: "produce", status: "ok", costUsd: 0 }],
    };
  }

  const runner = await makeRunner();
  const produced = await produceDeliverable({ runId, type, channel, brief, theme, context, runner, resolveAgent });

  // Se o modelo não produziu spec estruturado, mas texto solto, tenta extrair
  // JSON; se ainda assim vier vazio, usa a spec demo para não entregar vazio.
  const spec = produced.spec as any;
  if (spec && typeof spec === "object" && "text" in spec && Object.keys(spec).length <= 2) {
    const extracted = extractJson(String(spec.text ?? ""));
    produced.spec = extracted ?? demoDeliverableSpec(type, channel, theme ?? brief);
  }
  return produced;
}

/**
 * Runs one agent and returns its structured output as a plain object, in the
 * shape the calling module expects. Falls back to structured demo content when
 * no key is set or the model didn't return usable JSON — so a module never
 * saves empty.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function runAgent(key: AgentKey, input: any, context?: Record<string, unknown>): Promise<any> {
  if (!HAS_AI_KEY) {
    return { ...demoAgentOutput(key, input), _demo: true };
  }

  const runner = await makeRunner();
  const def = await resolveAgent(key);
  const req: AgentRequest = {
    runId: randomUUID(),
    step: "run",
    agentKey: key,
    agentVersion: def.version,
    context: { retrieved: [], memories: [], previousSteps: {}, ...(context ?? {}) },
    input,
    constraints: { model: "auto", locale: "pt-BR" },
  };

  try {
    const res = await runner.run(def, req);
    const out = res.output as unknown;
    // Structured object → use directly.
    if (out && typeof out === "object" && !Array.isArray(out) && !("text" in (out as any))) {
      return { ...(out as Record<string, unknown>), confidence: res.confidence };
    }
    // Model returned prose/fenced JSON → try to recover the structure.
    const asText = out && typeof out === "object" && "text" in (out as any) ? String((out as any).text) : String(out ?? "");
    const recovered = extractJson(asText);
    if (recovered) return { ...recovered, confidence: (recovered.confidence as string) ?? res.confidence };
    // Nothing usable → structured demo so the module still populates.
    return { ...demoAgentOutput(key, input), confidence: "medium", _demo: true };
  } catch {
    // Provider failed entirely → don't 500 the module; degrade to demo.
    return { ...demoAgentOutput(key, input), confidence: "medium", _demo: true };
  }
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
