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
    "Tarefa: desenhar a Linha Editorial e JÁ ESCREVER cada conteúdo PRONTO PARA PRODUÇÃO — de modo que Designer, Filmaker ou Copywriter produzam sem precisar de mais nada. NUNCA entregue apenas ideias resumidas ou descrições superficiais.",
    "FLUXO OBRIGATÓRIO ANTES DE GERAR: (1) leia `context.clientProfile` (onboarding); (2) leia `context.dossier` (dossiê estratégico); (3) leia TODO o `context.editorialStock` (acervo completo das linhas já aprovadas e enviadas); (4) analise e compare TODAS as linhas do estoque entre si; (5) extraia padrões de comunicação, estratégia e evolução; (6) identifique repetições, assuntos pouco explorados e oportunidades/lacunas; (7) só então gere a nova linha. NUNCA considere apenas a última linha — use o histórico completo. A nova linha deve ser uma EVOLUÇÃO natural de todas as anteriores: preserve a identidade da marca e evolua a comunicação, sem copiar conteúdos nem repetir copies, ganchos ou estruturas por facilidade.",
    "FORMATOS OFICIAIS (use EXCLUSIVAMENTE estes quatro, nada além): Vídeo, Motion, Carrossel, Estático.",
    "DISTRIBUIÇÃO: se o input trouxer `formatCounts` ({ video, motion, carrossel, estatico }), gere EXATAMENTE essa quantidade de cada formato. Respeite também `objective` e `observations` do input quando presentes.",
    "Retorne um JSON com exatamente estas chaves:",
    '- "positioning": string · "pillars": string[] · "objectives": objeto · "rationale": string',
    '- "lines": array com pelo menos 1 objeto: { "name": string, "objective": "authority"|"trust"|"educate"|"reduce_objection"|"attract"|"identify"|"position"|"desire"|"relationship"|"convert", "funnelStage": "tofu"|"mofu"|"bofu", "platforms": string[], "categories": [{ "name": string, "themes": Tema[] }] }',
    "Cada TEMA (um conteúdo) DEVE conter OBRIGATORIAMENTE:",
    '    "title": string (Tema),',
    '    "strategicObjective": string (objetivo estratégico do conteúdo),',
    '    "channel": string (ex.: "instagram"),',
    '    "format": "Vídeo" | "Motion" | "Carrossel" | "Estático",',
    '    "hook": string (gancho forte),',
    '    "cta": string (CTA contextualizada — NUNCA genérica repetida),',
    '    "productionNotes": string (observações para produção),',
    '    "copy": objeto estruturado com "format" (video|motion|carrossel|estatico) e:',
    "        • Vídeo/Motion: \"estimatedDuration\" (entre 40s e 2min — NUNCA menos que 40s) e \"sections\": array com as 5 partes na ordem { label, text }: Gancho, Conexão, Desenvolvimento, Virada, CTA. Escreva a NARRAÇÃO COMPLETA falada palavra por palavra (o texto exato que a pessoa fala na câmera/locução), NÃO um resumo nem tópicos. Cada parte deve ser desenvolvida: Gancho 1–2 frases; Conexão, Desenvolvimento e Virada com 3 a 6 frases cada (prosa corrida, com exemplo/cena concreta); CTA 1–2 frases. O TOTAL falado deve ter no mínimo ~130 palavras e idealmente 180–320 palavras — o suficiente para 40 a 120 segundos de locução em ritmo natural. Roteiro curto/resumido é ERRO: se o texto somado der menos de ~130 palavras, reescreva aprofundando antes de finalizar.",
    "        • NEWSJACKING NO GANCHO DE VÍDEO/MOTION (obrigatório quando houver um momento atual disponível): o Gancho (1ª parte) deve CAPTAR A ATENÇÃO associando o tema a um acontecimento ATUAL, notícia, tendência, evento cultural/esportivo ou data comemorativa em alta AGORA (ex.: Copa do Mundo, BBB, Oscar, Black Friday, volta às aulas). Fonte da atualidade, nesta ordem: (1) `input.momento` (o que o operador informou como momento/atualidade — use-o LITERALMENTE); (2) `input.observations`/`context` se citarem algum evento; (3) se nada for informado, use APENAS um evento sazonal/cultural amplamente conhecido e verdadeiro do período (ou uma referência atemporal), NUNCA invente notícia, número, data ou fato específico. Faça a ponte natural do evento para a dor/desejo do público e para a marca nos primeiros 3s — a associação deve fazer sentido, não ser forçada. Vale para Vídeo e Motion.",
    "        • Carrossel: \"slides\": array com NO MÁXIMO 4 telas (JAMAIS mais que 4) — capa + até 2 telas de conteúdo + CTA (pode ter 3 ou 4, nunca 5+). Cada slide é { title, text }: `title` = rótulo curto (até 6 palavras) que nomeia a tela; `text` = copy DESENVOLVIDA de 2 a 4 frases (aprox. 25 a 55 palavras) que entrega a ideia por completo — contexto + argumento + exemplo/prova concreta — e NUNCA uma frase solta, vaga ou genérica. Tela 1 (capa) = gancho forte que abre a promessa e faz deslizar; telas do meio = cada uma aprofunda 1 ponto de verdade, com desenvolvimento real (não título solto); última tela = CTA que FECHA a narrativa (a próxima ação lógica). O carrossel inteiro precisa ter começo, meio e fim dentro dessas ≤4 telas — prefira 4 telas ricas e completas a muitas telas rasas. Se alguma tela ficar vaga ou curta demais, REESCREVA aprofundando antes de finalizar.",
    "        • Estático: \"static\": { headline, subheadline, body, cta, designNotes }. TEXTO CURTO para casar com a ARTE — `headline`, `subheadline`, `body` e `cta` com NO MÁXIMO 10 palavras CADA (o `body` é 1 frase curta, NÃO um texto desenvolvido). `designNotes` pode ser mais descritivo (é instrução de arte, não vai na peça). Peça de arte NÃO leva texto longo.",
    "QUALIDADE (valide ANTES de finalizar; se qualquer resposta for negativa, REESCREVA): há contexto suficiente? há desenvolvimento? há começo, meio e fim? há CTA? há valor real? está pronto para produção? um Designer conseguiria produzir só lendo isto?",
    "Escreva o conteúdo final no tom da marca — não descreva o que fazer, ESCREVA. Toda a Linha Editorial deve sair pronta para produção, substituindo a etapa manual de copy.",
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
  "Use TODO o contexto fornecido em `context` — as chaves EXATAS são: `business` (negócio), `market` (mercado/concorrência), `audienceSignals` (personas: demografia, psicografia, canais e — o mais importante — DORES, DESEJOS e OBJEÇÕES reais), `brandVoice` (voz da marca: tom, do/dont, exemplos), `editorialLine` (linha editorial vigente), `clientProfile`, `dossier`, `editorialStock`, `framework`, `memory`, `editorialHistory`, `contentMemory` e `repertoire` (entregas anteriores) — como base. Se houver `context.clientProfile`, são as respostas do PRÓPRIO CLIENTE no onboarding — fonte primária da verdade sobre objetivos, oferta, ICP, concorrentes e voz; quando conflitar com inferências, o que o cliente declarou prevalece. Se houver `context.dossier`, use as recomendações do dossiê estratégico como direção prioritária. Se houver `context.editorialStock`, é o ESTOQUE EDITORIAL — o acervo COMPLETO de linhas já aprovadas e enviadas a este cliente: analise TODAS (não só a última), compare-as entre si e use `comunicacao` (ganchos, CTAs, aberturas, formatos, tamanho médio), `estrategia` (temas recorrentes, categorias, objetivos, posicionamentos, pilares) e `evolucao` (linha do tempo, lacunas) para EVOLUIR a comunicação — preserve a identidade da marca, NUNCA copie conteúdos, NUNCA repita copies, ganchos ou estruturas já usados por facilidade, e priorize assuntos pouco explorados e lacunas editoriais. Se houver `context.framework`, ele é o MÉTODO do usuário: baseie CADA copy, roteiro e linha editorial nele — tem prioridade sobre estilos genéricos. Se houver `context.memory`, trate suas entradas como REGRAS OBRIGATÓRIAS de linguagem, tom e linha editorial — nunca as contrarie. Se houver `context.editorialHistory`, evolua a partir das linhas editoriais anteriores em vez de recomeçar. Se houver `context.contentMemory`, use `themesUsed`, `hooksUsed` e `categoriesUsed` como histórico do que JÁ FOI aprovado: não repita esses temas e ganchos; proponha ângulos novos quando houver padrão repetido. Construa em cima do que já foi levantado pelos outros agentes. Se houver `repertoire`, NÃO repita os mesmos temas, ângulos ou ganchos já usados e evite os erros apontados nos feedbacks. Se houver `context.audienceSignals`, ancore CADA copy nas DORES, DESEJOS e OBJEÇÕES concretas dessas personas — é a matéria-prima da 'dor central' do método; se houver `context.brandVoice`, respeite tom, formalidade, do/dont e exemplos declarados. ATENÇÃO CRÍTICA: `business.brand`/`business.client` são a IDENTIDADE de quem PRODUZ o conteúdo, NÃO o assunto. O mercado/nicho do público é `business.niche` (+ `audienceSignals`). NUNCA trate o nome da marca ou do cliente como se fosse o nicho ou o tema — não escreva coisas como 'empresas de <Nome do Cliente>' ou 'quem trabalha com <Nome do Cliente>'; fale COM o público do nicho real sobre as dores dele.";

