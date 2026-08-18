/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  EDITORIAL_FORMATS,
  formatLabel,
  toFormatKey,
  clampSlideCount,
  type FormatCounts,
  type FormatKey,
  type StructuredCopy,
  type CopySlide,
} from "@/lib/editorial-format";

/**
 * Geração padronizada da Linha Editorial (V3). Cada conteúdo sai PRONTO PARA
 * PRODUÇÃO: tema, objetivo estratégico, formato, gancho, copy completa, CTA e
 * observações de produção. Vídeo/Motion seguem a estrutura de 5 partes
 * (Gancho → Conexão → Desenvolvimento → Virada → CTA), Carrossel entrega slides
 * desenvolvidos e Estático entrega headline/subheadline/corpo/CTA/design.
 *
 * Este módulo gera o conteúdo de demonstração (sem chave de IA) E também
 * normaliza/valida a saída do modelo real, garantindo que nada superficial ou
 * incompleto seja salvo.
 */

export interface GenerationContext {
  brand: string;
  niche: string;
  objective?: string;
  observations?: string;
}

export interface GeneratedTheme {
  title: string;
  channel: string;
  format: string; // rótulo oficial: Vídeo | Motion | Carrossel | Estático
  strategicObjective: string;
  hook: string;
  cta: string;
  productionNotes: string;
  copy: StructuredCopy;
}

const ANGLES = [
  { title: (n: string) => `O erro silencioso que trava resultados em ${n}`, obj: "Autoridade — educar o público sobre um erro comum" },
  { title: (n: string) => `O que ninguém te conta antes de investir em ${n}`, obj: "Reduzir objeção — antecipar dúvidas e medos" },
  { title: (_: string, b: string) => `Bastidores: como a ${b} entrega resultado de verdade`, obj: "Prova — gerar confiança com bastidores reais" },
  { title: (n: string) => `3 sinais de que está na hora de mudar sua estratégia de ${n}`, obj: "Atrair — identificar a dor do público" },
  { title: (_: string, b: string) => `Antes e depois de um cliente real da ${b}`, obj: "Prova social — mostrar transformação concreta" },
  { title: (n: string) => `A verdade sobre ${n} que o mercado não gosta de falar`, obj: "Posicionamento — quebra de padrão e autoridade" },
  { title: (_: string, b: string) => `Como começar com a ${b} sem risco`, obj: "Conversão — reduzir fricção e chamar para a ação" },
  { title: (n: string) => `O passo a passo que aplicamos em ${n}`, obj: "Educar — demonstrar método e conhecimento" },
];

function angle(i: number, ctx: GenerationContext) {
  const a = ANGLES[i % ANGLES.length]!;
  return { title: a.title(ctx.niche, ctx.brand), obj: a.obj };
}

function ctaFor(i: number, ctx: GenerationContext): string {
  const list = [
    `Comente “EU QUERO” que a ${ctx.brand} te envia o próximo passo.`,
    `Salve este conteúdo e compartilhe com quem precisa ver isso.`,
    `Chame a ${ctx.brand} no direct e solicite uma avaliação sem compromisso.`,
    `Toque no link da bio e agende uma conversa com a ${ctx.brand}.`,
    `Compartilhe nos stories e marque a ${ctx.brand}.`,
  ];
  return list[i % list.length]!;
}

function objectiveNote(ctx: GenerationContext, fallback: string): string {
  return ctx.objective?.trim() ? `${fallback} · Alinhado ao objetivo da linha: ${ctx.objective.trim()}` : fallback;
}

/** Vídeo/Motion: narração completa gravável (40s a 2min), 5 partes. A copy é a
 * fala palavra por palavra — desenvolvida o bastante para 40–120s de locução
 * (mín. ~130 palavras, ideal 180–320), nunca um resumo. */
