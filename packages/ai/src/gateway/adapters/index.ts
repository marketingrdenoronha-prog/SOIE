import type { AIProvider } from "@soie/contracts";
import type { ProviderAdapter } from "../types.js";
import { BaseAdapter } from "./base.adapter.js";

class OpenAIAdapter extends BaseAdapter {
  readonly provider = "openai" as const;
}
class AnthropicAdapter extends BaseAdapter {
  readonly provider = "anthropic" as const;
}
class GeminiAdapter extends BaseAdapter {
  readonly provider = "gemini" as const;
}
class DeepSeekAdapter extends BaseAdapter {
  readonly provider = "deepseek" as const;
}

export function buildAdapters(): Record<AIProvider, ProviderAdapter> {
  return {
    openai: new OpenAIAdapter(),
    anthropic: new AnthropicAdapter(),
    gemini: new GeminiAdapter(),
    deepseek: new DeepSeekAdapter(),
  };
}
