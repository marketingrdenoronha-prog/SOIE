import type {
  AgentKey,
  AgentRequest,
  Channel,
  Confidence,
  DeliverableType,
} from "@soie/contracts";
import type { AgentDefinition, AgentRunner } from "../orchestrator/agent-runner.js";
import { FORMAT_CATALOG } from "./catalog.js";

export interface ProduceParams {
  runId: string;
  type: DeliverableType;
  channel: Channel;
  brief?: string;
  /** Business/brand/audience context assembled by the caller (Phase 8.6). */
  context?: Record<string, unknown>;
  runner: AgentRunner;
  resolveAgent: (key: AgentKey) => Promise<AgentDefinition>;
  locale?: string;
}

export interface ProducedDeliverable {
  type: DeliverableType;
  channel: Channel;
  spec: unknown;
  confidence: Confidence;
  evaluationScore: number | null;
  rationale: string;
  costUsd: number;
  steps: Array<{ step: string; status: string; costUsd: number }>;
}

/**
 * Produces one channel/format deliverable through a mini-pipeline:
 * specialist agent (roteiro) → Avaliador (rubric score) → Crítico (adversarial
 * check). The specialist's system prompt is augmented with the format's
 * instruction so the same agent yields the right roteiro shape per format.
 */
export async function produceDeliverable(p: ProduceParams): Promise<ProducedDeliverable> {
  const format = FORMAT_CATALOG[p.type];
  const steps: ProducedDeliverable["steps"] = [];

  const run = async (key: AgentKey, step: string, input: unknown, extra?: string) => {
    const base = await p.resolveAgent(key);
    const def: AgentDefinition = extra
      ? { ...base, systemPrompt: `${base.systemPrompt}\n\n${extra}` }
      : base;
    const req: AgentRequest = {
      runId: p.runId,
      step,
      agentKey: key,
      agentVersion: def.version,
      context: { retrieved: [], memories: [], previousSteps: {}, ...(p.context ?? {}) },
      input,
      constraints: { model: "auto", locale: p.locale ?? "pt-BR" },
    };
    const res = await p.runner.run(def, req);
    steps.push({ step, status: res.status, costUsd: res.usage.costUsd });
    return res;
  };

  const produced = await run(
    format.agent,
    "produce",
    { type: p.type, channel: p.channel, brief: p.brief },
    format.instruction,
  );

  const evaluated = await run("evaluator", "evaluate", produced.output);
  await run("critic", "critique", produced.output);

  const evaluationScore = extractScore(evaluated.output);
  const costUsd = steps.reduce((s, x) => s + x.costUsd, 0);

  return {
    type: p.type,
    channel: p.channel,
    spec: produced.output,
    confidence: produced.confidence,
    evaluationScore,
    rationale: produced.rationale,
    costUsd,
    steps,
  };
}

function extractScore(output: unknown): number | null {
  if (output && typeof output === "object" && "score" in output) {
    const s = (output as { score: unknown }).score;
    if (typeof s === "number") return Math.round(s);
  }
  return null;
}
