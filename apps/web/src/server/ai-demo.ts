/* eslint-disable @typescript-eslint/no-explicit-any */
import type { AgentKey, Channel, DeliverableType } from "@soie/contracts";
import { EDITORIAL_FORMATS, formatLabel, type FormatCounts } from "@/lib/editorial-format";
import { buildDemoThemes, type GenerationContext } from "@/server/editorial-content";

/**
 * Conteúdo estruturado de demonstração, por agente e por tipo de entrega.
 *
 * Motivo: sem uma chave de IA configurada, os adapters caem num stub que
 * devolve texto solto — e aí os módulos (Mercado, Audiência, DNA, Editorial)
 * e as Entregas salvam vazio, sem nada para exibir. Este gerador produz a
 * forma EXATA que cada módulo lê (SWOT, personas com dores/objeções,
 * arquétipos, pilares, roteiros por formato), usando o contexto da marca, de
 * modo que o produto inteiro funciona de ponta a ponta de graça. Quando uma
 * chave real existe, o modelo é instruído a devolver esse mesmo JSON — então
 * o formato é idêntico, muda só a qualidade/originalidade do conteúdo.
 *
 * Não é "fake": é um ponto de partida editável e coerente com a marca. A UI
 * marca esses resultados com confiança "medium" e um aviso de modo demo.
 */

function brandName(input: any): string {
  return (input?.brand || input?.brandName || input?.name || "sua marca").toString().trim();
}
function niche(input: any): string {
  return (input?.positioning || input?.nicho || input?.goal || "seu mercado").toString().slice(0, 80);
}

/** Distribuição de formatos pedida pelo usuário; default sensato quando ausente. */
function resolveCounts(raw: any): FormatCounts {
  const n = (v: any) => Math.max(0, Math.min(50, Math.floor(Number(v) || 0)));
  const c = { video: n(raw?.video), motion: n(raw?.motion), carrossel: n(raw?.carrossel), estatico: n(raw?.estatico) };
  if (c.video + c.motion + c.carrossel + c.estatico === 0) return { video: 2, motion: 1, carrossel: 2, estatico: 1 };
  return c;
}

