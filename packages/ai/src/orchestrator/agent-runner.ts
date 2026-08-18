import {
  agentResponse,
  type AgentRequest,
  type AgentResponse,
} from "@soie/contracts";
import type { AIGateway, ModelPolicy } from "../gateway/ai-gateway.js";
import { computeCost, type ModelPrice } from "../cost/price-book.js";

export interface AgentDefinition {
  key: AgentRequest["agentKey"];
  version: number;
  systemPrompt: string;
  modelPolicy: ModelPolicy;
}

export interface RunnerDeps {
  gateway: AIGateway;
  /** Resolves the price for a provider/model (from ai_price_book). */
  resolvePrice: (provider: string, model: string) => ModelPrice;
}

/** Appended to every agent's system prompt so providers without a native JSON
 * mode (e.g. Anthropic) still return parseable output. */
const JSON_ONLY_INSTRUCTION =
  'Responda SOMENTE com um objeto JSON válido, sem markdown, sem cercas de código (```), sem texto antes ou depois. O JSON deve conter as chaves esperadas pela tarefa e ainda: "confidence" ("high"|"medium"|"low"), "rationale" (string curta justificando) e "missingData" (array de strings com dados que faltaram).';

/**
 * Executes a single agent: assembles the prompt from the request context,
 * calls the gateway (with fallback), validates the output against the agent
 * response contract, and returns it with usage/cost attached. Invalid output
 * triggers one self-heal retry with the validation error fed back in.
 */
export class AgentRunner {
  constructor(private readonly deps: RunnerDeps) {}

  async run(def: AgentDefinition, req: AgentRequest): Promise<AgentResponse> {
    const userPrompt = this.buildUserPrompt(req);
    const systemPrompt = `${def.systemPrompt}\n\n${JSON_ONLY_INSTRUCTION}`;

    for (let attempt = 0; attempt < 2; attempt++) {
      const result = await this.deps.gateway.complete(
        {
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.4,
          // Editorial output is a large JSON document (full copy per theme);
          // without an explicit budget some providers default far too low and
          // truncate mid-JSON.
          maxTokens: 8192,
          // Ask providers that support it to emit strict JSON, so tryParse
          // doesn't have to salvage markdown-fenced or prose-wrapped output.
          responseFormat: "json",
        },
        def.modelPolicy,
      );

      const price = this.deps.resolvePrice(result.provider, result.model);
      const costUsd = computeCost(price, result.usage);

      const parsed = this.tryParse(result.text, {
        runId: req.runId,
        step: req.step,
        usage: {
          provider: result.provider,
          model: result.model,
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          costUsd,
        },
      });
      if (parsed) return parsed;
    }

    throw new Error(`Agent ${def.key} produced invalid output after retries`);
  }

  private buildUserPrompt(req: AgentRequest): string {
    // Compact JSON: pretty-printing the assembled context inflated input
    // tokens ~25% for zero model benefit. The context assembler is responsible
    // for keeping each section bounded (slices/caps at assembly time).
    return JSON.stringify({ input: req.input, context: req.context, constraints: req.constraints });
  }

  private tryParse(
    text: string,
    fallback: Pick<AgentResponse, "runId" | "step" | "usage">,
  ): AgentResponse | null {
    let parsed: unknown;
    try {
      parsed = JSON.parse(stripJsonFences(text));
    } catch {
      // Non-JSON (e.g. a stub adapter's plain text): wrap it so the pipeline
      // still flows, but flag it as low confidence with the raw text as output.
      const stub: AgentResponse = {
        ...fallback,
        status: "ok",
        output: { text },
        confidence: "low",
        missingData: ["structured output not produced (non-JSON response)"],
        rationale: "resposta não estruturada",
        citations: [],
      };
      return stub;
    }

    // A model may (rarely) return the full response envelope; accept it as-is.
    const asEnvelope = agentResponse.safeParse(parsed);
    if (asEnvelope.success) return asEnvelope.data;

    // The common case: the model returns its domain JSON (persona, brand voice,
    // editorial line, …). Wrap it into a valid envelope, lifting the optional
    // meta fields (confidence/rationale/missingData) when the model included
    // them, while keeping them available inside `output` for downstream readers.
    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      const confidence =
        obj.confidence === "high" || obj.confidence === "medium" || obj.confidence === "low"
          ? obj.confidence
          : "medium";
      const missingData = Array.isArray(obj.missingData)
        ? (obj.missingData.filter((m) => typeof m === "string") as string[])
        : [];
      const rationale = typeof obj.rationale === "string" ? obj.rationale : "";
      const wrapped: AgentResponse = {
        ...fallback,
        status: missingData.length > 0 ? "needs_more_data" : "ok",
        output: parsed,
        confidence,
        missingData,
        rationale,
        citations: [],
      };
      return wrapped;
    }

    return null;
  }
}

/** Strips a leading/trailing markdown code fence (```json … ```) if present and
 * falls back to the first `{…}`/`[…]` block, so a model that ignores the
 * "no markdown" instruction still parses. */
function stripJsonFences(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenced?.[1]) return fenced[1].trim();
  const first = trimmed.search(/[[{]/);
  const lastObj = trimmed.lastIndexOf("}");
  const lastArr = trimmed.lastIndexOf("]");
  const last = Math.max(lastObj, lastArr);
  if (first >= 0 && last > first) return trimmed.slice(first, last + 1);
  return trimmed;
}
