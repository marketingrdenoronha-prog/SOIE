import { AIGateway, AgentRunner, Orchestrator } from "@soie/ai";

const gateway = new AIGateway();
const runner = new AgentRunner({
  gateway,
  resolvePrice: (provider, model) => ({
    provider: provider as any, model,
    inputPricePer1k: 0.003, outputPricePer1k: 0.015,
  }),
});
const orch = new Orchestrator({
  runner,
  resolveAgent: async (key) => ({
    key, version: 1,
    systemPrompt: `Agente ${key}`,
    modelPolicy: {
      preferred: { provider: "anthropic", model: "claude-sonnet" },
      fallback: [{ provider: "openai", model: "gpt-4o" }],
    },
  }),
});

const result = await orch.run({
  runId: "00000000-0000-4000-8000-000000000001",
  organizationId: "org-1",
  projectId: "proj-1",
  kind: "research",
  input: { domain: "cafe-especial.com" },
});

console.log("status:", result.status);
console.log("custo total USD:", result.totalCostUsd.toFixed(6));
console.log("passos executados:");
for (const s of result.steps) console.log(`  - ${s.step}: ${s.status}`);
