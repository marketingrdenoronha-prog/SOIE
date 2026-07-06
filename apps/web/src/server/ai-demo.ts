/* eslint-disable @typescript-eslint/no-explicit-any */
import type { AgentKey, Channel, DeliverableType } from "@soie/contracts";

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

    case "planning":
      return {
        positioning: `${brand}: a escolha segura em ${nk}, para quem quer resultado sem dor de cabeça.`,
        pillars: ["Autoridade (educar sobre o tema)", "Prova (cases e bastidores)", "Conexão (dia a dia e valores)", "Conversão (oferta e CTA)"],
        objectives: { alcance: "crescer topo de funil com vídeo curto", autoridade: "1 conteúdo educativo/semana", conversao: "1 oferta clara/semana" },
        rationale: "Distribuição 40% autoridade, 25% prova, 20% conexão, 15% conversão — constrói confiança antes de pedir a venda.",
        confidence: "medium",
        lines: [
          {
            name: "Autoridade",
            objective: "authority",
            funnelStage: "tofu",
            platforms: ["instagram", "tiktok"],
            categories: [
              {
                name: "Mitos e verdades",
                themes: [
                  {
                    title: `3 erros comuns em ${nk}`,
                    channel: "instagram",
                    format: "Carrossel",
                    copy: [
                      `Todo mundo em ${nk} comete estes 3 erros.`,
                      `Erro 1: decidir no achismo, sem dado.`,
                      `Erro 2: copiar o concorrente em vez de olhar o próprio cliente.`,
                      `Erro 3: parar de aparecer quando as vendas chegam.`,
                      `Quer evitar os três? Chama a ${brand} no link da bio.`,
                    ],
                  },
                  {
                    title: "O que ninguém te conta antes de contratar",
                    channel: "instagram",
                    format: "Estático",
                    copy: `Ninguém te conta, mas o problema raramente é o produto.\n\nÉ a estrutura por trás dele.\n\nA ${brand} resolve a estrutura pra você focar no que importa: vender.`,
                  },
                ],
              },
            ],
          },
          {
            name: "Prova",
            objective: "trust",
            funnelStage: "mofu",
            platforms: ["instagram"],
            categories: [
              {
                name: "Cases",
                themes: [
                  {
                    title: "Antes e depois de um cliente real",
                    channel: "instagram",
                    format: "Reels",
                    copy: `Antes: perdido, sem previsibilidade.\n\nDepois de 30 dias com a ${brand}: processo redondo e resultado no painel.\n\nSalva esse post e vem ser o próximo case.`,
                  },
                ],
              },
            ],
          },
          {
            name: "Conversão",
            objective: "convert",
            funnelStage: "bofu",
            platforms: ["instagram", "meta_ads"],
            categories: [
              {
                name: "Oferta",
                themes: [
                  {
                    title: "Chamada com garantia e próximo passo",
                    channel: "instagram",
                    format: "Estático",
                    copy: `Chega de adiar.\n\nCom a ${brand} você começa hoje, com garantia.\n\nToca no link da bio e dá o próximo passo. 🚀`,
                  },
                ],
              },
            ],
          },
        ],
      };

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
      return {
        hook: `Você está perdendo dinheiro sem saber${b ? " —" + b : ""}?`,
        scenes: [
          { n: 1, seconds: 3, visual: "Close no rosto, corte seco", voiceover: "Se você faz isso, para agora.", onScreenText: "PARE" },
          { n: 2, seconds: 6, visual: "Demonstração do problema", voiceover: "A maioria comete esse erro e nem percebe.", onScreenText: "O erro nº 1" },
          { n: 3, seconds: 8, visual: "Você mostrando a solução", voiceover: "O jeito certo é assim, ó.", brollNotes: "Mostrar prova/resultado" },
          { n: 4, seconds: 4, visual: "Chamada final", voiceover: "Comenta 'EU QUERO' que eu te explico.", onScreenText: "EU QUERO 👇" },
        ],
        cta: "Comenta 'EU QUERO' para receber o passo a passo",
        caption: "Salva esse vídeo para não esquecer. 🔖",
        hashtags: ["marketing", "dicas", channel],
      };
    case "motion_script":
      return {
        scenes: [
          { n: 1, timing: "0:00–0:03", elements: "Logo entra com fade", onScreenText: "3 motivos", transition: "corte", motionNotes: "ease-out suave" },
          { n: 2, timing: "0:03–0:08", elements: "Ícones surgem em sequência", onScreenText: "Motivo 1, 2 e 3", transition: "slide", motionNotes: "stagger 0.2s" },
          { n: 3, timing: "0:08–0:12", elements: "CTA pulsando", onScreenText: "Fale com a gente", transition: "zoom", motionNotes: "loop sutil" },
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
