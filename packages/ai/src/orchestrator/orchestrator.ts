import type {
  AgentRequest,
  AgentResponse,
  OrchestrationKind,
} from "@soie/contracts";
import type { AgentDefinition, AgentRunner } from "./agent-runner.js";
import { PIPELINES, type PipelineStep } from "./pipelines.js";

export interface OrchestrationInput {
  runId: string;
  organizationId: string;
  projectId: string;
  kind: OrchestrationKind;
  input: unknown;
  locale?: string;
  maxCostUsd?: number;
}

export interface StepResult {
  step: string;
  status: AgentResponse["status"];
  response?: AgentResponse;
  error?: string;
}

export interface OrchestrationResult {
  runId: string;
  status: "succeeded" | "failed" | "partial";
  steps: StepResult[];
  totalCostUsd: number;
}

export interface OrchestratorDeps {
  runner: AgentRunner;
  /** Resolves the active agent definition (version, prompt, model policy). */
  resolveAgent: (key: AgentRequest["agentKey"]) => Promise<AgentDefinition>;
  /** Persist/emit progress after each step (WebSocket + orchestration_runs). */
  onStep?: (result: StepResult) => Promise<void> | void;
}

/**
 * Executes a mission as a DAG of agent steps (Architecture Phase 4.3).
 * Independent steps run concurrently; dependent steps receive prior outputs in
 * their context. A failing step doesn't abort the run — it degrades to partial.
 */
export class Orchestrator {
  constructor(private readonly deps: OrchestratorDeps) {}

  async run(input: OrchestrationInput): Promise<OrchestrationResult> {
    const steps = PIPELINES[input.kind];
    const results = new Map<string, StepResult>();
    let totalCost = 0;

    const pending = new Set(steps.map((s) => s.step));

    while (pending.size > 0) {
      const ready = steps.filter(
        (s) =>
          pending.has(s.step) &&
          s.dependsOn.every((d) => results.get(d)?.status === "ok"),
      );

      if (ready.length === 0) {
        // Remaining steps are blocked by a failed/absent dependency.
        for (const step of pending) {
          results.set(step, {
            step,
            status: "error",
            error: "blocked by failed dependency",
          });
        }
        break;
      }

      const settled = await Promise.all(
        ready.map((s) => this.runStep(input, s, results)),
      );

      for (const r of settled) {
        results.set(r.step, r);
        pending.delete(r.step);
        totalCost += r.response?.usage.costUsd ?? 0;
        await this.deps.onStep?.(r);
      }
    }

    const all = [...results.values()];
    const failures = all.filter((r) => r.status !== "ok").length;
    const status =
      failures === 0 ? "succeeded" : failures === all.length ? "failed" : "partial";

    return { runId: input.runId, status, steps: all, totalCostUsd: totalCost };
  }

  private async runStep(
    input: OrchestrationInput,
    step: PipelineStep,
    prior: Map<string, StepResult>,
  ): Promise<StepResult> {
    try {
      const def = await this.deps.resolveAgent(step.agentKey);
      const previousSteps: Record<string, unknown> = {};
      for (const dep of step.dependsOn) {
        previousSteps[dep] = prior.get(dep)?.response?.output;
      }

      const req: AgentRequest = {
        runId: input.runId,
        step: step.step,
        agentKey: step.agentKey,
        agentVersion: def.version,
        context: {
          retrieved: [],
          memories: [],
          previousSteps,
        },
        input: input.input,
        constraints: {
          model: "auto",
          locale: input.locale ?? "pt-BR",
          maxCostUsd: input.maxCostUsd,
        },
      };

      const response = await this.deps.runner.run(def, req);
      return { step: step.step, status: response.status, response };
    } catch (err) {
      return {
        step: step.step,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }
}
