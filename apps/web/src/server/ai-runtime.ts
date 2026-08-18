import { randomUUID } from "node:crypto";
import { prisma } from "@soie/db";
import {
  AIGateway,
  AgentRunner,
  buildAgentPrompt,
  defaultModelPolicy,
  produceDeliverable,
  type AgentDefinition,
  type ModelPrice,
  type ModelPolicy,
  type ProducedDeliverable,
} from "@soie/ai";
import { env } from "@soie/config";
import type { AgentKey, AgentRequest, Channel, DeliverableType } from "@soie/contracts";
import { demoAgentOutput, demoDeliverableSpec } from "./ai-demo";

/** Inline AI runtime for serverless (no worker/queue): produces module results
 * and deliverables directly in the request. Uses provider keys from env; when
 * NO key is set it returns rich, structured demo content so every module shows
 * a real, editable result out of the box (free tier). */
const providerKeys = {
  openai: env.OPENAI_API_KEY,
  anthropic: env.ANTHROPIC_API_KEY,
  gemini: env.GEMINI_API_KEY,
  deepseek: env.DEEPSEEK_API_KEY,
};
const gateway = new AIGateway(providerKeys);

/** Chain built from whichever keys are actually configured. Set OPENAI_API_KEY
 * and gpt-4o becomes the preferred model automatically. */
const MODEL_POLICY: ModelPolicy = defaultModelPolicy(providerKeys);

/** Models that can appear in the policy chain — primed into the price cache. */
const PRICEABLE_MODELS = [
  MODEL_POLICY.preferred,
  ...MODEL_POLICY.fallback,
].map((t) => `${t.provider}:${t.model}`);

/** True when at least one real provider key is configured. */
const HAS_AI_KEY = Boolean(
  env.OPENAI_API_KEY || env.ANTHROPIC_API_KEY || env.GEMINI_API_KEY || env.DEEPSEEK_API_KEY,
);

/** JSON schema hint per agent, so a real model returns the exact shape each
 * module reads. Keys mirror what the route handlers consume. */
const OUTPUT_SCHEMA: Partial<Record<AgentKey, string>> = {
  market:
    '{"summary":string,"swot":{"strengths":string[],"weaknesses":string[],"opportunities":string[],"threats":string[]},"trends":string[],"opportunities":string[],"threats":string[],"confidence":"high"|"medium"|"low"}',
  competition:
    '{"summary":string,"competitors":[{"name":string,"url":string,"positioning":string,"strengths":string[],"weaknesses":string[]}],"confidence":"high"|"medium"|"low"}',
  persona:
    '{"name":string,"demographics":object,"psychographics":object,"channels":string[],"awarenessLevel":string,"languageNotes":object,"pains":[{"description":string,"intensity":1-5}],"objections":[{"description":string,"counter":string}],"desires":[{"description":string,"strength":1-5}],"confidence":"high"|"medium"|"low"}',
  language:
    '{"tone":object,"formality":"low"|"medium"|"high","emojisPolicy":object,"do":string[],"dont":string[],"examples":string[],"archetypes":[{"archetype":string,"weight":0-1,"rationale":string}],"vocabulary":[{"kind":string,"term":string,"note":string}],"confidence":"high"|"medium"|"low"}',
  planning:
    '{"positioning":string,"pillars":string[],"objectives":object,"rationale":string,"lines":[{"name":string,"objective":"authority"|"trust"|"educate"|"reduce_objection"|"attract"|"identify"|"position"|"desire"|"relationship"|"convert","funnelStage":"tofu"|"mofu"|"bofu","platforms":string[],"categories":[{"name":string,"themes":[{"title":string,"strategicObjective":string,"channel":string,"format":"Vídeo"|"Motion"|"Carrossel"|"Estático","hook":string,"cta":string,"productionNotes":string,"copy":{"format":"video"|"motion"|"carrossel"|"estatico","estimatedDuration":string,"sections":[{"label":string,"text":string}],"slides":[{"title":string,"text":string}],"static":{"headline":string,"subheadline":string,"body":string,"cta":string,"designNotes":string}}}]}]}],"confidence":"high"|"medium"|"low"}',
};