function scriptCopy(i: number, ctx: GenerationContext, isMotion: boolean): StructuredCopy {
  const { title } = angle(i, ctx);
  const durations = ["50s", "1min05s", "1min20s", "1min40s", "55s"];
  const sections = [
    {
      label: "Gancho",
      text: `${title}? Segura aí os próximos segundos, porque isso muda a forma como você enxerga ${ctx.niche} — e provavelmente explica por que tanta coisa que você tenta não engata como deveria.`,
    },
    {
      label: "Conexão",
      text: `Se você vive de ${ctx.niche}, essa cena é familiar: você se dedica, testa uma ideia atrás da outra, posta, investe tempo e dinheiro — e mesmo assim o resultado vem em soluço, num mês aparece e no outro some. Cansa. E o pior é a sensação de que o esforço não está virando previsibilidade. A gente convive com isso todos os dias na ${ctx.brand}, então não vou te dar fórmula mágica: vou te mostrar o que realmente trava.`,
    },
    {
      label: "Desenvolvimento",
      text: `O que quase ninguém te conta é que o problema raramente está no seu produto ou no seu talento — está na estrutura por trás dele. Comunicação sem clareza, oferta que o cliente não entende em segundos, ausência de prova real e uma frequência que oscila. Quando esses quatro pontos ficam soltos, cada ação começa do zero e nada acumula. Na ${ctx.brand} a gente organiza isso na ordem certa: primeiro deixa nítido o que você resolve e para quem, depois estrutura a prova (casos, bastidores, números reais) e só então define um ritmo de conteúdo que sustenta a mensagem em vez de repetir a mesma coisa. É método, passo a passo, sem achismo.`,
    },
    {
      label: "Virada",
      text: `E aqui está o insight que vira a chave: não é sobre trabalhar mais, é sobre trabalhar com estrutura. No instante em que clareza, prova e consistência passam a jogar juntas, o resultado deixa de depender de sorte e começa a se repetir. Foi exatamente assim que os nossos clientes saíram do improviso — daquele "vamos ver se pega" — para um crescimento que dá pra prever e planejar.`,
    },
    { label: "CTA", text: ctaFor(i, ctx) },
  ];
  return {
    format: isMotion ? "motion" : "video",
    estimatedDuration: durations[i % durations.length],
    sections,
  };
}

/** Headline curta (≤10 palavras) para arte — sem jogar o nicho cru na peça. */
const SHORT_HEADLINES = [
  "O erro que trava seu resultado",
  "O que ninguém te conta antes",
  "Bastidores: resultado de verdade",
  "3 sinais de que precisa mudar",
  "Antes e depois de um cliente real",
  "A verdade que o mercado evita",
  "Comece sem risco",
  "O passo a passo que aplicamos",
];
function shortHeadline(i: number): string {
  return SHORT_HEADLINES[i % SHORT_HEADLINES.length]!;
}
/** CTA curto (poucas palavras) para arte. */
const SHORT_CTAS = ["Comente “EU QUERO”.", "Salve e compartilhe.", "Chame no direct.", "Toque no link da bio.", "Marque a gente nos stories."];
function shortCta(i: number): string {
  return SHORT_CTAS[i % SHORT_CTAS.length]!;
}

/** Blocos de desenvolvimento (miolo do roteiro) reutilizados para compor N telas. */
const CAROUSEL_DEV_BLOCKS = [
  "O que trava o resultado é a falta de estrutura na comunicação. Sem clareza, o público não entende em segundos o que você resolve e passa reto — a mensagem fala de você, não da dor dele. E o algoritmo só entrega para mais gente o conteúdo que já prendeu quem viu; se ninguém para, ninguém alcança.",
  "Repare no padrão: quase todo post tenta falar com todo mundo ao mesmo tempo. Quando a mensagem não mira uma dor específica, ela vira ruído — a pessoa rola o feed e nem registra que passou por ali. Especificidade é o que faz alguém sentir 'isso é sobre mim'.",
  "Na prática, isso vira um ciclo caro: você produz mais para compensar, gasta tempo e energia, e ainda assim o perfil não cresce nem gera conversa. Cada semana sem estrutura é audiência que não volta, autoridade que não se constrói e venda que não acontece.",
  "Falta também a prova. Promessa sem evidência é só mais um anúncio em que ninguém acredita — case real, print de resultado, depoimento e bastidor constroem a confiança que a venda precisa antes de qualquer oferta.",
  "E há a consistência: aparecer com método, no ritmo certo, sem repetir sempre a mesma ideia. É a repetição estratégica que fixa o posicionamento na cabeça do público e transforma seguidor em cliente ao longo do tempo.",
  "Some tudo isso e o efeito é composto: clareza atrai, prova convence e consistência mantém. Cada peça deixa de ser um tiro isolado e passa a construir uma narrativa que leva a pessoa do primeiro contato até a decisão.",
];

