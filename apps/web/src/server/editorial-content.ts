/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  EDITORIAL_FORMATS,
  formatLabel,
  toFormatKey,
  type FormatCounts,
  type FormatKey,
  type StructuredCopy,
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

/** Vídeo/Motion: copy completa gravável (30s a 1min20s), 5 partes. */
function scriptCopy(i: number, ctx: GenerationContext, isMotion: boolean): StructuredCopy {
  const { title, obj } = angle(i, ctx);
  const durations = ["45s", "55s", "1min05s", "1min15s", "50s"];
  const sections = [
    { label: "Gancho", text: `${title}? Presta atenção nos próximos segundos porque isso muda como você enxerga ${ctx.niche}.` },
    { label: "Conexão", text: `Se você trabalha com ${ctx.niche}, provavelmente já sentiu na pele: muito esforço e pouco retorno previsível. A gente entende essa realidade — e ela tem solução.` },
    { label: "Desenvolvimento", text: `O que quase ninguém explica é que o problema raramente está no produto, e sim na estrutura por trás dele. Quando você organiza processo, comunicação e prova de resultado, o jogo vira. Na ${ctx.brand} a gente aplica exatamente isso, passo a passo, sem achismo.` },
    { label: "Virada", text: `Aqui está o ponto que gera o insight: não é sobre trabalhar mais, é sobre trabalhar com método. Foi assim que nossos clientes saíram do improviso para resultado consistente${obj ? "" : ""}.` },
    { label: "CTA", text: ctaFor(i, ctx) },
  ];
  return {
    format: isMotion ? "motion" : "video",
    estimatedDuration: durations[i % durations.length],
    sections,
  };
}

/** Carrossel: slide 1 headline forte, desenvolvimento no miolo, conclusão + CTA. */
function carouselCopy(i: number, ctx: GenerationContext): StructuredCopy {
  const { title } = angle(i, ctx);
  const slides = [
    { title: "Headline", text: `${title}` },
    { title: "Slide 2", text: `A maioria das empresas de ${ctx.niche} acredita que basta aparecer mais. Não é bem assim — sem estrutura, mais volume só amplifica o erro.` },
    { title: "Slide 3", text: `O primeiro pilar é clareza: o cliente precisa entender em segundos o que você resolve e por que confiar em você.` },
    { title: "Slide 4", text: `O segundo é prova: cases, bastidores e resultados reais valem mais que qualquer promessa bonita.` },
    { title: "Slide 5", text: `O terceiro é consistência: aparecer com método, na frequência certa, com uma mensagem que evolui — não que se repete.` },
    { title: "Conclusão + CTA", text: `Junte clareza, prova e consistência e o resultado deixa de ser sorte. A ${ctx.brand} constrói isso com você. ${ctaFor(i, ctx)}` },
  ];
  return { format: "carrossel", slides };
}

/** Estático: headline, subheadline, corpo desenvolvido, CTA e observações de design. */
function staticCopy(i: number, ctx: GenerationContext): StructuredCopy {
  const { title } = angle(i, ctx);
  return {
    format: "estatico",
    static: {
      headline: title,
      subheadline: `O que separa quem cresce de quem estagna em ${ctx.niche}.`,
      body: `Não é o talento, nem a sorte: é a estrutura. Empresas que comunicam resultado com clareza e prova constroem autoridade e vendem com mais previsibilidade. A ${ctx.brand} organiza estratégia, conteúdo e prova para que a sua marca seja a escolha óbvia — sem depender de improviso.`,
      cta: ctaFor(i, ctx),
      designNotes: "Alto contraste, headline em destaque no topo, corpo com respiro, logo e CTA no rodapé. Priorizar 1 ideia visual forte.",
    },
  };
}

function makeTheme(format: FormatKey, i: number, ctx: GenerationContext): GeneratedTheme {
  const { title, obj } = angle(i, ctx);
  const label = formatLabel(format);
  const copy = format === "carrossel" ? carouselCopy(i, ctx)
    : format === "estatico" ? staticCopy(i, ctx)
    : scriptCopy(i, ctx, format === "motion");
  const hook = format === "carrossel" ? (copy.slides?.[0]?.text ?? title)
    : format === "estatico" ? (copy.static?.headline ?? title)
    : (copy.sections?.[0]?.text ?? title);
  const prod = format === "video" ? "Roteiro gravável de 30s a 1min20s. Gravar em vertical, cortes secos a cada frase-chave, legenda queimada. Foco no rosto no gancho."
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
export function buildDemoThemes(ctx: GenerationContext, counts: FormatCounts): GeneratedTheme[] {
  const out: GeneratedTheme[] = [];
  let i = 0;
  for (const { key } of EDITORIAL_FORMATS) {
    const n = Math.max(0, Math.floor(counts[key] ?? 0));
    for (let k = 0; k < n; k++) out.push(makeTheme(key, i++, ctx));
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
  if (key === "carrossel") {
    if (!t.copy.slides || t.copy.slides.length < 3) issues.push("carrossel raso (< 3 slides)");
  } else if (key === "estatico") {
    if (!t.copy.static?.body || t.copy.static.body.length < 120) issues.push("estático raso (corpo curto)");
  } else {
    const words = (t.copy.sections ?? []).map((s) => s.text).join(" ").split(/\s+/).length;
    if ((t.copy.sections ?? []).length < 5) issues.push("roteiro sem as 5 partes");
    if (words < 60) issues.push("roteiro curto (< ~30s)");
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
