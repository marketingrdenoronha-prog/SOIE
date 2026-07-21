/* eslint-disable @typescript-eslint/no-explicit-any */
import { runAgent } from "./ai-runtime";
import { coerceTheme, buildDemoThemes, type GeneratedTheme, type GenerationContext } from "./editorial-content";
import { EDITORIAL_FORMATS, formatLabel, toFormatKey, type FormatCounts, type FormatKey } from "@/lib/editorial-format";

/**
 * Geração da Linha Editorial com GARANTIA DE QUANTIDADE.
 *
 * O modelo, sozinho, costuma entregar MENOS conteúdos do que o solicitado — ou
 * porque não segue a contagem, ou porque o JSON com a copy completa estoura o
 * limite de tokens e os últimos temas são cortados. Para que TODA a solicitação
 * seja atendida, geramos em lotes pequenos e completamos o que faltou em
 * chamadas adicionais (top-up), até bater a quantidade por formato. Como rede de
 * segurança, o que ainda faltar é preenchido com conteúdo estruturado — a
 * quantidade pedida nunca sai incompleta.
 */

const FORMAT_KEYS: FormatKey[] = EDITORIAL_FORMATS.map((f) => f.key);

/** Máximo de conteúdos por chamada de IA — lotes pequenos evitam o truncamento
 * do JSON (a causa raiz do "sai parcial"). */
const BATCH_TOTAL = 6;
/** Teto de rodadas de top-up (backstop contra loop). */
const MAX_ROUNDS = 10;
/** Orçamento de tempo total das chamadas de IA (deixa margem no maxDuration). */
const TIME_BUDGET_MS = 240_000;

export interface GeneratedStrategyMeta {
  positioning?: string;
  pillars?: unknown;
  objectives?: unknown;
  rationale?: string;
  confidence?: string;
  _demo?: boolean;
}

export interface GeneratedStrategy {
  meta: GeneratedStrategyMeta;
  /** Temas por formato, com a contagem exata solicitada (quando > 0). */
  themesByFormat: Record<FormatKey, GeneratedTheme[]>;
  total: number;
  /** true se foi preciso completar com conteúdo estruturado (rede de segurança). */
  usedFill: boolean;
  rounds: number;
}

function emptyBuckets(): Record<FormatKey, GeneratedTheme[]> {
  return { video: [], motion: [], carrossel: [], estatico: [] };
}
function normalize(counts?: Partial<FormatCounts>): FormatCounts {
  return {
    video: counts?.video ?? 0,
    motion: counts?.motion ?? 0,
    carrossel: counts?.carrossel ?? 0,
    estatico: counts?.estatico ?? 0,
  };
}
function totalOf(c: FormatCounts): number {
  return FORMAT_KEYS.reduce((s, k) => s + (c[k] ?? 0), 0);
}
/** Reduz `counts` para que a soma não passe de `cap` (guloso, ordem fixa). */
function capCounts(counts: FormatCounts, cap: number): FormatCounts {
  const out = emptyCounts();
  let left = cap;
  for (const k of FORMAT_KEYS) {
    if (left <= 0) break;
    const take = Math.min(counts[k] ?? 0, left);
    out[k] = take;
    left -= take;
  }
  return out;
}
function emptyCounts(): FormatCounts {
  return { video: 0, motion: 0, carrossel: 0, estatico: 0 };
}

/** Achata os temas de uma resposta do agente e os coage para o shape padrão. */
function flattenCoerce(res: any, genCtx: GenerationContext, nextIndex: () => number): GeneratedTheme[] {
  const out: GeneratedTheme[] = [];
  for (const line of (res?.lines ?? []) as any[]) {
    for (const cat of (line?.categories ?? []) as any[]) {
      for (const raw of (cat?.themes ?? []) as any[]) {
        out.push(coerceTheme(raw, genCtx, nextIndex()));
      }
    }
  }
  return out;
}