/** Carrossel demo com EXATAMENTE `slideCount` telas (2–8), como um ROTEIRO
 * conectado — abertura → desenvolvimento(s) → fechamento/CTA. Cada tela tem
 * conteúdo próprio e desenvolvido; nunca frase de efeito solta nem tela vazia. */
function carouselCopy(i: number, ctx: GenerationContext, slideCount = 5): StructuredCopy {
  const n = Math.min(8, Math.max(2, Math.round(slideCount) || 5));
  const opening = {
    title: "Abertura",
    text: `${shortHeadline(i)}. Você posta com frequência, aparece, capricha no visual — e mesmo assim sente que o retorno não acompanha o esforço. Se isso soa familiar, o problema quase nunca é falta de trabalho: é uma peça invisível que trava tudo por trás. Deslize que eu vou te mostrar exatamente onde está o gargalo.`,
  };
  const closing = {
    title: "Fechamento",
    text: `A saída não é postar mais, é postar com método: clareza para o público se enxergar, prova real para sustentar a promessa e consistência para manter o ritmo. Com essa base, o mesmo esforço vira resultado previsível. Se você quer ajustar isso antes do próximo conteúdo, ${shortCta(i).toLowerCase()} — a ${ctx.brand} te mostra por onde começar.`,
  };
  const middleCount = Math.max(0, n - 2);
  const middles = Array.from({ length: middleCount }, (_, k) => ({
    title: `Desenvolvimento ${k + 1}`,
    text: CAROUSEL_DEV_BLOCKS[k % CAROUSEL_DEV_BLOCKS.length]!,
  }));
  // n === 2 → [abertura, fechamento]; n > 2 → abertura + miolos + fechamento.
  const slides = n === 2 ? [opening, closing] : [opening, ...middles, closing];
  return { format: "carrossel", slides, slideCount: n };
}

/**
 * Ajusta uma copy de carrossel para EXATAMENTE `target` telas (2–8), tanto no
 * fluxo real quanto no demo. Preserva a narrativa: excesso → mantém abertura +
 * fechamento e amostra o miolo; falta → completa com blocos de desenvolvimento
 * REAIS (nunca telas vazias, nunca corte cego). Define `slideCount`. É o
 * mecanismo de reparo quando a IA devolve uma quantidade diferente da pedida.
 */
export function enforceCarouselCopy(copy: StructuredCopy | undefined, target: number, ctx: GenerationContext, i = 0): StructuredCopy {
  const n = clampSlideCount(target);
  const base: StructuredCopy = copy && typeof copy === "object" ? { ...copy, format: "carrossel" } : { format: "carrossel" };
  const slides: CopySlide[] = Array.isArray(base.slides) ? base.slides.filter((s) => str(s?.text)) : [];

  if (slides.length === n) return { ...base, slides, slideCount: n };

  if (slides.length > n) {
    const first = slides[0]!;
    const last = slides[slides.length - 1]!;
    const middle = slides.slice(1, -1);
    const need = n - 2;
    const picked: CopySlide[] = [];
    for (let k = 0; k < need && middle.length > 0; k++) {
      const idx = need <= 1 ? 0 : Math.round((k * (middle.length - 1)) / (need - 1));
      picked.push(middle[Math.min(middle.length - 1, idx)]!);
    }
    const kept = n === 2 ? [first, last] : [first, ...picked, last];
    return { ...base, slides: kept.slice(0, n), slideCount: n };
  }

  // slides.length < n → completa preservando o que a IA trouxe e adicionando
  // desenvolvimento real (do roteiro demo) até bater a contagem.
  if (slides.length === 0) {
    return { ...base, slides: carouselCopy(i, ctx, n).slides ?? [], slideCount: n };
  }
  const first = slides[0]!;
  const last = slides[slides.length - 1]!;
  const out: CopySlide[] = [first, ...slides.slice(1, -1)];
  let d = 1;
  while (out.length < n - 1) {
    out.push({ title: `Desenvolvimento ${d}`, text: CAROUSEL_DEV_BLOCKS[(d - 1) % CAROUSEL_DEV_BLOCKS.length]! });
    d++;
  }
  out.push(last);
  return { ...base, slides: out.slice(0, n), slideCount: n };
}