async function resolvePrice(provider: string, model: string): Promise<ModelPrice> {
  const row = await prisma.aIPriceBook.findFirst({
    where: { provider: provider as any, model, effectiveTo: null },
    orderBy: { effectiveFrom: "desc" },
  });
  return {
    provider: provider as ModelPrice["provider"],
    model,
    inputPricePer1k: row?.inputPricePer1k ?? 0.003,
    outputPricePer1k: row?.outputPricePer1k ?? 0.015,
  };
}

/** Prices change rarely but every agent call needs them — cache per lambda
 * instance with a TTL so a warm function stops re-querying the price book on
 * each generation (produce-all alone runs dozens of agent calls). */
const PRICE_TTL_MS = 10 * 60 * 1000;
let priceCache: { at: number; prices: Map<string, ModelPrice> } | null = null;

async function getPrices(): Promise<Map<string, ModelPrice>> {
  if (priceCache && Date.now() - priceCache.at < PRICE_TTL_MS) return priceCache.prices;
  const entries = await Promise.all(
    PRICEABLE_MODELS.map(async (key) => {
      const [p, m] = key.split(":") as [string, string];
      return [key, await resolvePrice(p, m)] as const;
    }),
  );
  priceCache = { at: Date.now(), prices: new Map(entries) };
  return priceCache.prices;
}

async function resolveAgent(key: AgentKey): Promise<AgentDefinition> {
  const schema = OUTPUT_SCHEMA[key];
  const jsonRule = schema
    ? `\n\nResponda EXCLUSIVAMENTE com um JSON válido (sem markdown, sem crases, sem texto fora do JSON) neste formato: ${schema}. Preencha em pt-BR com conteúdo específico e acionável para a marca informada.`
    : "\n\nResponda em JSON válido quando fizer sentido; caso contrário, texto claro em pt-BR.";
  return {
    key,
    version: 1,
    systemPrompt: buildAgentPrompt(key) + jsonRule,
    modelPolicy: MODEL_POLICY,
  };
}

/** Extracts a JSON object from a model response that may be wrapped in prose or
 * ```json fences. Returns null if nothing parseable is found. */
function extractJson(text: string): Record<string, unknown> | null {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidates = [fenced?.[1], text];
  for (const c of candidates) {
    if (!c) continue;
    try {
      const parsed = JSON.parse(c.trim());
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
    } catch {
      /* try next */
    }
    const start = c.indexOf("{");
    const end = c.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        const parsed = JSON.parse(c.slice(start, end + 1));
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return parsed;
      } catch {
        /* give up on this candidate */
      }
    }
  }
  return null;
}

/** Persists an AIExecution row so cost/latency show up in relatórios. Falha de
 * telemetria nunca derruba a geração (catch-and-log). */
async function logExecution(
  organizationId: string,
  fields: { provider: string; model: string; inputTokens?: number; outputTokens?: number; latencyMs?: number; costUsd?: number; requestRef?: string },
): Promise<void> {
  try {
    await prisma.aIExecution.create({
      data: {
        organizationId,
        provider: fields.provider as any,
        model: fields.model,
        inputTokens: fields.inputTokens ?? 0,
        outputTokens: fields.outputTokens ?? 0,
        latencyMs: fields.latencyMs ?? 0,
        costUsd: fields.costUsd ?? 0,
        status: "success",
        requestRef: fields.requestRef,
      },
    });
  } catch (err) {
    console.error("aiExecution telemetry failed", err);
  }
}

export interface AIRunOpts {
  /** Quando presente, a execução é registrada em AIExecution (custo/latência
   * nos relatórios). Sem org não há como atribuir o custo — não registra. */
  organizationId?: string;
}