export function demoAgentOutput(key: AgentKey, input: any): Record<string, unknown> {
  const brand = brandName(input);
  const nk = niche(input);
  switch (key) {
    case "market":
      return {
        summary: `Panorama de ${brand}: mercado aquecido em ${nk}, com espaço para uma marca que comunica com clareza e prova de resultado. A disputa hoje é mais por atenção e confiança do que por preço.`,
        swot: {
          strengths: [`Proposta clara em ${nk}`, "Agilidade para produzir conteúdo", "Relação próxima com o cliente"],
          weaknesses: ["Presença digital ainda inconsistente", "Poucos ativos de prova social", "Marca pouco memorável"],
          opportunities: ["Conteúdo educativo para gerar autoridade", "Nichar a comunicação por dor específica", "Parcerias e co-marketing"],
          threats: ["Concorrentes com mais volume de conteúdo", "Commoditização da oferta", "Dependência de indicação"],
        },
        trends: [
          "Vídeo curto vertical dominando o alcance orgânico",
          "Conteúdo de bastidores e prova real ganhando confiança",
          "Busca por especialistas de nicho em vez de generalistas",
        ],
        opportunities: [
          `Assumir uma dor específica de ${nk} e virar referência nela`,
          "Transformar cases em série de conteúdo recorrente",
          "Criar um formato editorial próprio e reconhecível",
        ],
        threats: ["Ruído de concorrentes com maior frequência de posts", "Queda de alcance orgânico sem consistência"],
        confidence: "medium",
      };

    case "competition":
      return {
        summary: `Mapa competitivo de ${brand}. A maioria comunica recurso, não resultado — abre espaço para uma marca que fala a língua do cliente.`,
        competitors: [
          { name: "Concorrente A", url: "", positioning: "Líder em volume, comunicação genérica", strengths: ["Alcance", "Reconhecimento"], weaknesses: ["Impessoal", "Pouca prova real"] },
          { name: "Concorrente B", url: "", positioning: "Preço baixo como principal apelo", strengths: ["Entrada acessível"], weaknesses: ["Percepção de baixo valor", "Alta rotatividade"] },
          { name: "Concorrente C", url: "", positioning: "Nichado e técnico", strengths: ["Autoridade no nicho"], weaknesses: ["Comunicação difícil", "Escala limitada"] },
        ],
        confidence: "medium",
      };

    case "persona":
      return {
        name: `Cliente ideal de ${brand}`,
        demographics: { faixa_etaria: "28–45", genero: "todos", regiao: "Brasil (urbano)", renda: "média a média-alta" },
        psychographics: { valores: ["confiança", "resultado", "praticidade"], estilo: "busca solução sem enrolação", gatilhos: ["prova", "autoridade", "urgência real"] },
        channels: ["instagram", "whatsapp", "google"],
        awarenessLevel: "problem_aware",
        languageNotes: { usa: ["linguagem direta", "exemplos concretos"], evita: ["jargão técnico", "promessa vazia"] },
        pains: [
          { description: "Já se decepcionou com fornecedores que prometem e não entregam", intensity: 5 },
          { description: "Não tem tempo para acompanhar detalhes técnicos", intensity: 4 },
          { description: "Tem medo de tomar a decisão errada e perder dinheiro", intensity: 4 },
        ],
        objections: [
          { description: "\"Será que é confiável?\"", counter: "Mostrar cases, provas e garantias logo no início" },
          { description: "\"Está caro\"", counter: "Ancorar no custo de continuar com o problema" },
          { description: "\"Vou pensar\"", counter: "Oferecer um primeiro passo de baixo risco" },
        ],
        desires: [
          { description: "Sentir que está em boas mãos", strength: 5 },
          { description: "Ver resultado rápido e visível", strength: 4 },
        ],
        confidence: "medium",
      };

    case "language":
      return {
        tone: { descricao: `Voz de ${brand}: próxima, segura e direta. Fala como especialista que respeita o tempo do cliente.`, adjetivos: ["confiante", "acessível", "objetiva"] },
        formality: "medium",
        emojisPolicy: { uso: "moderado", quando: "para dar ritmo, nunca para infantilizar" },
        do: ["Falar em resultado e benefício", "Usar prova concreta", "Frases curtas e claras", "Chamar para uma ação por peça"],
        dont: ["Prometer o impossível", "Jargão sem explicar", "Texto longo sem respiro", "Falar de si mais do que do cliente"],
        examples: [`"Em ${nk}, o que importa é resultado — e a gente mostra o nosso."`, "\"Sem enrolação: veja como funciona.\""],
        archetypes: [
          { archetype: "Sábio", weight: 0.6, rationale: "Autoridade que educa e orienta" },
          { archetype: "Herói", weight: 0.4, rationale: "Resolve o problema e entrega a vitória" },
        ],
        vocabulary: [
          { kind: "usar", term: "resultado", note: "palavra-âncora da marca" },
          { kind: "usar", term: "prova", note: "reforça confiança" },
          { kind: "evitar", term: "barato", note: "corrói percepção de valor" },
        ],
        confidence: "medium",
      };

    case "planning": {
      const ctx: GenerationContext = {
        brand,
        niche: nk,
        objective: typeof input?.objective === "string" ? input.objective : undefined,
        observations: typeof input?.observations === "string" ? input.observations : (typeof input?.brief === "string" ? input.brief : undefined),
      };
      const counts = resolveCounts(input?.formatCounts);
      const themes = buildDemoThemes(ctx, counts);
      // Agrupa os temas por formato em categorias dentro de uma única linha.
      const byFormat = EDITORIAL_FORMATS
        .map((f) => ({ name: formatLabel(f.key), themes: themes.filter((t) => t.format === formatLabel(f.key)) }))
        .filter((c) => c.themes.length > 0);
      const total = themes.length;
      return {
        positioning: `${brand}: a escolha segura em ${nk}, para quem quer resultado sem dor de cabeça.`,
        pillars: ["Autoridade (educar sobre o tema)", "Prova (cases e bastidores)", "Conexão (dia a dia e valores)", "Conversão (oferta e CTA)"],
        objectives: ctx.objective ? { objetivo: ctx.objective, total } : { total, foco: "autoridade + conversão" },
        rationale: `Distribuição pronta para produção: ${byFormat.map((c) => `${c.themes.length} ${c.name}`).join(", ")}. Cada conteúdo já sai com gancho, copy completa, CTA e observações de produção.`,
        confidence: "medium",
        lines: [
          {
            name: "Linha Editorial",
            objective: "authority",
            funnelStage: "tofu",
            platforms: ["instagram"],
            categories: byFormat,
          },
        ],
      };
    }

    default:
      return {
        text: `Rascunho de ${brand} para ${key}. Configure uma chave de IA para gerar conteúdo original.`,
        confidence: "low",
      };
  }
}