/** Estático: textos CURTOS (≤10 palavras) para casar com a arte. Profundidade
 * fica em designNotes (instrução de arte, não vai na peça). */
function staticCopy(i: number, ctx: GenerationContext): StructuredCopy {
  return {
    format: "estatico",
    static: {
      headline: shortHeadline(i),
      subheadline: "Sem estrutura, todo o seu esforço vira resultado imprevisível.",
      body: "Clareza pra entenderem você em segundos, prova pra sustentar a promessa e consistência pra manter o ritmo. É isso que separa quem só aparece de quem vende.",
      caption:
        "Você já sentiu que faz tudo certo — posta, aparece, se dedica — e mesmo assim o retorno não vem no mesmo tamanho do esforço? Na maioria das vezes o problema não é falta de trabalho, é falta de estrutura por trás do conteúdo. " +
        "Quando não existe clareza, o público não entende em segundos o que você resolve e passa reto. Quando não existe prova, a promessa não se sustenta e a venda trava na desconfiança. E quando não existe consistência, cada post vira um recomeço do zero. " +
        `Estrutura é o que transforma esforço em resultado previsível — e é exatamente por aí que a gente começa na ${ctx.brand}. Me chama que eu te mostro o primeiro passo.`,
      cta: shortCta(i),
      designNotes: `Alto contraste, headline em destaque no topo, muito respiro, logo e CTA no rodapé. 1 ideia visual forte. Marca: ${ctx.brand}.`,
    },
  };
}

function makeTheme(format: FormatKey, i: number, ctx: GenerationContext, slideCount?: number): GeneratedTheme {
  const { title, obj } = angle(i, ctx);
  const label = formatLabel(format);
  const copy = format === "carrossel" ? carouselCopy(i, ctx, slideCount ?? 5)
    : format === "estatico" ? staticCopy(i, ctx)
    : scriptCopy(i, ctx, format === "motion");
  const hook = format === "carrossel" ? (copy.slides?.[0]?.text ?? title)
    : format === "estatico" ? (copy.static?.headline ?? title)
    : (copy.sections?.[0]?.text ?? title);
  const prod = format === "video" ? "Roteiro gravável de 40s a 2min (narração completa por extenso). Gravar em vertical, cortes secos a cada frase-chave, legenda queimada. Foco no rosto no gancho."
    : format === "motion" ? "Animar as 5 partes com ritmo; texto na tela sincronizado com a locução; trilha upbeat leve; paleta da marca."
    : format === "carrossel" ? "1 ideia por slide, headline em alto contraste no slide 1, seta de deslize, CTA destacado no último slide."
    : "Peça única de feed (1080x1350). Headline forte, corpo legível, CTA claro; usar identidade visual da marca.";
  return {
    title,
    channel: "instagram",
    format: label,
    strategicObjective: objectiveNote(ctx, obj),
    hook,
    cta: ctaFor(i, ctx),
    productionNotes: prod,
    copy,
  };
}

/** Gera exatamente a distribuição de formatos solicitada, cada conteúdo pronto
 * para produção. Agrupa os temas por formato dentro de uma única linha. */
export function buildDemoThemes(ctx: GenerationContext, counts: FormatCounts, carouselSlides?: number[]): GeneratedTheme[] {
  const out: GeneratedTheme[] = [];
  let i = 0;
  for (const { key } of EDITORIAL_FORMATS) {
    const n = Math.max(0, Math.floor(counts[key] ?? 0));
    for (let k = 0; k < n; k++) {
      // Cada carrossel demo respeita a quantidade individual de telas pedida.
      const slideCount = key === "carrossel" ? carouselSlides?.[k] : undefined;
      out.push(makeTheme(key, i++, ctx, slideCount));
    }
  }
  return out;
}