export async function produceInline(
  runId: string,
  type: DeliverableType,
  channel: Channel,
  brief?: string,
  context?: Record<string, unknown>,
  theme?: string,
  opts?: AIRunOpts,
): Promise<ProducedDeliverable> {
  // Sem chave: entrega estruturada de demonstração, pronta para revisão.
  if (!HAS_AI_KEY) {
    return {
      type,
      channel,
      spec: demoDeliverableSpec(type, channel, theme ?? brief),
      confidence: "medium",
      evaluationScore: 82,
      rationale: "Gerado em modo demo (sem chave de IA). Edite livremente.",
      costUsd: 0,
      steps: [{ step: "produce", status: "ok", costUsd: 0 }],
    };
  }

  const startedAt = Date.now();
  const runner = await makeRunner();
  const produced = await produceDeliverable({ runId, type, channel, brief, theme, context, runner, resolveAgent });

  if (opts?.organizationId) {
    await logExecution(opts.organizationId, {
      provider: MODEL_POLICY.preferred.provider,
      model: MODEL_POLICY.preferred.model,
      costUsd: produced.costUsd,
      latencyMs: Date.now() - startedAt,
      requestRef: runId,
    });
  }

  // Se o modelo não produziu spec estruturado, mas texto solto, tenta extrair
  // JSON; se ainda assim vier vazio, usa a spec demo para não entregar vazio.
  const spec = produced.spec as any;
  if (spec && typeof spec === "object" && "text" in spec && Object.keys(spec).length <= 2) {
    const extracted = extractJson(String(spec.text ?? ""));
    produced.spec = extracted ?? demoDeliverableSpec(type, channel, theme ?? brief);
  }
  return produced;
}

/**
 * Runs one agent and returns its structured output as a plain object, in the
 * shape the calling module expects. Falls back to structured demo content when
 * no key is set or the model didn't return usable JSON — so a module never
 * saves empty.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function runAgent(key: AgentKey, input: any, context?: Record<string, unknown>, opts?: AIRunOpts): Promise<any> {
  if (!HAS_AI_KEY) {
    return { ...demoAgentOutput(key, input), _demo: true };
  }

  const runner = await makeRunner();
  const def = await resolveAgent(key);
  const req: AgentRequest = {
    runId: randomUUID(),
    step: "run",
    agentKey: key,
    agentVersion: def.version,
    context: { retrieved: [], memories: [], previousSteps: {}, ...(context ?? {}) },
    input,
    constraints: { model: "auto", locale: "pt-BR" },
  };

  try {
    const res = await runner.run(def, req);
    if (opts?.organizationId) {
      await logExecution(opts.organizationId, {
        provider: res.usage.provider,
        model: res.usage.model,
        inputTokens: res.usage.inputTokens,
        outputTokens: res.usage.outputTokens,
        costUsd: res.usage.costUsd,
        requestRef: `${key}:${req.runId}`,
      });
    }
    const out = res.output as unknown;
    // Structured object → use directly.
    if (out && typeof out === "object" && !Array.isArray(out) && !("text" in (out as any))) {
      return { ...(out as Record<string, unknown>), confidence: res.confidence };
    }
    // Model returned prose/fenced JSON → try to recover the structure.
    const asText = out && typeof out === "object" && "text" in (out as any) ? String((out as any).text) : String(out ?? "");
    const recovered = extractJson(asText);
    if (recovered) return { ...recovered, confidence: (recovered.confidence as string) ?? res.confidence };
    // Nothing usable → structured demo so the module still populates.
    return { ...demoAgentOutput(key, input), confidence: "medium", _demo: true };
  } catch {
    // Provider failed entirely → don't 500 the module; degrade to demo.
    return { ...demoAgentOutput(key, input), confidence: "medium", _demo: true };
  }
}

async function makeRunner(): Promise<AgentRunner> {
  const cache = await getPrices();
  return new AgentRunner({
    gateway,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolvePrice: (p, m) => cache.get(`${p}:${m}`) ?? { provider: p as any, model: m, inputPricePer1k: 0.003, outputPricePer1k: 0.015 },
  });
}

/**
 * Legenda de postagem a partir do conteúdo aprovado da peça (copy/tema/gancho/
 * CTA) e do canal. Devolve uma legenda pronta para publicar, com quebras de
 * linha e hashtags quando fizer sentido.
 */
