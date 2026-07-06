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
 * (Gancho → Conexão → Desenvolvimento → Virada → CTA) com copy suficiente para
 * 40s a 1min20s; Carrossel entrega slides desenvolvidos; Estático entrega
 * headline/subheadline/corpo/CTA/design.
 *
 * Gera o conteúdo de demonstração (sem chave de IA) E normaliza/valida a saída
 * do modelo real — usando ATIVAMENTE o contexto (dossiê, onboarding, personas,
 * voz da marca) para ser assertivo, e garantindo quantidade e profundidade.
 */

export interface GenerationContext {
  brand: string;
  niche: string;
  objective?: string;
  observations?: string;
  valueProposition?: string;
  pains: string[];
  desires: string[];
  dossierNotes?: string;
  onboardingNotes?: string;
  tone?: string;
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

/** Palavras mínimas de um roteiro (Vídeo/Motion) para cobrir ~40s de fala. */
const MIN_SCRIPT_WORDS = 130;

// ─────────────────────────────────────────────────────────────────────────
// Contexto → GenerationContext
// ─────────────────────────────────────────────────────────────────────────

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Coleta valores string de um JSON arbitrário (dossiê/onboarding) num resumo. */
function flattenText(obj: unknown, max = 800): string {
  const parts: string[] = [];
  const walk = (v: any) => {
    if (parts.join(" ").length > max) return;
    if (typeof v === "string") { const t = v.trim(); if (t.length > 2) parts.push(t); }
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === "object") Object.values(v).forEach(walk);
  };
  walk(obj);
  return parts.join(" · ").slice(0, max);
}

/** Monta o GenerationContext a partir do input do usuário + contexto do projeto
 * (business, personas, dossiê, onboarding, voz da marca). É o que torna a copy
 * específica em vez de genérica. */
export function buildGenerationContext(input: any, context?: any): GenerationContext {
  const business = context?.business ?? {};
  const brand = str(input?.brand) || str(business.brand) || "sua marca";
  const niche = pickNiche(business, input, context);
  const personas: any[] = Array.isArray(context?.audienceSignals) ? context.audienceSignals : [];
  const pains = dedupe(personas.flatMap((p) => arrStr(p?.pains))).slice(0, 8);
  const desires = dedupe(personas.flatMap((p) => arrStr(p?.desires))).slice(0, 8);
  const tone = str((context?.brandVoice?.tone as any)?.descricao) || str(context?.brandVoice?.formality) || undefined;

  return {
    brand,
    niche,
    objective: str(input?.objective) || undefined,
    observations: str(input?.observations) || undefined,
    valueProposition: str(business.valueProposition) || undefined,
    pains,
    desires,
    dossierNotes: context?.dossier ? flattenText(context.dossier.summary, 600) : undefined,
    onboardingNotes: context?.onboarding ? flattenText(context.onboarding.payload, 600) : undefined,
    tone,
  };
}

/** Nicho/segmento — usa positioning, senão puxa do onboarding/dossiê (negócio,
 * segmento, mercado) para nunca cair no genérico quando há contexto. */
function pickNiche(business: any, input: any, context: any): string {
  const pick = (o: any, keys: string[]) => {
    for (const k of keys) { const v = str(o?.[k]); if (v) return v; }
    return "";
  };
  const candidate =
    str(business?.positioning) ||
    str(input?.positioning) ||
    pick(context?.onboarding?.payload, ["nicho", "segmento", "mercado", "negocio", "negócio"]) ||
    pick(context?.dossier?.summary, ["nicho", "segmento", "mercado"]) ||
    str(business?.goal) ||
    "seu mercado";
  return candidate.slice(0, 80);
}

function arrStr(v: unknown): string[] {
  return Array.isArray(v) ? v.map(str).filter(Boolean) : [];
}
function dedupe(a: string[]): string[] {
  return Array.from(new Set(a));
}

/** Distribuição pedida pelo usuário; default sensato quando ausente/zerada. */
export function normalizeFormatCounts(raw: any): FormatCounts {
  const n = (v: any) => Math.max(0, Math.min(50, Math.floor(Number(v) || 0)));
  const c = { video: n(raw?.video), motion: n(raw?.motion), carrossel: n(raw?.carrossel), estatico: n(raw?.estatico) };
  if (c.video + c.motion + c.carrossel + c.estatico === 0) return { video: 2, motion: 1, carrossel: 2, estatico: 1 };
  return c;
}

