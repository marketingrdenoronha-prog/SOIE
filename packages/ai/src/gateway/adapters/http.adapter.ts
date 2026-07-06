import type { AIProvider } from "@soie/contracts";
import type {
  CompletionRequest,
  CompletionResult,
  EmbeddingRequest,
  EmbeddingResult,
  ProviderAdapter,
} from "../types.js";
import { ProviderError } from "../types.js";
import { estimateTokens } from "./base.adapter.js";

/**
 * Real provider adapters over each vendor's HTTP API using global fetch —
 * no vendor SDK, so the package stays dependency-light. Each subclass maps one
 * vendor's request/response shape to our normalized contract. A missing or
 * failing key surfaces as a retryable ProviderError so the gateway's fallback
 * chain can move on to the next provider.
 */
/** Hard cap per provider HTTP call. Without it a hung connection holds the
 * serverless function until the platform's maxDuration kills it — with it the
 * gateway's fallback chain gets a chance to answer from another provider. */
const REQUEST_TIMEOUT_MS = 120_000;

/** Default output budget when the caller doesn't set one. Editorial-line
 * generation returns large JSON documents (full copy per theme), so a small
 * cap (e.g. Anthropic's old 2048 default here) silently truncated output. */
export const DEFAULT_MAX_OUTPUT_TOKENS = 8192;

abstract class HttpAdapter implements ProviderAdapter {
  abstract readonly provider: AIProvider;
  constructor(protected readonly apiKey: string) {}

  abstract complete(req: CompletionRequest): Promise<CompletionResult>;

  async embed(_req: EmbeddingRequest): Promise<EmbeddingResult> {
    throw new ProviderError(this.provider, "embeddings not implemented", false);
  }

  protected async post(url: string, headers: Record<string, string>, body: unknown) {
    let res: Response;
    try {
      res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json", ...headers },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      const timedOut = err instanceof Error && err.name === "TimeoutError";
      throw new ProviderError(
        this.provider,
        timedOut ? `timeout after ${REQUEST_TIMEOUT_MS}ms` : `network error: ${String(err)}`,
        true,
      );
    }
    if (!res.ok) {
      const retryable = res.status === 429 || res.status >= 500;
      const text = await res.text().catch(() => "");
      throw new ProviderError(
        this.provider,
        `HTTP ${res.status}: ${text.slice(0, 200)}`,
        retryable,
      );
    }
    return res.json() as Promise<any>;
  }
}

export class OpenAIHttpAdapter extends HttpAdapter {
  readonly provider: AIProvider = "openai";
  constructor(apiKey: string, private readonly baseUrl = "https://api.openai.com/v1") {
    super(apiKey);
  }

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const startedAt = Date.now();
    const data = await this.post(
      `${this.baseUrl}/chat/completions`,
      { authorization: `Bearer ${req.apiKey ?? this.apiKey}` },
      {
        model: req.model,
        messages: req.messages,
        temperature: req.temperature ?? 0.4,
        max_tokens: req.maxTokens,
        // Force valid JSON at the API level (not just via prompt) when asked.
        ...(req.responseFormat === "json"
          ? { response_format: { type: "json_object" } }
          : {}),
      },
    );
    return {
      provider: this.provider,
      model: req.model,
      text: data.choices?.[0]?.message?.content ?? "",
      usage: {
        inputTokens: data.usage?.prompt_tokens ?? 0,
        outputTokens: data.usage?.completion_tokens ?? 0,
      },
      latencyMs: Date.now() - startedAt,
      finishReason: data.choices?.[0]?.finish_reason === "length" ? "length" : "stop",
    };
  }

  override async embed(req: EmbeddingRequest): Promise<EmbeddingResult> {
    const data = await this.post(
      `${this.baseUrl}/embeddings`,
      { authorization: `Bearer ${req.apiKey ?? this.apiKey}` },
      { model: req.model, input: req.input },
    );
    return {
      provider: this.provider,
      model: req.model,
      vectors: (data.data ?? []).map((d: any) => d.embedding as number[]),
      usage: { inputTokens: data.usage?.prompt_tokens ?? 0, outputTokens: 0 },
    };
  }
}

/** DeepSeek exposes an OpenAI-compatible API. */
export class DeepSeekHttpAdapter extends OpenAIHttpAdapter {
  override readonly provider: AIProvider = "deepseek";
  constructor(apiKey: string) {
    super(apiKey, "https://api.deepseek.com");
  }
}

export class AnthropicHttpAdapter extends HttpAdapter {
  readonly provider = "anthropic" as const;

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const startedAt = Date.now();
    const system = req.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
    const messages = req.messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role, content: m.content }));
    const data = await this.post(
      "https://api.anthropic.com/v1/messages",
      { "x-api-key": req.apiKey ?? this.apiKey, "anthropic-version": "2023-06-01" },
      { model: req.model, max_tokens: req.maxTokens ?? DEFAULT_MAX_OUTPUT_TOKENS, system, messages },
    );
    return {
      provider: this.provider,
      model: req.model,
      text: data.content?.[0]?.text ?? "",
      usage: {
        inputTokens: data.usage?.input_tokens ?? 0,
        outputTokens: data.usage?.output_tokens ?? 0,
      },
      latencyMs: Date.now() - startedAt,
      finishReason: data.stop_reason === "max_tokens" ? "length" : "stop",
    };
  }
}

export class GeminiHttpAdapter extends HttpAdapter {
  readonly provider = "gemini" as const;

  async complete(req: CompletionRequest): Promise<CompletionResult> {
    const startedAt = Date.now();
    const key = req.apiKey ?? this.apiKey;
    const system = req.messages.filter((m) => m.role === "system").map((m) => m.content).join("\n");
    const contents = req.messages
      .filter((m) => m.role === "user" || m.role === "assistant")
      .map((m) => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] }));
    const data = await this.post(
      `https://generativelanguage.googleapis.com/v1beta/models/${req.model}:generateContent?key=${key}`,
      {},
      {
        contents,
        systemInstruction: system ? { parts: [{ text: system }] } : undefined,
        generationConfig: {
          temperature: req.temperature ?? 0.4,
          maxOutputTokens: req.maxTokens,
          ...(req.responseFormat === "json"
            ? { responseMimeType: "application/json" }
            : {}),
        },
      },
    );
    const text = (data.candidates?.[0]?.content?.parts ?? [])
      .map((p: any) => p.text ?? "")
      .join("");
    return {
      provider: this.provider,
      model: req.model,
      text,
      usage: {
        inputTokens: data.usageMetadata?.promptTokenCount ?? estimateTokens(system),
        outputTokens: data.usageMetadata?.candidatesTokenCount ?? estimateTokens(text),
      },
      latencyMs: Date.now() - startedAt,
      finishReason: "stop",
    };
  }
}