export async function generatePostCaption(
  input: { channel: string; title: string; brief?: string; copy?: unknown; hook?: string | null; cta?: string | null },
  opts?: AIRunOpts,
): Promise<{ caption: string; _demo?: boolean }> {
  const base = [input.hook, input.title].filter(Boolean).join(" — ");
  if (!HAS_AI_KEY) {
    const cta = input.cta ? `\n\n${input.cta}` : "";
    return { caption: `${base}${cta}`.slice(0, 2000), _demo: true };
  }
  const system =
    "Você escreve legendas de redes sociais em pt-BR. A partir do conteúdo aprovado da peça, escreva UMA legenda pronta para publicar no canal indicado: " +
    "gancho forte na 1ª linha, corpo curto e escaneável, CTA no fim e 3–8 hashtags relevantes quando o canal pedir (Instagram/TikTok sim; LinkedIn poucas). " +
    'Sem emojis em excesso. Responda EXCLUSIVAMENTE com JSON {"caption": string}.';
  const user = [
    `Canal: ${input.channel}`,
    `Tema: ${input.title}`,
    input.hook ? `Gancho: ${input.hook}` : "",
    input.cta ? `CTA: ${input.cta}` : "",
    input.brief ? `Briefing: ${input.brief.slice(0, 1500)}` : "",
    input.copy && typeof input.copy === "object" ? `Copy aprovada: ${JSON.stringify(input.copy).slice(0, 3000)}` : "",
  ].filter(Boolean).join("\n");

  const startedAt = Date.now();
  try {
    const res = await gateway.complete(
      { messages: [{ role: "system", content: system }, { role: "user", content: user }], maxTokens: 800, responseFormat: "json" },
      MODEL_POLICY,
    );
    if (opts?.organizationId) {
      await logExecution(opts.organizationId, {
        provider: res.provider, model: res.model,
        inputTokens: res.usage.inputTokens, outputTokens: res.usage.outputTokens,
        latencyMs: Date.now() - startedAt, requestRef: "post-caption",
      });
    }
    const parsed = extractJson(res.text) as { caption?: unknown } | null;
    const caption = typeof parsed?.caption === "string" && parsed.caption.trim() ? parsed.caption.trim() : res.text.trim();
    return { caption: caption.slice(0, 2200) };
  } catch {
    const cta = input.cta ? `\n\n${input.cta}` : "";
    return { caption: `${base}${cta}`.slice(0, 2000), _demo: true };
  }
}

export interface EditorialAdjustmentSummary {
  understood: string;
  plan: string[];
  _demo?: boolean;
}

/**
 * Ajuste AUTOMÁTICO da linha editorial (passo 1 de 2): a IA lê o feedback do
 * cliente + a linha atual e devolve (a) o que ENTENDEU que o cliente pediu e
 * (b) o que ELA FARIA para reajustar — sem alterar nada ainda. O operador
 * revisa e só então aciona a reescrita (passo 2 = geração da próxima versão).
 * Exclusivo da linha editorial; não se aplica a material pronto.
 */
