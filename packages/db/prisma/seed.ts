import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Seeds system-level, tenant-agnostic data: default roles, the 12 council
 * agents, base library frameworks/hooks, the AI price book and public plans.
 * Idempotent — safe to run repeatedly.
 */
async function main() {
  // ── System roles ──────────────────────────────────────────────────────
  const roles = [
    { name: "owner", permissions: ["*"] },
    { name: "admin", permissions: ["org:*", "client:*", "content:*", "ai:*"] },
    { name: "strategist", permissions: ["client:read", "content:*", "ai:run"] },
    { name: "editor", permissions: ["content:read", "content:write"] },
    { name: "viewer", permissions: ["*:read"] },
  ];
  for (const r of roles) {
    await prisma.role.upsert({
      where: { id: deterministicId("role", r.name) },
      update: { permissions: r.permissions },
      create: {
        id: deterministicId("role", r.name),
        name: r.name,
        isSystem: true,
        permissions: r.permissions,
      },
    });
  }

  // ── Council agents (Constitution §7 / Phase 4) ────────────────────────
  const agents: Array<{ key: string; name: string; description: string }> = [
    { key: "client", name: "Agente Cliente", description: "Consolida o contexto do negócio." },
    { key: "market", name: "Agente Mercado", description: "Analisa mercado, tendências e oportunidades." },
    { key: "competition", name: "Agente Concorrência", description: "Mapeia e analisa concorrentes." },
    { key: "persona", name: "Agente Persona", description: "Constrói personas com dores/objeções/desejos." },
    { key: "language", name: "Agente Linguagem", description: "Extrai o DNA verbal da marca e da audiência." },
    { key: "copy", name: "Agente Copy", description: "Redige peças e variações de copy." },
    { key: "seo", name: "Agente SEO", description: "Otimiza conteúdo para busca." },
    { key: "social", name: "Agente Social Media", description: "Adapta por plataforma e cadência." },
    { key: "calendar", name: "Agente Calendário", description: "Distribui temas no tempo." },
    { key: "evaluator", name: "Agente Avaliador", description: "Pontua qualidade e aderência (rubrica)." },
    { key: "critic", name: "Agente Crítico", description: "Autocrítica adversarial (Constituição §9)." },
    { key: "planning", name: "Agente Planejamento", description: "Sintetiza estratégia e linha editorial." },
    { key: "scriptwriter", name: "Agente Roteirista", description: "Escreve roteiros de vídeo (reels, tiktok, youtube, ads)." },
    { key: "designer", name: "Agente Designer", description: "Cria briefings de design (estático, carrossel, thumbnail)." },
    { key: "motion", name: "Agente Motion", description: "Escreve roteiros de motion design (cenas e timing)." },
    { key: "ads", name: "Agente Ads", description: "Produz criativos e copy de anúncios." },
  ];
  for (const a of agents) {
    await prisma.agent.upsert({
      where: { id: deterministicId("agent", a.key) },
      update: { name: a.name, description: a.description },
      create: {
        id: deterministicId("agent", a.key),
        key: a.key,
        name: a.name,
        description: a.description,
        config: { defaultModel: "auto" },
      },
    });
  }

  // ── Base library: copy frameworks ─────────────────────────────────────
  const frameworks = [
    { name: "AIDA", structure: { steps: ["Atenção", "Interesse", "Desejo", "Ação"] } },
    { name: "PAS", structure: { steps: ["Problema", "Agitação", "Solução"] } },
    { name: "StoryBrand", structure: { steps: ["Herói", "Problema", "Guia", "Plano", "Ação", "Sucesso"] } },
  ];
  for (const f of frameworks) {
    await prisma.framework.upsert({
      where: { id: deterministicId("framework", f.name) },
      update: { structure: f.structure },
      create: {
        id: deterministicId("framework", f.name),
        name: f.name,
        kind: "copywriting",
        structure: f.structure,
        isSystem: true,
      },
    });
  }

  // ── AI price book (illustrative; update with real vendor prices) ──────
  const prices = [
    { provider: "openai", model: "gpt-4o", inputPricePer1k: 0.005, outputPricePer1k: 0.015 },
    { provider: "openai", model: "gpt-4o-mini", inputPricePer1k: 0.00015, outputPricePer1k: 0.0006 },
    { provider: "anthropic", model: "claude-sonnet-5", inputPricePer1k: 0.003, outputPricePer1k: 0.015 },
    { provider: "gemini", model: "gemini-1.5-pro", inputPricePer1k: 0.00125, outputPricePer1k: 0.005 },
    { provider: "deepseek", model: "deepseek-chat", inputPricePer1k: 0.00027, outputPricePer1k: 0.0011 },
  ] as const;
  for (const p of prices) {
    await prisma.aIPriceBook.upsert({
      where: { id: deterministicId("price", `${p.provider}:${p.model}`) },
      update: { inputPricePer1k: p.inputPricePer1k, outputPricePer1k: p.outputPricePer1k },
      create: {
        id: deterministicId("price", `${p.provider}:${p.model}`),
        provider: p.provider,
        model: p.model,
        inputPricePer1k: p.inputPricePer1k,
        outputPricePer1k: p.outputPricePer1k,
      },
    });
  }

  // ── Public plans ──────────────────────────────────────────────────────
  const plans = [
    { name: "Starter", priceMonth: 0, limits: { seats: 2, projects: 1, aiTokensMonth: 500_000 } },
    { name: "Pro", priceMonth: 99, limits: { seats: 10, projects: 20, aiTokensMonth: 10_000_000 } },
    { name: "Agency", priceMonth: 399, limits: { seats: 50, projects: 200, aiTokensMonth: 100_000_000 } },
  ];
  for (const p of plans) {
    await prisma.plan.upsert({
      where: { id: deterministicId("plan", p.name) },
      update: { priceMonth: p.priceMonth, limits: p.limits },
      create: {
        id: deterministicId("plan", p.name),
        name: p.name,
        priceMonth: p.priceMonth,
        limits: p.limits,
      },
    });
  }

  console.log("Seed complete: roles, agents, frameworks, price book, plans.");
}

/** Stable UUID from a namespace + key so upserts are idempotent across runs. */
function deterministicId(namespace: string, key: string): string {
  const input = `${namespace}:${key}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  const hex = (h >>> 0).toString(16).padStart(8, "0");
  // Compose a deterministic v4-shaped uuid from a repeated hash.
  const block = (hex + hex + hex + hex).slice(0, 32);
  return `${block.slice(0, 8)}-${block.slice(8, 12)}-4${block.slice(13, 16)}-8${block.slice(17, 20)}-${block.slice(20, 32)}`;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