export function totalCount(c: FormatCounts): number {
  return c.video + c.motion + c.carrossel + c.estatico;
}

// ─────────────────────────────────────────────────────────────────────────
// Ângulos e material derivado do contexto
// ─────────────────────────────────────────────────────────────────────────

const ANGLES = [
  { title: (c: GenerationContext) => `O erro silencioso que trava resultados em ${c.niche}`, obj: "Autoridade — educar sobre um erro comum e caro" },
  { title: (c: GenerationContext) => `O que ninguém te conta antes de investir em ${c.niche}`, obj: "Reduzir objeção — antecipar dúvidas e medos" },
  { title: (c: GenerationContext) => `Bastidores: como a ${c.brand} entrega resultado de verdade`, obj: "Prova — gerar confiança com bastidores reais" },
  { title: (c: GenerationContext) => `3 sinais de que está na hora de mudar sua estratégia de ${c.niche}`, obj: "Atrair — nomear a dor do público" },
  { title: (c: GenerationContext) => `Antes e depois de um cliente real da ${c.brand}`, obj: "Prova social — mostrar transformação concreta" },
  { title: (c: GenerationContext) => `A verdade sobre ${c.niche} que o mercado evita falar`, obj: "Posicionamento — quebra de padrão e autoridade" },
  { title: (c: GenerationContext) => `Como começar com a ${c.brand} sem risco`, obj: "Conversão — reduzir fricção e chamar para a ação" },
  { title: (c: GenerationContext) => `O passo a passo que aplicamos em ${c.niche}`, obj: "Educar — demonstrar método e conhecimento" },
];

function angle(i: number, ctx: GenerationContext) {
  const a = ANGLES[i % ANGLES.length]!;
  return { title: a.title(ctx), obj: a.obj };
}
function painAt(i: number, ctx: GenerationContext): string {
  return ctx.pains[i % Math.max(1, ctx.pains.length)] || `os desafios do dia a dia em ${ctx.niche}`;
}
function desireAt(i: number, ctx: GenerationContext): string {
  return ctx.desires[i % Math.max(1, ctx.desires.length)] || `ter resultado previsível e sem dor de cabeça`;
}
function valueProp(ctx: GenerationContext): string {
  const vp = ctx.valueProposition || `a ${ctx.brand} organiza estratégia, conteúdo e prova para você`;
  // Injetado no meio de frases ("É aí que ..."), então começa em minúscula.
  return vp.charAt(0).toLowerCase() + vp.slice(1);
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
  return ctx.objective ? `${fallback} · Alinhado ao objetivo da linha: ${ctx.objective}` : fallback;
}

// ─────────────────────────────────────────────────────────────────────────
// Copy por formato (usa dor/desejo/proposta de valor reais do contexto)
// ─────────────────────────────────────────────────────────────────────────

/** Vídeo/Motion: copy gravável e desenvolvida (~40s–1min20s), 5 partes. */
function scriptCopy(i: number, ctx: GenerationContext, isMotion: boolean): StructuredCopy {
  const { title } = angle(i, ctx);
  const pain = painAt(i, ctx);
  const desire = desireAt(i, ctx);
  const vp = valueProp(ctx);
  const durations = ["48s", "1min02s", "1min10s", "1min18s", "55s"];
  const sections = [
    { label: "Gancho", text: `${title}. Se você trabalha com ${ctx.niche}, presta atenção nos próximos segundos — porque isso muda a forma como você enxerga o seu resultado.` },
    { label: "Conexão", text: `Talvez você já tenha sentido isso na pele: ${pain}. Não é falta de esforço — a maioria das empresas de ${ctx.niche} vive exatamente esse cenário, correndo muito e vendo pouco retorno previsível. A gente entende essa realidade de perto.` },
    { label: "Desenvolvimento", text: `O que quase ninguém explica é que o problema raramente está no produto: está na estrutura por trás dele. Quando você organiza processo, comunicação clara e prova de resultado, o jogo vira. É aí que ${vp}: em vez de improviso, um método que se repete e gera consistência. Na prática, isso significa saber o que falar, para quem falar e por que aquilo constrói autoridade e vendas.` },
    { label: "Virada", text: `Aqui está o ponto que gera o insight: não é sobre trabalhar mais, é sobre trabalhar com método. Quando isso acontece, você deixa de depender de sorte e passa a ${desire}. Foi assim que nossos clientes saíram do achismo para resultado consistente.` },
    { label: "CTA", text: ctaFor(i, ctx) },
  ];
  return { format: isMotion ? "motion" : "video", estimatedDuration: durations[i % durations.length], sections };
}