export async function summarizeEditorialAdjustment(
  input: {
    clientName: string;
    niche?: string;
    positioning?: string | null;
    version: number;
    feedback: string;
    themes?: string[];
  },
  opts?: AIRunOpts,
): Promise<EditorialAdjustmentSummary> {
  if (!HAS_AI_KEY) {
    return {
      understood: `Modo demo (sem chave de IA). Feedback recebido do cliente na V${input.version}: ${input.feedback.slice(0, 400)}`,
      plan: [
        "Mapear cada ponto citado pelo cliente no feedback",
        "Ajustar apenas os temas/ganchos afetados, mantendo o que foi aprovado",
        "Gerar uma nova versão da linha com as mudanças pedidas",
      ],
      _demo: true,
    };
  }

  const system =
    "Você é um estrategista de conteúdo. Um cliente pediu AJUSTES na linha editorial atual. " +
    "Sua tarefa: (1) resumir com precisão o que o cliente pediu e o que você entendeu; " +
    "(2) listar de forma objetiva o que você faria para reajustar a linha, mudando só o necessário e " +
    "preservando o que já foi aprovado. Responda EXCLUSIVAMENTE com JSON válido " +
    '{"understood": string, "plan": string[]} em pt-BR, sem markdown.';
  const user = [
    `Cliente: ${input.clientName}`,
    input.niche ? `Mercado/nicho: ${input.niche}` : "",
    input.positioning ? `Posicionamento atual: ${input.positioning}` : "",
    `Versão atual: V${input.version}`,
    input.themes?.length ? `Temas atuais: ${input.themes.slice(0, 24).join("; ")}` : "",
    "",
    `FEEDBACK DO CLIENTE (o que ele pediu para ajustar):\n${input.feedback}`,
  ]
    .filter(Boolean)
    .join("\n");

  const startedAt = Date.now();
  try {
    const res = await gateway.complete(
      {
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        maxTokens: 1200,
        responseFormat: "json",
      },
      MODEL_POLICY,
    );
    if (opts?.organizationId) {
      await logExecution(opts.organizationId, {
        provider: res.provider,
        model: res.model,
        inputTokens: res.usage.inputTokens,
        outputTokens: res.usage.outputTokens,
        latencyMs: Date.now() - startedAt,
        requestRef: "editorial-adjust-summary",
      });
    }
    const parsed = extractJson(res.text) as { understood?: unknown; plan?: unknown } | null;
    const plan = Array.isArray(parsed?.plan) ? parsed!.plan.map((x) => String(x)).filter(Boolean) : [];
    const understood =
      typeof parsed?.understood === "string" && parsed.understood.trim()
        ? parsed.understood
        : res.text.slice(0, 600) || "A IA não retornou um resumo legível — tente novamente ou faça o ajuste manual.";
    return {
      understood,
      plan: plan.length ? plan : ["Reajustar os pontos citados pelo cliente na próxima versão."],
    };
  } catch {
    return {
      understood: `Não foi possível gerar o resumo agora. Feedback do cliente: ${input.feedback.slice(0, 400)}`,
      plan: ["Tente novamente em instantes ou faça o ajuste manual."],
      _demo: true,
    };
  }
}

export interface AdjustmentQuestionGroup {
  /** O ajuste específico que o cliente pediu (identificado pela IA). */
  topic: string;
  /** Perguntas de esclarecimento ligadas a ESSE ajuste (nunca genéricas). */
  questions: string[];
}

/**
 * Ajuste da linha editorial — geração de PERGUNTAS DE ESCLARECIMENTO. A IA lê
 * TODOS os pedidos de ajuste do cliente juntos, identifica cada um e monta
 * perguntas específicas (jamais padrão) para a EQUIPE fazer ao cliente enquanto
 * anota as respostas. As respostas depois alimentam um reajuste mais assertivo.
 */