/** Coage um tema (vindo do modelo real OU do demo) para o shape persistido,
 * garantindo que nada superficial seja salvo. Preenche faltas de forma segura. */
export function coerceTheme(raw: any, ctx: GenerationContext, index: number): GeneratedTheme {
  const format = toFormatKey(raw?.format);
  // Se a copy do modelo não vier estruturada, reconstrói a partir do demo para
  // garantir profundidade (regra: reescrever quando incompleto).
  const base = makeTheme(format, index, ctx);
  const copy: StructuredCopy = normalizeCopyInput(raw?.copy, format) ?? base.copy;
  return {
    title: str(raw?.title) || base.title,
    channel: str(raw?.channel) || "instagram",
    format: formatLabel(format),
    strategicObjective: str(raw?.strategicObjective) || base.strategicObjective,
    hook: str(raw?.hook) || base.hook,
    cta: str(raw?.cta) || base.cta,
    productionNotes: str(raw?.productionNotes) || base.productionNotes,
    copy,
  };
}

/** Valida se o tema está pronto para produção (contexto, desenvolvimento,
 * começo-meio-fim, CTA e profundidade). Retorna a lista de problemas. */
export function validateThemeReady(t: GeneratedTheme): string[] {
  const issues: string[] = [];
  if (!t.title) issues.push("sem tema");
  if (!t.hook) issues.push("sem gancho");
  if (!t.cta) issues.push("sem CTA");
  if (!t.productionNotes) issues.push("sem observações de produção");
  const key = toFormatKey(t.format);
  const wc = (s: string) => (s ? s.trim().split(/\s+/).filter(Boolean).length : 0);
  if (key === "carrossel") {
    // Roteiro conectado com a quantidade EXATA de telas pedida pelo usuário.
    const slides = t.copy.slides ?? [];
    const target = typeof t.copy.slideCount === "number" ? t.copy.slideCount : undefined;
    if (slides.length < 2) issues.push("carrossel raso (< 2 telas)");
    if (target !== undefined && slides.length !== target) issues.push(`carrossel com ${slides.length} telas (esperado ${target})`);
    if (slides.some((s) => !str(s?.text))) issues.push("carrossel com tela vazia");
  } else if (key === "estatico") {
    // Arte: textos CURTOS (≤10 palavras). Só exige headline + body presentes.
    if (!t.copy.static?.headline) issues.push("estático sem headline");
    if (!t.copy.static?.body) issues.push("estático sem texto");
    if (wc(str(t.copy.static?.body)) > 12) issues.push("estático com texto longo (>10 palavras)");
  } else {
    const words = (t.copy.sections ?? []).map((s) => s.text).join(" ").split(/\s+/).filter(Boolean).length;
    if ((t.copy.sections ?? []).length < 5) issues.push("roteiro sem as 5 partes");
    // Locução natural ≈ 2,2–2,5 palavras/s → 40s exige ~110–130 palavras.
    if (words < 130) issues.push("roteiro curto para 40–120s (< ~130 palavras)");
  }
  return issues;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function normalizeCopyInput(copy: unknown, format: FormatKey): StructuredCopy | null {
  if (!copy) return null;
  if (typeof copy === "object" && !Array.isArray(copy) && "format" in (copy as any)) {
    return { ...(copy as StructuredCopy), format };
  }
  // Legado: array de strings → slides (carrossel) ; string → corpo/seção única.
  if (Array.isArray(copy)) {
    if (format === "carrossel") return { format, slides: copy.map((t, i) => ({ title: i === 0 ? "Headline" : `Slide ${i + 1}`, text: str(t) })) };
    return { format, sections: [{ label: "Copy", text: copy.map(str).filter(Boolean).join("\n\n") }] };
  }
  if (typeof copy === "string" && copy.trim()) {
    if (format === "estatico") return { format, static: { headline: "", body: copy.trim() } };
    return { format, sections: [{ label: "Copy", text: copy.trim() }] };
  }
  return null;
}