/** Carrossel: slide 1 headline forte, desenvolvimento no miolo, conclusão + CTA. */
function carouselCopy(i: number, ctx: GenerationContext): StructuredCopy {
  const { title } = angle(i, ctx);
  const pain = painAt(i, ctx);
  const desire = desireAt(i, ctx);
  const slides = [
    { title: "Headline", text: `${title}` },
    { title: "Slide 2", text: `A maioria das empresas de ${ctx.niche} acredita que basta aparecer mais. Não é bem assim: sem estrutura, mais volume só amplifica o erro — e você continua sentindo ${pain}.` },
    { title: "Slide 3", text: `Pilar 1 — Clareza: o cliente precisa entender em segundos o que você resolve e por que confiar em você. Mensagem confusa espanta antes de vender.` },
    { title: "Slide 4", text: `Pilar 2 — Prova: cases, bastidores e resultados reais valem mais que qualquer promessa bonita. É a prova que derruba a objeção e gera confiança.` },
    { title: "Slide 5", text: `Pilar 3 — Consistência: aparecer com método, na frequência certa, com uma mensagem que evolui — não que se repete. É isso que constrói autoridade ao longo do tempo.` },
    { title: "Conclusão + CTA", text: `Junte clareza, prova e consistência e o resultado deixa de ser sorte: você passa a ${desire}. A ${ctx.brand} constrói isso com você. ${ctaFor(i, ctx)}` },
  ];
  return { format: "carrossel", slides };
}

/** Estático: headline, subheadline, corpo desenvolvido, CTA e observações de design. */
function staticCopy(i: number, ctx: GenerationContext): StructuredCopy {
  const { title } = angle(i, ctx);
  const pain = painAt(i, ctx);
  const vp = valueProp(ctx);
  return {
    format: "estatico",
    static: {
      headline: title,
      subheadline: `O que separa quem cresce de quem estagna em ${ctx.niche}.`,
      body: `Não é o talento, nem a sorte: é a estrutura. Enquanto muitos seguem presos em ${pain}, as empresas que comunicam resultado com clareza e prova constroem autoridade e vendem com previsibilidade. É exatamente aí que ${vp} — para que a sua marca seja a escolha óbvia, sem depender de improviso.`,
      cta: ctaFor(i, ctx),
      designNotes: "Alto contraste, headline em destaque no topo, corpo com respiro e hierarquia clara, logo e CTA no rodapé. Priorizar 1 ideia visual forte e legível no feed.",
    },
  };
}

function productionNotesFor(key: FormatKey): string {
  switch (key) {
    case "video": return "Roteiro gravável de 40s a 1min20s. Vertical (9:16), cortes secos a cada frase-chave, legenda queimada, foco no rosto no gancho. Ler as 5 partes na ordem.";
    case "motion": return "Animar as 5 partes com ritmo; texto na tela sincronizado com a locução; trilha upbeat leve; usar a paleta e a tipografia da marca.";
    case "carrossel": return "1 ideia por slide; headline em alto contraste no slide 1; seta de deslize; CTA destacado no último slide. Manter identidade visual da marca.";
    default: return "Peça única de feed (1080x1350). Headline forte, corpo legível com hierarquia, CTA claro; usar identidade visual da marca.";
  }
}

function makeTheme(format: FormatKey, i: number, ctx: GenerationContext): GeneratedTheme {
  const { title, obj } = angle(i, ctx);
  const copy = format === "carrossel" ? carouselCopy(i, ctx)
    : format === "estatico" ? staticCopy(i, ctx)
    : scriptCopy(i, ctx, format === "motion");
  const hook = format === "carrossel" ? (copy.slides?.[0]?.text ?? title)
    : format === "estatico" ? (copy.static?.headline ?? title)
    : (copy.sections?.[0]?.text ?? title);
  return {
    title,
    channel: "instagram",
    format: formatLabel(format),
    strategicObjective: objectiveNote(ctx, obj),
    hook,
    cta: ctaFor(i, ctx),
    productionNotes: productionNotesFor(format),
    copy,
  };
}