export async function generateEditorialThemes(opts: {
  baseInput: Record<string, unknown>;
  requested?: Partial<FormatCounts>;
  genCtx: GenerationContext;
  context: Record<string, unknown>;
  organizationId: string;
  now: number;
}): Promise<GeneratedStrategy> {
  const { baseInput, genCtx, context, organizationId, now } = opts;
  const target = normalize(opts.requested);
  const totalTarget = totalOf(target);
  const buckets = emptyBuckets();
  let index = 0;
  let rounds = 0;

  const deficit = (): FormatCounts => {
    const d = emptyCounts();
    for (const k of FORMAT_KEYS) d[k] = Math.max(0, target[k] - buckets[k].length);
    return d;
  };
  const filled = () => FORMAT_KEYS.reduce((s, k) => s + buckets[k].length, 0);
  const usedTitles = () => FORMAT_KEYS.flatMap((k) => buckets[k].map((t) => t.title)).slice(0, 150);
  const usedHooks = () => FORMAT_KEYS.flatMap((k) => buckets[k].map((t) => t.hook)).filter(Boolean).slice(0, 150);
  /** Adiciona temas ao balde do seu formato, sem passar do alvo (quando há alvo). */
  const absorb = (themes: GeneratedTheme[], enforce: boolean) => {
    for (const t of themes) {
      const k = toFormatKey(t.format);
      if (enforce && buckets[k].length >= target[k]) continue;
      buckets[k].push(t);
    }
  };

  // ── Rodada 1: gera a estratégia (posicionamento/pilares) + o primeiro lote.
  const firstCounts = totalTarget > 0 ? capCounts(target, BATCH_TOTAL) : opts.requested;
  const res1 = await runAgent(
    "planning",
    { ...baseInput, formatCounts: firstCounts },
    context,
    { organizationId },
  );
  rounds++;
  const meta: GeneratedStrategyMeta = {
    positioning: res1.positioning,
    pillars: res1.pillars,
    objectives: res1.objectives,
    rationale: res1.rationale,
    confidence: res1.confidence,
    _demo: res1._demo,
  };
  const first = flattenCoerce(res1, genCtx, () => index++);

  // Sem contagem-alvo (usuário deixou tudo zerado): entrega o que o agente propôs.
  if (totalTarget === 0) {
    absorb(first, false);
    return { meta, themesByFormat: buckets, total: filled(), usedFill: false, rounds };
  }

  // Modo demo (sem chave de IA): a geração é determinística e não trunca — gera
  // o conjunto completo de uma vez, com a melhor distribuição de ângulos.
  if (meta._demo) {
    for (const t of buildDemoThemes(genCtx, target)) buckets[toFormatKey(t.format)].push(t);
    return { meta, themesByFormat: buckets, total: filled(), usedFill: false, rounds };
  }

  absorb(first, true);

  // ── Top-up: completa o que faltou em lotes adicionais (só com IA real; em modo
  // demo a rodada 1 já saiu exata). Evita repetição passando o que já foi usado.
  let stagnation = 0;
  while (
    rounds < MAX_ROUNDS &&
    totalOf(deficit()) > 0 &&
    !meta._demo &&
    Date.now() - now < TIME_BUDGET_MS
  ) {
    const batch = capCounts(deficit(), BATCH_TOTAL);
    if (totalOf(batch) === 0) break;
    const before = filled();
    const r = await runAgent(
      "planning",
      {
        ...baseInput,
        formatCounts: batch,
        avoidTitles: usedTitles(),
        avoidHooks: usedHooks(),
        topUpNote:
          "Estes são conteúdos ADICIONAIS da MESMA linha editorial. Gere EXATAMENTE a quantidade em formatCounts. NUNCA repita títulos ou ganchos já usados (veja avoidTitles/avoidHooks); traga ângulos novos.",
      },
      context,
      { organizationId },
    );
    rounds++;
    absorb(flattenCoerce(r, genCtx, () => index++), true);
    if (filled() <= before) {
      stagnation++;
      if (stagnation >= 2) break; // duas rodadas sem progresso → para e usa fill
    } else {
      stagnation = 0;
    }
  }

  // ── Rede de segurança: preenche qualquer déficit remanescente com conteúdo
  // estruturado, garantindo que a quantidade pedida NUNCA saia incompleta.
  let usedFill = false;
  const rem = deficit();
  if (totalOf(rem) > 0) {
    for (const t of buildDemoThemes(genCtx, rem)) buckets[toFormatKey(t.format)].push(t);
    usedFill = true;
  }

  // Apara excedente para bater a contagem exata solicitada.
  for (const k of FORMAT_KEYS) {
    if (buckets[k].length > target[k]) buckets[k] = buckets[k].slice(0, target[k]);
  }

  return { meta, themesByFormat: buckets, total: filled(), usedFill, rounds };
}

/** Monta as `editorialLines` (uma linha, categorias por formato) para o create
 * do Prisma, a partir dos baldes por formato. */
/**
 * Rede de segurança: garante NO MÁXIMO 4 telas no carrossel. Se a IA devolver
 * mais, mantém as 3 primeiras e a última (o CTA) — preservando começo, meio e
 * fim. Só mexe em copy de carrossel; qualquer outro formato passa intacto.
 */
function clampCarousel(copy: unknown): unknown {
  if (!copy || typeof copy !== "object") return copy;
  const c = copy as { format?: string; slides?: unknown[] };
  if (c.format !== "carrossel" || !Array.isArray(c.slides) || c.slides.length <= 4) return copy;
  const slides = c.slides;
  return { ...c, slides: [...slides.slice(0, 3), slides[slides.length - 1]] };
}

export function bucketsToLines(
  buckets: Record<FormatKey, GeneratedTheme[]>,
  organizationId: string,
) {
  const categories = EDITORIAL_FORMATS
    .map((f) => ({ key: f.key, name: formatLabel(f.key), themes: buckets[f.key] }))
    .filter((c) => c.themes.length > 0);

  let priority = 0;
  return [
    {
      organizationId,
      name: "Linha Editorial",
      objective: "authority" as never,
      funnelStage: "tofu" as never,
      platforms: ["instagram"],
      categories: {
        create: categories.map((c) => ({
          organizationId,
          name: c.name,
          themes: {
            create: c.themes.map((t) => ({
              organizationId,
              title: t.title,
              channel: t.channel,
              format: t.format,
              copy: clampCarousel(t.copy) as never,
              strategicObjective: t.strategicObjective,
              hook: t.hook,
              cta: t.cta,
              productionNotes: t.productionNotes,
              priority: priority++,
            })),
          },
        })),
      },
    },
  ];
}