/** Spec de entrega por formato, no shape exato que o SpecView renderiza. */
export function demoDeliverableSpec(type: DeliverableType, channel: Channel, brief?: string): any {
  const b = brief?.trim() ? ` (${brief.trim().slice(0, 80)})` : "";
  switch (type) {
    case "video_script":
      // Narração por extenso, ~60–90s de locução (roteiro robusto, não resumo).
      return {
        hook: `Você está perdendo dinheiro sem saber${b ? " —" + b : ""}?`,
        estimatedDuration: "1min10s",
        scenes: [
          { n: 1, seconds: 5, visual: "Close no rosto, corte seco", voiceover: "Para tudo por três segundos, porque isso aqui provavelmente explica por que o seu resultado vem em soluço. Se você faz o que eu vou mostrar agora, você está deixando dinheiro na mesa sem perceber.", onScreenText: "PARA" },
          { n: 2, seconds: 16, visual: "Demonstração do problema no dia a dia", voiceover: "A cena é sempre a mesma: você se dedica, posta, testa uma ideia atrás da outra, investe tempo e dinheiro — e mesmo assim o retorno não vira previsibilidade. Num mês aparece, no outro some. E a maioria comete esse erro sem nem perceber, porque acha que o problema é o produto, quando na verdade é a estrutura por trás dele.", onScreenText: "O erro nº 1" },
          { n: 3, seconds: 22, visual: "Você mostrando a solução, passo a passo", voiceover: "O jeito certo é organizar três coisas na ordem certa. Primeiro, clareza: o cliente precisa entender em segundos o que você resolve e para quem. Segundo, prova: casos, bastidores e números reais que sustentam a promessa. Terceiro, consistência: aparecer com método, no ritmo certo, com uma mensagem que evolui em vez de se repetir. Quando esses três pontos jogam juntos, cada conteúdo acumula em cima do anterior.", brollNotes: "Mostrar prova/resultado real na tela" },
          { n: 4, seconds: 12, visual: "Chamada final, olhando pra câmera", voiceover: "Ou seja: não é sobre trabalhar mais, é sobre trabalhar com estrutura. Foi assim que os nossos clientes saíram do improviso para um crescimento que dá pra prever. Se você quer o passo a passo disso aplicado no seu negócio, comenta 'EU QUERO' que eu te explico.", onScreenText: "EU QUERO 👇" },
        ],
        cta: "Comenta 'EU QUERO' para receber o passo a passo",
        caption: "Salva esse vídeo para não esquecer. 🔖",
        hashtags: ["marketing", "dicas", channel],
      };
    case "motion_script":
      // Locução completa por cena, ~50–70s no total.
      return {
        estimatedDuration: "1min00s",
        scenes: [
          { n: 1, timing: "0:00–0:06", elements: "Logo entra com fade + headline", onScreenText: "3 coisas que mudam o jogo", transition: "corte", motionNotes: "ease-out suave", voiceover: "Existem três coisas que separam quem cresce de quem fica no mesmo lugar — e nenhuma delas depende de sorte." },
          { n: 2, timing: "0:06–0:24", elements: "Ícones surgem em sequência (clareza, prova, consistência)", onScreenText: "Clareza · Prova · Consistência", transition: "slide", motionNotes: "stagger 0.2s", voiceover: "A primeira é clareza: o cliente tem que entender em segundos o que você resolve. A segunda é prova: casos e resultados reais que sustentam o que você promete. E a terceira é consistência: aparecer com método, no ritmo certo, sem repetir sempre a mesma coisa." },
          { n: 3, timing: "0:24–0:45", elements: "Gráfico de crescimento previsível", onScreenText: "Do improviso à previsibilidade", transition: "fade", motionNotes: "curva subindo suave", voiceover: "Quando esses três pontos passam a jogar juntos, o resultado deixa de ser sorte e começa a se repetir. É o que faz a comunicação virar previsibilidade em vez de esforço solto." },
          { n: 4, timing: "0:45–0:58", elements: "CTA pulsando", onScreenText: "Fale com a gente", transition: "zoom", motionNotes: "loop sutil", voiceover: "Se você quer estruturar isso no seu negócio, chama a gente agora e vamos montar o seu plano." },
        ],
        soundtrackMood: "Upbeat, corporativo leve",
        palette: ["#0F172A", "#6366F1", "#22D3EE"],
      };
    case "carousel":
      return {
        slides: [
          { n: 1, title: "3 erros que travam seu resultado", body: "Deslize →", designNote: "Título grande, alto contraste" },
          { n: 2, title: "Erro 1", body: "Falar de você em vez do cliente.", designNote: "Ícone + frase curta" },
          { n: 3, title: "Erro 2", body: "Não mostrar prova.", designNote: "Print/case real" },
          { n: 4, title: "Erro 3", body: "Nenhuma chamada clara.", designNote: "Seta apontando o CTA" },
          { n: 5, title: "Bora resolver?", body: "Chama no direct.", designNote: "CTA em destaque" },
        ],
        caption: "Qual desses erros você já cometeu? Conta aqui 👇",
        cta: "Chama no direct",
      };
    case "design_brief":
      return {
        format: channel === "youtube" ? "Thumbnail" : "Arte estática (feed)",
        dimensions: channel === "youtube" ? "1280x720" : "1080x1350",
        objective: "Parar o scroll e comunicar o benefício em 1 segundo",
        visualDirection: "Alto contraste, rosto humano, 1 frase-âncora",
        copyOnArt: [
          { slot: "Headline", text: "O jeito certo de fazer isso" },
          { slot: "Selo", text: "Passo a passo" },
        ],
        palette: ["#0F172A", "#6366F1", "#FACC15"],
        references: ["Referência de alto contraste", "Estilo editorial limpo"],
      };
    case "copy":
      return {
        variants: [
          { label: "Direta", headline: "Resultado sem enrolação", body: "Você resolve o problema e a gente mostra a prova.", cta: "Fale agora" },
          { label: "Dor", headline: "Cansou de promessa vazia?", body: "Aqui é diferente: processo claro e resultado que dá pra ver.", cta: "Quero ver como" },
          { label: "Prova", headline: "Quem testou, aprovou", body: "Veja o antes e depois de quem já contratou.", cta: "Ver cases" },
        ],
      };
    case "article":
      return {
        title: "Guia prático: como escolher sem errar",
        outline: [
          { heading: "O problema que ninguém explica", points: ["Por que a maioria erra", "O custo de continuar assim"] },
          { heading: "Os critérios que importam", points: ["Critério 1", "Critério 2", "Critério 3"] },
          { heading: "Passo a passo", points: ["Como aplicar hoje", "Erros a evitar"] },
          { heading: "Conclusão + próximo passo", points: ["Resumo", "Chamada para ação"] },
        ],
        seo: { keyword: "como escolher", meta: "Guia prático e direto para decidir sem errar." },
      };
    case "email_sequence":
      return {
        emails: [
          { subject: "Isso pode estar te custando caro", body: "Abertura com a dor + promessa de solução.", cta: "Ver como resolver" },
          { subject: "O erro que quase todo mundo comete", body: "Educa e cria autoridade com um exemplo.", cta: "Continuar lendo" },
          { subject: "Prova real (antes e depois)", body: "Case concreto que quebra a objeção.", cta: "Quero o mesmo" },
          { subject: "Última chamada", body: "Oferta com prazo e garantia.", cta: "Começar agora" },
        ],
      };
    case "ad":
      return {
        platform: channel === "google_ads" ? "Google Ads" : "Meta Ads",
        variants: [
          { headline: "Resultado sem dor de cabeça", primaryText: "Processo claro, prova real e suporte de verdade. Fale com quem entende.", cta: "Saiba mais" },
          { headline: "Pare de perder tempo", primaryText: "A solução certa para o seu problema, com garantia.", cta: "Começar" },
        ],
      };
    default:
      return { text: "Rascunho gerado em modo demo. Configure uma chave de IA para conteúdo original." };
  }
}