/** Gera exatamente a distribuição solicitada, cada conteúdo pronto para produção. */
export function buildDemoThemes(ctx: GenerationContext, counts: FormatCounts): GeneratedTheme[] {
  const out: GeneratedTheme[] = [];
  let i = 0;
  for (const { key } of EDITORIAL_FORMATS) {
    const n = Math.max(0, Math.floor(counts[key] ?? 0));
    for (let k = 0; k < n; k++) out.push(makeTheme(key, i++, ctx));
  }
  return out;
}

// ─────────────────────────────────────────────────────────────────────────
// Coerção / validação / distribuição da saída (real ou demo)
// ─────────────────────────────────────────────────────────────────────────

function wordCount(s: string): number {
  return s.trim() ? s.trim().split(/\s+/).length : 0;
}
function scriptWords(copy: StructuredCopy): number {
  return (copy.sections ?? []).reduce((n, s) => n + wordCount(s.text), 0);
}

/** Coage um tema (modelo real OU demo) para o shape persistido, garantindo
 * profundidade: roteiros curtos/rasos são reescritos com a versão desenvolvida. */
export function coerceTheme(raw: any, ctx: GenerationContext, index: number): GeneratedTheme {
  const format = toFormatKey(raw?.format);
  const base = makeTheme(format, index, ctx);
  let copy: StructuredCopy = normalizeCopyInput(raw?.copy, format) ?? base.copy;

  // Regra de qualidade: Vídeo/Motion precisam de copy suficiente (~40s+). Se o
  // modelo devolver menos que as 5 partes ou texto curto, usa a versão completa.
  if ((format === "video" || format === "motion")) {
    const sec = copy.sections ?? [];
    if (sec.length < 5 || scriptWords(copy) < MIN_SCRIPT_WORDS) copy = base.copy;
  }
  if (format === "carrossel" && (copy.slides?.length ?? 0) < 4) copy = base.copy;
  if (format === "estatico" && wordCount(copy.static?.body ?? "") < 40) copy = base.copy;

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

/** Garante a quantidade EXATA por formato: corta excedentes e completa faltas. */
export function enforceDistribution(themes: GeneratedTheme[], counts: FormatCounts, ctx: GenerationContext): GeneratedTheme[] {
  if (totalCount(counts) === 0) return themes; // sem distribuição explícita
  const out: GeneratedTheme[] = [];
  let idx = 0;
  for (const { key } of EDITORIAL_FORMATS) {
    const want = counts[key];
    const have = themes.filter((t) => toFormatKey(t.format) === key);
    for (let k = 0; k < want; k++) {
      out.push(have[k] ?? makeTheme(key, themes.length + idx, ctx));
      idx += 1;
    }
  }
  return out;
}

/** Agrupa os temas por formato em categorias (para persistir numa única linha). */
export function groupByFormat(themes: GeneratedTheme[]): Array<{ name: string; themes: GeneratedTheme[] }> {
  return EDITORIAL_FORMATS
    .map((f) => ({ name: f.label, themes: themes.filter((t) => t.format === f.label) }))
    .filter((c) => c.themes.length > 0);
}

/** Valida se o tema está pronto para produção. Retorna a lista de problemas. */
export function validateThemeReady(t: GeneratedTheme): string[] {
  const issues: string[] = [];
  if (!t.title) issues.push("sem tema");
  if (!t.hook) issues.push("sem gancho");
  if (!t.cta) issues.push("sem CTA");
  if (!t.productionNotes) issues.push("sem observações de produção");
  const key = toFormatKey(t.format);
  if (key === "carrossel") {
    if (!t.copy.slides || t.copy.slides.length < 4) issues.push("carrossel raso");
  } else if (key === "estatico") {
    if (!t.copy.static?.body || t.copy.static.body.length < 120) issues.push("estático raso");
  } else {
    if ((t.copy.sections ?? []).length < 5) issues.push("roteiro sem as 5 partes");
    if (scriptWords(t.copy) < MIN_SCRIPT_WORDS) issues.push("roteiro curto para 40s+");
  }
  return issues;
}

function normalizeCopyInput(copy: unknown, format: FormatKey): StructuredCopy | null {
  if (!copy) return null;
  if (typeof copy === "object" && !Array.isArray(copy) && "format" in (copy as any)) {
    return { ...(copy as StructuredCopy), format };
  }
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
