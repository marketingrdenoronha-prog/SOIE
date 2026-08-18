import type { AIProvider } from "@soie/contracts";
import type { TokenUsage } from "../gateway/types.js";

export interface ModelPrice {
  provider: AIProvider;
  model: string;
  inputPricePer1k: number;
  outputPricePer1k: number;
}

/**
 * Computes USD cost for a completion. In production the prices come from the
 * `ai_price_book` table (versioned, with effective dates); this pure function
 * is what both the live path and cost estimates call.
 */
export function computeCost(price: ModelPrice, usage: TokenUsage): number {
  const input = (usage.inputTokens / 1000) * price.inputPricePer1k;
  const output = (usage.outputTokens / 1000) * price.outputPricePer1k;
  return round(input + output);
}

function round(n: number): number {
  return Math.round(n * 1e6) / 1e6;
}
