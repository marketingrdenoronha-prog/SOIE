import type { AgentKey, OrchestrationKind } from "@soie/contracts";

export interface PipelineStep {
  step: string;
  agentKey: AgentKey;
  /** Steps that must finish before this one starts. Empty = can start immediately. */
  dependsOn: string[];
}

/**
 * Static pipeline definitions per mission kind (Architecture Phase 4.5).
 * The orchestrator reads these as a DAG: independent steps run in parallel,
 * dependent steps wait. Every producing pipeline ends with evaluator + critic
 * (Constitution §9 self-critique before delivery).
 */
export const PIPELINES: Record<OrchestrationKind, PipelineStep[]> = {
  research: [
    { step: "client", agentKey: "client", dependsOn: [] },
    { step: "market", agentKey: "market", dependsOn: ["client"] },
    { step: "competition", agentKey: "competition", dependsOn: ["client"] },
    { step: "persona", agentKey: "persona", dependsOn: ["client"] },
    { step: "language", agentKey: "language", dependsOn: ["persona"] },
    { step: "evaluate", agentKey: "evaluator", dependsOn: ["market", "competition", "language"] },
    { step: "critique", agentKey: "critic", dependsOn: ["evaluate"] },
  ],
  strategy: [
    { step: "plan", agentKey: "planning", dependsOn: [] },
    { step: "critique", agentKey: "critic", dependsOn: ["plan"] },
    { step: "evaluate", agentKey: "evaluator", dependsOn: ["critique"] },
  ],
  editorial_line: [
    { step: "plan", agentKey: "planning", dependsOn: [] },
    { step: "critique", agentKey: "critic", dependsOn: ["plan"] },
  ],
  calendar: [
    { step: "calendar", agentKey: "calendar", dependsOn: [] },
    { step: "critique", agentKey: "critic", dependsOn: ["calendar"] },
  ],
  content: [
    { step: "copy", agentKey: "copy", dependsOn: [] },
    { step: "seo", agentKey: "seo", dependsOn: ["copy"] },
    { step: "social", agentKey: "social", dependsOn: ["seo"] },
    { step: "evaluate", agentKey: "evaluator", dependsOn: ["social"] },
    { step: "critique", agentKey: "critic", dependsOn: ["evaluate"] },
  ],
};
