import { z } from "zod";
import { Confidence } from "./common.js";

/** The 12 agents of the council (Constitution §7, Architecture Phase 4). */
export const AgentKey = z.enum([
  "client",
  "market",
  "competition",
  "persona",
  "language",
  "copy",
  "seo",
  "social",
  "calendar",
  "evaluator",
  "critic",
  "planning",
  "scriptwriter", // roteiros de vídeo (reel, tiktok, youtube, ads)
  "designer", // briefings de design (estático, carrossel, thumbnail)
  "motion", // roteiros de motion design
  "ads", // criativos e copy de anúncios
]);
export type AgentKey = z.infer<typeof AgentKey>;

export const AIProvider = z.enum(["openai", "anthropic", "gemini", "deepseek"]);
export type AIProvider = z.infer<typeof AIProvider>;

export const OrchestrationKind = z.enum([
  "research",
  "strategy",
  "editorial_line",
  "calendar",
  "content",
]);
export type OrchestrationKind = z.infer<typeof OrchestrationKind>;

/** Orchestrator → Agent request (Architecture Phase 4.4). */
export const agentRequest = z.object({
  runId: z.string().uuid(),
  step: z.string(),
  agentKey: AgentKey,
  agentVersion: z.number().int(),
  context: z.object({
    business: z.unknown().optional(),
    audienceSignals: z.unknown().optional(),
    brandVoice: z.unknown().optional(),
    retrieved: z
      .array(z.object({ source: z.string(), content: z.string() }))
      .default([]),
    memories: z.array(z.object({ kind: z.string(), content: z.string() })).default([]),
    previousSteps: z.record(z.unknown()).default({}),
  }),
  input: z.unknown(),
  constraints: z.object({
    maxCostUsd: z.number().positive().optional(),
    model: z.string().default("auto"),
    locale: z.string().default("pt-BR"),
  }),
});
export type AgentRequest = z.infer<typeof agentRequest>;

/** Agent → Orchestrator response. rationale + citations are mandatory for
 * strategic outputs (Constitution P2 & P7). */
export const agentResponse = z.object({
  runId: z.string().uuid(),
  step: z.string(),
  status: z.enum(["ok", "needs_more_data", "error"]),
  output: z.unknown(),
  confidence: Confidence,
  missingData: z.array(z.string()).default([]),
  rationale: z.string(),
  citations: z
    .array(z.object({ source: z.string(), quote: z.string() }))
    .default([]),
  usage: z.object({
    provider: AIProvider,
    model: z.string(),
    inputTokens: z.number().int().nonnegative(),
    outputTokens: z.number().int().nonnegative(),
    costUsd: z.number().nonnegative(),
  }),
});
export type AgentResponse = z.infer<typeof agentResponse>;

export const chatMessageInput = z.object({
  projectId: z.string().uuid().optional(),
  chatId: z.string().uuid().optional(),
  agentKey: AgentKey.default("planning"),
  message: z.string().min(1),
});
export type ChatMessageInput = z.infer<typeof chatMessageInput>;
