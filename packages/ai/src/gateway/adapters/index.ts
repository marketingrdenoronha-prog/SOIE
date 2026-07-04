import type { AIProvider } from "@soie/contracts";
import type { ProviderAdapter } from "../types.js";
import { BaseAdapter } from "./base.adapter.js";
import {
  AnthropicHttpAdapter,
  DeepSeekHttpAdapter,
  GeminiHttpAdapter,
  OpenAIHttpAdapter,
} from "./http.adapter.js";

/** Per-provider API keys (platform-level). Tenant BYOK keys are passed
 * per-request via CompletionRequest.apiKey and take precedence. */
export type ProviderKeys = Partial<Record<AIProvider, string | undefined>>;

class StubAdapter extends BaseAdapter {
  constructor(readonly provider: AIProvider) {
    super();
  }
}

/**
 * Builds the adapter map. When a provider has a key it gets the real HTTP
 * adapter; otherwise a deterministic stub, so the orchestrator and pipelines
 * run end-to-end offline (tests, demos) and light up for real once keys exist.
 */
export function buildAdapters(keys: ProviderKeys = {}): Record<AIProvider, ProviderAdapter> {
  return {
    openai: keys.openai ? new OpenAIHttpAdapter(keys.openai) : new StubAdapter("openai"),
    anthropic: keys.anthropic
      ? new AnthropicHttpAdapter(keys.anthropic)
      : new StubAdapter("anthropic"),
    gemini: keys.gemini ? new GeminiHttpAdapter(keys.gemini) : new StubAdapter("gemini"),
    deepseek: keys.deepseek
      ? new DeepSeekHttpAdapter(keys.deepseek)
      : new StubAdapter("deepseek"),
  };
}
