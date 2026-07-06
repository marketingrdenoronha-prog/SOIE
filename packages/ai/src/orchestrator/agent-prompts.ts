import type { AgentKey } from "@soie/contracts";

/**
 * Per-agent output contracts. The Constitution system prompt shapes *how* an
 * agent reasons, but not the *shape* of what it must return — so structured
 * routes (persona, brand voice, editorial line, market, competition) received
 * empty/mismatched JSON and persisted nothing. These snippets spell out the
 * exact keys each consumer reads back, so any provider returns usable data.
 *
 * Shared between the inline serverless runtime (apps/web) and the queue worker
 * (apps/worker) so both flows stay in sync.
 */
export const AGENT_OUTPUT_CONTRACTS: Partial<Record<AgentKey, string>> = {
  persona: [
    "Tarefa: construir UMA persona detalhada do público-alvo.",
    "Retorne um JSON com exatamente estas chaves:",
    '- "name": string (nome/apelido da persona, ex: "Ana, gestora de marketing")',
    '- "demographics": objeto (idade, gênero, renda, localização, cargo, etc.)',
    '- "psychographics": objeto (valores, estilo de vida, motivações, comportamento)',
    '- "channels": array de strings (canais/plataformas onde ela consome conteúdo)',
    '- "awarenessLevel": string ("unaware"|"problem"|"solution"|"product"|"most")',
    '- "languageNotes": objeto (vocabulário, tom e expressões que ressoam com ela)',
    '- "pains": array de { "description": string, "intensity": número 1-5 }',
    '- "objections": array de { "description": string, "counter": string }',
    '- "desires": array de { "description": string, "strength": número 1-5 }',
  ].join("\n"),

  language: [
    "Tarefa: extrair o DNA verbal (voz da marca) a partir do contexto e das amostras.",
    "Retorne um JSON com exatamente estas chaves:",
    '- "tone": objeto (atributos de tom, ex: { "principal": "próximo", "secundario": "confiante" })',
    '- "formality": string ("muito informal"|"informal"|"neutro"|"formal"|"muito formal")',
    '- "emojisPolicy": objeto (ex: { "uso": "moderado", "exemplos": ["🚀","✅"] })',
    '- "do": array de strings (o que a marca DEVE fazer ao escrever)',
    '- "dont": array de strings (o que a marca NÃO deve fazer)',
    '- "examples": array de strings (frases de exemplo no tom da marca)',
    '- "archetypes": array de { "archetype": string, "weight": número 0-1, "rationale": string }',
    '- "vocabulary": array de { "kind": "preferido"|"evitar"|"termo", "term": string, "note": string }',
  ].join("\n"),

  planning: [
    "Tarefa: desenhar a linha editorial (estratégia de conteúdo) do projeto E JÁ ESCREVER a copy pronta de cada tema, no formato final que vai para o cliente aprovar.",
    "Retorne um JSON com exatamente estas chaves:",
    '- "positioning": string (posicionamento editorial em uma frase)',
    '- "pillars": array de strings (pilares de conteúdo)',
    '- "objectives": objeto (objetivos e KPIs editoriais)',
    '- "rationale": string (por que essa linha faz sentido para o negócio)',
    '- "lines": array de objetos, cada um com:',
    '    "name": string,',
    '    "objective": um destes: "authority"|"trust"|"educate"|"reduce_objection"|"attract"|"identify"|"position"|"desire"|"relationship"|"convert",',
    '    "funnelStage": "tofu"|"mofu"|"bofu",',
    '    "platforms": array de strings,',
    '    "categories": array de objetos { "name": string, "themes": array de temas }',
    "Cada TEMA é um objeto com:",
    '    "title": string (título/gancho do post),',
    '    "channel": string (ex.: "instagram", "tiktok"),',
    '    "format": string — um destes rótulos: "Estático" | "Carrossel" | "Reels" | "Vídeo" | "Motion" | "Story",',
    '    "copy": a COPY PRONTA do post. Regras do campo copy:',
    "        • Se format = \"Carrossel\": copy é um ARRAY de strings, uma por TELA (tela 1, tela 2, ...), na ordem.",
    "        • Qualquer outro format: copy é uma STRING com o texto final do post (headline + corpo + CTA), com quebras de linha.",
    "A copy deve estar no tom da marca, pronta para publicação — não descreva o que fazer, ESCREVA o conteúdo final. Gere entre 4 e 6 temas no total.",
  ].join("\n"),

  market: [
    "Tarefa: analisar o mercado do negócio (contexto de mercado da Constituição).",
    "Retorne um JSON com exatamente estas chaves:",
    '- "swot": objeto { "strengths": string[], "weaknesses": string[], "opportunities": string[], "threats": string[] }',
    '- "trends": array de strings (tendências relevantes do mercado)',
    '- "opportunities": array de strings',
    '- "threats": array de strings',
    '- "summary": string (síntese executiva da análise de mercado)',
  ].join("\n"),

  competition: [
    "Tarefa: mapear os principais concorrentes do negócio (contexto competitivo).",
    "Retorne um JSON com exatamente estas chaves:",
    '- "competitors": array de objetos, cada um com:',
    '    "name": string,',
    '    "url": string (site, opcional),',
    '    "positioning": string (como ele se posiciona),',
    '    "strengths": array de strings,',
    '    "weaknesses": array de strings',
  ].join("\n"),
};

/** Guidance appended to every agent: build on the accumulated project context
 * (business, market, personas, brand voice, editorial line) and the repertoire
 * of prior deliverables, instead of starting from scratch or repeating angles. */
export const CONTEXT_USAGE_NOTE =
  "Use TODO o contexto fornecido em `context` (negócio, mercado/concorrência, personas, voz da marca, linha editorial, `framework`, `memory`, `editorialHistory`, `contentMemory` e `repertoire` de entregas anteriores) como base. Se houver `context.framework`, ele é o MÉTODO do usuário: baseie CADA copy, roteiro e linha editorial nele — tem prioridade sobre estilos genéricos. Se houver `context.memory`, trate suas entradas como REGRAS OBRIGATÓRIAS de linguagem, tom e linha editorial — nunca as contrarie. Se houver `context.editorialHistory`, evolua a partir das linhas editoriais anteriores em vez de recomeçar. Se houver `context.contentMemory`, use os temas/categorias aprovados como histórico: evite repetição excessiva e proponha ângulos novos quando houver padrão repetido. Construa em cima do que já foi levantado pelos outros agentes. Se houver `repertoire`, NÃO repita os mesmos temas, ângulos ou ganchos já usados e evite os erros apontados nos feedbacks.";

/** Default Constitution-aligned base prompt for an agent. */
export function baseAgentPrompt(key: AgentKey): string {
  return `Você é o Agente ${key} do SOIE. Siga a Constituição do sistema: contexto antes de conteúdo, pesquisa antes de opinião, e justifique cada decisão. Responda em pt-BR.\n\n${CONTEXT_USAGE_NOTE}`;
}

/** Builds a full system prompt: a base (Constitution) prompt plus the agent's
 * output contract, when one exists. */
export function buildAgentPrompt(key: AgentKey, base = baseAgentPrompt(key)): string {
  const contract = AGENT_OUTPUT_CONTRACTS[key];
  return contract ? `${base}\n\n${contract}` : base;
}