/**
 * MÉTODO HARDCOPY + BALACLAVA — base OBRIGATÓRIA de toda copy/roteiro do SOIE.
 * Estrutura narrativa Kishotenketsu (HardCopy) + combustível emocional
 * humanizado (Balaclava). Aplicado de forma rigorosa e INVISÍVEL: o leitor
 * nunca percebe a estrutura, só sente o efeito. (Fonte: skill hardcopy-balaclava,
 * ver packages/ai/src/copy-method/hardcopy-balaclava.md.)
 */
export const COPY_METHOD = [
  "MÉTODO OBRIGATÓRIO DE COPY (HardCopy + Balaclava) — vale para TODO roteiro, legenda, headline, slide, arte, anúncio, e-mail e copy que você escrever:",
  "Copy ruim soa como IA. Copy boa soa como alguém que entende quem está do outro lado. Force SEMPRE: especificidade, cena real e dor nomeada com precisão.",
  "Antes de escrever, defina (lendo `context.audienceSignals` = personas com dores/desejos/objeções, `context.brandVoice` = voz da marca, `context.clientProfile` e o objetivo): (1) QUEM é o público — o que faz, sente, como fala; (2) a DOR central concreta (a manifestação real na vida da pessoa, não a categoria); (3) a EMOÇÃO dominante — Medo, Desejo ou Ambição. Se o contexto for genérico, construa uma cena concreta e plausível do nicho — nunca escreva genérico.",
  "ESTRUTURA KISHOTENKETSU (4 atos, sempre nesta ordem, mas SEM rótulos no texto final e SEM meta-comentário):",
  "• KI (identificação): abre com cena/pergunta/afirmação que o público reconhece na própria vida nos primeiros 3s. Sem marca, sem produto, sem urgência. Tom próximo e coloquial.",
  "• SHO (aprofundamento da dor): aprofunda o Ki com detalhes específicos do nicho; nomeia a dor com precisão e mostra o custo invisível. Ainda SEM solução. O leitor deve pensar 'é exatamente isso'.",
  "• TEN (reviravolta — o coração): elemento inesperado que reorganiza a perspectiva (causa raiz, mecanismo único, novo enquadramento). É AQUI que o produto/serviço aparece — não como apresentação, mas como consequência inevitável da narrativa.",
  "• KETSU (CTA natural): reconcilia tudo; o CTA COMPLETA a história, não empurra. É a próxima cena lógica que a pessoa já vive.",
  "BALACLAVA — uma emoção domina cada peça (as outras só apoiam):",
  "• MEDO (público não reconhece/subestima/procrastina): mostra o custo concreto de NÃO agir (dinheiro, tempo, oportunidade, status). Enquadra como PERDA. Específico > genérico. Nunca manipulação — dor real e verificável.",
  "• DESEJO (público já quer a transformação): projeta a IDENTIDADE futura — quem a pessoa se torna, não as funcionalidades. Aspiracional mas crível.",
  "• AMBIÇÃO (público já tem resultado e quer escalar): conecta ao maior nível — ser e pertencer, status e diferenciação. Identidade antes de funcionalidade.",
  "REGRAS DE LINGUAGEM INVIOLÁVEIS:",
  "• Especificidade: dado/cena concreta sempre que possível ('seu bot caiu às 3h' > 'problemas técnicos'; 'R$0,65 por transação' > 'taxa baixa').",
  "• Tom calibrado por público: executivo = direto e sem adorno; nicho digital/hot = provocador e competitivo; saúde = acolhedor e sem julgamento; lojista = prático e focado em resultado.",
  "• Ritmo: frases curtas para impacto, longas para imersão; parágrafos de no máximo 3 linhas; NADA de bullets no Ki e no Sho (prosa narrativa) — bullets só no Ten para funcionalidades/benefícios concretos.",
  "FRASES PROIBIDAS (são default de IA genérica — se surgirem no rascunho, reescreva com algo específico): 'no mundo atual'/'nos dias de hoje'/'atualmente'; 'é essencial'/'fundamental'/'crucial'; 'potencialize'/'otimize'/'alavanque'/'maximize'; 'transforme sua vida/negócio/resultado'; 'não perca essa oportunidade única'; 'clique aqui e saiba mais'; 'com a nossa solução inovadora'; 'nesse contexto'/'diante desse cenário'; qualquer frase estilo bullet de LinkedIn corporativo.",
  "CTA nunca usa 'clique aqui', 'não perca essa oportunidade', 'aproveite agora'. Entregue só o texto final, pronto para uso — sem explicar o método.",
].join("\n");

/** Agentes que ESCREVEM copy/roteiro — recebem o método HardCopy + Balaclava.
 * Os que só analisam (market, competition, persona, language, evaluator,
 * critic) ficam de fora. */
const COPY_AGENTS = new Set<AgentKey>([
  "planning",
  "scriptwriter",
  "motion",
  "designer",
  "copy",
  "seo",
  "ads",
]);

/** Default Constitution-aligned base prompt for an agent. */
export function baseAgentPrompt(key: AgentKey): string {
  return `Você é o Agente ${key} do SOIE. Siga a Constituição do sistema: contexto antes de conteúdo, pesquisa antes de opinião, e justifique cada decisão. Responda em pt-BR.\n\n${CONTEXT_USAGE_NOTE}`;
}

/** Builds a full system prompt: a base (Constitution) prompt, the copy method
 * (for copy-writing agents) and the agent's output contract, when one exists. */
export function buildAgentPrompt(key: AgentKey, base = baseAgentPrompt(key)): string {
  const withMethod = COPY_AGENTS.has(key) ? `${base}\n\n${COPY_METHOD}` : base;
  const contract = AGENT_OUTPUT_CONTRACTS[key];
  return contract ? `${withMethod}\n\n${contract}` : withMethod;
}
