import type { AIProvider } from "@soie/contracts";

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
}

export interface CompletionRequest {
  provider?: AIProvider;
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  /** BYOK: tenant-provided key; falls back to platform key when absent. */
  apiKey?: string;
  /** JSON schema the provider must conform its output to, when supported. */
  responseSchema?: unknown;
  /** Forces the provider to emit strict JSON (OpenAI/DeepSeek json_object,
   * Gemini responseMimeType). Defaults to free-form text. */
  responseFormat?: "json" | "text";
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface CompletionResult {
  provider: AIProvider;
  model: string;
  text: string;
  usage: TokenUsage;
  latencyMs: number;
  finishReason: "stop" | "length" | "error";
}

export interface EmbeddingRequest {
  provider?: AIProvider;
  model: string;
  input: string[];
  apiKey?: string;
}

export interface EmbeddingResult {
  provider: AIProvider;
  model: string;
  vectors: number[][];
  usage: TokenUsage;
}

/** A single provider adapter normalizes one vendor's API to our contract. */
export interface ProviderAdapter {
  readonly provider: AIProvider;
  complete(req: CompletionRequest): Promise<CompletionResult>;
  embed(req: EmbeddingRequest): Promise<EmbeddingResult>;
}

export class ProviderError extends Error {
  constructor(
    public readonly provider: AIProvider,
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