export async function generateAdjustmentQuestions(
  input: {
    clientName: string;
    niche?: string;
    positioning?: string | null;
    version: number;
    feedback: string;
    themes?: string[];
  },
  opts?: AIRunOpts,
): Promise<{ items: AdjustmentQuestionGroup[]; _demo?: boolean }> {
  if (!HAS_AI_KEY) {
    // Demo: quebra o feedback em linhas e devolve perguntas ancoradas no texto
    // de cada pedido (ainda assim ligadas ao que foi pedido, não 100% padrão).
    const lines = input.feedback
      .split(/\n|(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 8)
      .slice(0, 6);
    const items = (lines.length ? lines : ["Ajuste solicitado pelo cliente"]).map((l) => ({
      topic: l.slice(0, 140),
      questions: [
        `Sobre "${l.slice(0, 60)}…": qual exatamente é o resultado esperado com esse ajuste?`,
        `Tem algum exemplo, referência ou tema específico que deve entrar (ou sair) por causa disso?`,
      ],
    }));
    return { items, _demo: true };
  }

  const system =
    "Você é um estrategista de conteúdo conduzindo o refinamento de uma linha editorial. " +
    "Abaixo estão TODOS os pedidos de ajuste que o cliente fez (podem vir em mensagens diferentes, reunidos). " +
    "Tarefa: (1) IDENTIFIQUE cada ajuste distinto pedido pelo cliente; (2) para CADA um, gere de 1 a 3 PERGUNTAS " +
    "DE ESCLARECIMENTO que a EQUIPE fará ao cliente para executar o ajuste com precisão. " +
    "REGRAS DAS PERGUNTAS: devem ser 100% específicas do ajuste em questão, referenciando o que o cliente escreveu; " +
    "cada pergunta precisa destravar uma decisão concreta de conteúdo (tema, gancho, tom, formato, exemplo, prova). " +
    "É PROIBIDO perguntas genéricas/padrão (ex.: 'qual seu objetivo?', 'qual seu público?', 'qual o tom?') — só entram se " +
    "forem inevitavelmente ligadas ao pedido específico. Se um pedido já estiver claro, gere 1 pergunta de confirmação objetiva. " +
    'Responda EXCLUSIVAMENTE com JSON válido {"items":[{"topic":string,"questions":string[]}]} em pt-BR, sem markdown.';
  const user = [
    `Cliente: ${input.clientName}`,
    input.niche ? `Mercado/nicho: ${input.niche}` : "",
    input.positioning ? `Posicionamento atual: ${input.positioning}` : "",
    `Versão atual: V${input.version}`,
    input.themes?.length ? `Temas atuais: ${input.themes.slice(0, 24).join("; ")}` : "",
    "",
    `TODOS OS PEDIDOS DE AJUSTE DO CLIENTE (reunidos):\n${input.feedback}`,
  ]
    .filter(Boolean)
    .join("\n");

  const startedAt = Date.now();
  try {
    const res = await gateway.complete(
      {
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        maxTokens: 1600,
        responseFormat: "json",
      },
      MODEL_POLICY,
    );
    if (opts?.organizationId) {
      await logExecution(opts.organizationId, {
        provider: res.provider,
        model: res.model,
        inputTokens: res.usage.inputTokens,
        outputTokens: res.usage.outputTokens,
        latencyMs: Date.now() - startedAt,
        requestRef: "editorial-adjust-questions",
      });
    }
    const parsed = extractJson(res.text) as { items?: unknown } | null;
    const rawItems = Array.isArray(parsed?.items) ? parsed!.items : [];
    const items: AdjustmentQuestionGroup[] = rawItems
      .map((it) => {
        const o = (it ?? {}) as { topic?: unknown; questions?: unknown };
        const topic = typeof o.topic === "string" ? o.topic.trim() : "";
        const questions = Array.isArray(o.questions)
          ? o.questions.map((q) => String(q).trim()).filter(Boolean).slice(0, 4)
          : [];
        return { topic, questions };
      })
      .filter((it) => it.topic && it.questions.length > 0)
      .slice(0, 10);
    if (!items.length) {
      return {
        items: [{ topic: "Ajuste pedido pelo cliente", questions: ["Confirme com o cliente o que exatamente deve mudar e por quê."] }],
      };
    }
    return { items };
  } catch {
    return {
      items: [{ topic: "Ajuste pedido pelo cliente", questions: ["Não foi possível gerar as perguntas agora — confirme com o cliente o que deve mudar e tente novamente."] }],
      _demo: true,
    };
  }
}

export interface ThemeRewriteResult {
  title?: string;
  format?: string;
  channel?: string;
  strategicObjective?: string;
  hook?: string;
  cta?: string;
  productionNotes?: string;
  copy?: unknown;
  _demo?: boolean;
}

/**
 * AJUSTE MANUAL de UM ÚNICO conteúdo da linha editorial. Reescreve SÓ este tema
 * a partir das instruções manuais do operador, respeitando a ordem de
 * prioridade (1. ajuste manual → 2. briefing do cliente → 3. base de
 * conhecimento → 4. estratégia da linha → 5. regras gerais). Devolve o tema
 * completo já ajustado; o chamador grava apenas neste tema (nenhum outro muda).
 */
export async function rewriteEditorialTheme(
  input: {
    instructions: string;
    /** Se for carrossel, quantidade OBRIGATÓRIA de telas a manter (2–8). */
    slideCount?: number;
    /** Se for vídeo/motion, duração (segundos) a manter no roteiro. */
    durationSeconds?: number;
    theme: {
      title?: unknown; format?: unknown; channel?: unknown;
      strategicObjective?: unknown; hook?: unknown; cta?: unknown;
      productionNotes?: unknown; copy?: unknown;
    };
    clientName?: string;
    niche?: string;
  },
  context?: Record<string, unknown>,
  opts?: AIRunOpts,
): Promise<ThemeRewriteResult> {
  if (!HAS_AI_KEY) {
    // Sem IA: mantém o conteúdo e registra as instruções nas observações, para
    // o ajuste ficar visível até haver uma chave de IA configurada.
    const notes = [String(input.theme.productionNotes ?? "").trim(), `[AJUSTE MANUAL PENDENTE — modo demo] ${input.instructions.trim()}`]
      .filter(Boolean)
      .join("\n\n");
    return {
      title: input.theme.title ? String(input.theme.title) : undefined,
      format: input.theme.format ? String(input.theme.format) : undefined,
      channel: input.theme.channel ? String(input.theme.channel) : undefined,
      strategicObjective: input.theme.strategicObjective ? String(input.theme.strategicObjective) : undefined,
      hook: input.theme.hook ? String(input.theme.hook) : undefined,
      cta: input.theme.cta ? String(input.theme.cta) : undefined,
      productionNotes: notes,
      copy: input.theme.copy,
      _demo: true,
    };
  }

  const system = [
    "Você reescreve UM ÚNICO conteúdo de uma linha editorial a partir das INSTRUÇÕES DE AJUSTE MANUAL do operador.",
    "REGRA DE OURO: altere EXCLUSIVAMENTE o que as instruções pedirem; preserve todo o resto do conteúdo (o que não foi citado permanece igual). Não invente mudanças fora do pedido.",
    "ORDEM DE PRIORIDADE (do maior para o menor): 1) as INSTRUÇÕES DE AJUSTE MANUAL; 2) o briefing do cliente (`context.clientProfile`); 3) a Base de Conhecimento (`context.memory`); 4) a estratégia da linha (posicionamento/pilares); 5) regras gerais. Em conflito, a de prioridade MAIOR vence — o ajuste manual sempre prevalece.",
    "Fundamente o conteúdo na Base e no briefing: use dores, mercado, persona e voz reais do cliente; nada genérico que sirva para outra empresa.",
    "Devolva o TEMA COMPLETO já ajustado, com as chaves: \"title\", \"format\" (Vídeo|Motion|Carrossel|Estático), \"channel\", \"strategicObjective\", \"hook\", \"cta\", \"productionNotes\", \"copy\".",
    "REGRAS DE `copy` por formato (mantenha o formato atual, a menos que as instruções mandem trocar — nesse caso gere a copy no NOVO formato):",
    "• Vídeo/Motion: copy = { \"format\":\"video\"|\"motion\", \"durationSeconds\": N, \"estimatedDuration\", \"sections\":[{label,text}] }. Se houver DURAÇÃO OBRIGATÓRIA, ajuste o tamanho do roteiro a ela (~2–2,5 palavras/s): curto (≤20s) = 2–3 partes enxutas; médio (~30–45s) = 4 partes; longo (60s+) = as 5 partes desenvolvidas. Não force ~130 palavras se a duração pedida for menor.",
    "• Carrossel: copy = { \"format\":\"carrossel\", \"slideCount\": N, \"slides\":[{title,text}] } com EXATAMENTE N telas (a quantidade indicada abaixo). NÃO mude a quantidade de telas, a menos que as instruções manuais peçam explicitamente. É um ROTEIRO conectado (não frases soltas): abertura (gancho/tensão) → desenvolvimento(s) (por que acontece, consequências, prova) → fechamento (solução + CTA), distribuído nas N telas. Cada `text` desenvolvido (3–6 frases, ~45–90 palavras) com contexto, explicação, consequência e ponte para a próxima tela; cada tela entrega algo novo. Proibido frase de efeito solta e proibido tela vazia. `slides.length` DEVE ser igual a `slideCount`.",
    "• Estático: copy = { \"format\":\"estatico\", \"static\":{ headline, subheadline, body, caption, cta, designNotes } }. Arte enxuta; `caption` (legenda) desenvolvida e estratégica (4–7 frases).",
    "Responda EXCLUSIVAMENTE com JSON válido do tema, em pt-BR, sem markdown.",
  ].join("\n");

  const user = [
    input.clientName ? `Cliente: ${input.clientName}` : "",
    input.niche ? `Mercado/nicho: ${input.niche}` : "",
    input.slideCount ? `QUANTIDADE OBRIGATÓRIA DE TELAS (carrossel): ${input.slideCount} — o array slides deve ter exatamente ${input.slideCount} itens e slideCount=${input.slideCount}.` : "",
    input.durationSeconds ? `DURAÇÃO OBRIGATÓRIA (vídeo/motion): ${input.durationSeconds} segundos — ajuste o tamanho do roteiro à duração (~2–2,5 palavras/s) e defina durationSeconds=${input.durationSeconds}.` : "",
    "",
    "CONTEÚDO ATUAL (JSON):",
    JSON.stringify(input.theme),
    "",
    "INSTRUÇÕES DE AJUSTE MANUAL (prioridade máxima — aplique apenas isto):",
    input.instructions.trim(),
  ]
    .filter(Boolean)
    .join("\n");

  const startedAt = Date.now();
  try {
    const res = await gateway.complete(
      {
        messages: [
          { role: "system", content: system },
          { role: "user", content: `${user}\n\nCONTEXTO (briefing, base, persona, voz): ${JSON.stringify(context ?? {})}` },
        ],
        maxTokens: 4000,
        responseFormat: "json",
      },
      MODEL_POLICY,
    );
    if (opts?.organizationId) {
      await logExecution(opts.organizationId, {
        provider: res.provider,
        model: res.model,
        inputTokens: res.usage.inputTokens,
        outputTokens: res.usage.outputTokens,
        latencyMs: Date.now() - startedAt,
        requestRef: "editorial-theme-rewrite",
      });
    }
    const parsed = extractJson(res.text) as Record<string, unknown> | null;
    if (!parsed) throw new Error("no json");
    const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
    return {
      title: str(parsed.title) ?? (input.theme.title ? String(input.theme.title) : undefined),
      format: str(parsed.format) ?? (input.theme.format ? String(input.theme.format) : undefined),
      channel: str(parsed.channel) ?? (input.theme.channel ? String(input.theme.channel) : undefined),
      strategicObjective: str(parsed.strategicObjective) ?? (input.theme.strategicObjective ? String(input.theme.strategicObjective) : undefined),
      hook: str(parsed.hook) ?? (input.theme.hook ? String(input.theme.hook) : undefined),
      cta: str(parsed.cta) ?? (input.theme.cta ? String(input.theme.cta) : undefined),
      productionNotes: str(parsed.productionNotes) ?? (input.theme.productionNotes ? String(input.theme.productionNotes) : undefined),
      copy: parsed.copy ?? input.theme.copy,
    };
  } catch {
    // Falha de IA: não perde o pedido — devolve o tema atual com a instrução
    // anotada para reprocessar depois.
    const notes = [String(input.theme.productionNotes ?? "").trim(), `[AJUSTE MANUAL NÃO APLICADO — tente novamente] ${input.instructions.trim()}`]
      .filter(Boolean)
      .join("\n\n");
    return {
      title: input.theme.title ? String(input.theme.title) : undefined,
      format: input.theme.format ? String(input.theme.format) : undefined,
      channel: input.theme.channel ? String(input.theme.channel) : undefined,
      strategicObjective: input.theme.strategicObjective ? String(input.theme.strategicObjective) : undefined,
      hook: input.theme.hook ? String(input.theme.hook) : undefined,
      cta: input.theme.cta ? String(input.theme.cta) : undefined,
      productionNotes: notes,
      copy: input.theme.copy,
      _demo: true,
    };
  }
}

/**
 * Embedding best-effort para a Base de Conhecimento. Usa OpenAI
 * (text-embedding-3-small = 1536 dims, casa com a coluna vector(1536)) quando a
 * chave existe. SEM chave (ou em qualquer falha) devolve null — o retrieval cai
 * para busca lexical, então o recurso nunca fica inutilizado.
 */
export async function embedText(text: string): Promise<number[] | null> {
  if (!providerKeys.openai) return null;
  const clean = text.trim().slice(0, 8000);
  if (!clean) return null;
  try {
    const res = await gateway.embed({
      provider: "openai",
      model: "text-embedding-3-small",
      input: [clean],
      apiKey: providerKeys.openai,
    });
    const v = res.vectors?.[0];
    return Array.isArray(v) && v.length === 1536 ? v : null;
  } catch {
    return null;
  }
}
