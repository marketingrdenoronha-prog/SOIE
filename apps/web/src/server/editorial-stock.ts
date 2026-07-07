/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * ESTOQUE EDITORIAL — acervo permanente de Linhas Editoriais aprovadas e
 * enviadas ao cliente. Duas funções:
 *
 *  1. Memória estratégica: a IA lê TODO o estoque antes de gerar uma nova linha,
 *     extrai padrões (comunicação, estratégia, evolução) e evolui a comunicação
 *     em vez de repetir. Nunca considera apenas a última linha.
 *  2. Estoque operacional: a agência mantém vários meses de conteúdo prontos.
 *
 * Este módulo NÃO cria uma tabela nova: opera sobre EditorialStrategy, que já
 * carrega editorialLines→categories→themes com a copy completa. Aqui só
 * congelamos o snapshot do documento e extraímos padrões para a IA.
 */

/** Um tema como carregado do banco (ou do snapshot congelado). */
interface RawTheme {
  title?: unknown;
  channel?: unknown;
  format?: unknown;
  strategicObjective?: unknown;
  hook?: unknown;
  cta?: unknown;
  productionNotes?: unknown;
  copy?: unknown;
}
interface RawCategory { name?: unknown; themes?: RawTheme[] }
interface RawLine { name?: unknown; objective?: unknown; funnelStage?: unknown; platforms?: unknown; categories?: RawCategory[] }

export interface StrategyForSnapshot {
  version: number;
  positioning: string | null;
  pillars: unknown;
  objectives: unknown;
  rationale: string | null;
  editorialLines: RawLine[];
}

/** Documento congelado — o conteúdo EXATO enviado ao cliente. Nunca resumo:
 * guarda posicionamento, pilares e todos os temas com copy completa. */
export interface ContentSnapshot {
  version: number;
  positioning: string | null;
  pillars: unknown;
  objectives: unknown;
  rationale: string | null;
  frozenAt: string;
  lines: Array<{
    name: string;
    objective: string | null;
    funnelStage: string | null;
    platforms: unknown;
    categories: Array<{ name: string; themes: RawTheme[] }>;
  }>;
}

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/** Todos os temas de uma linha, achatados na ordem em que o cliente os viu. */
export function flattenThemes(lines: RawLine[] | undefined): RawTheme[] {
  return (lines ?? []).flatMap((l) => (l?.categories ?? []).flatMap((c) => c?.themes ?? []));
}

export function countContents(strategy: { editorialLines: RawLine[] }): number {
  return flattenThemes(strategy.editorialLines).length;
}

/** Congela o documento exato — chamado no momento do envio ao cliente. */
export function buildContentSnapshot(strategy: StrategyForSnapshot, frozenAt: Date): ContentSnapshot {
  return {
    version: strategy.version,
    positioning: strategy.positioning,
    pillars: strategy.pillars,
    objectives: strategy.objectives,
    rationale: strategy.rationale,
    frozenAt: frozenAt.toISOString(),
    lines: (strategy.editorialLines ?? []).map((l) => ({
      name: str(l?.name),
      objective: str(l?.objective) || null,
      funnelStage: str(l?.funnelStage) || null,
      platforms: l?.platforms ?? [],
      categories: (l?.categories ?? []).map((c) => ({
        name: str(c?.name),
        // Congela o tema INTEIRO (copy completa incluída) — sem resumir.
        themes: (c?.themes ?? []).map((t) => ({
          title: str(t?.title),
          channel: str(t?.channel),
          format: str(t?.format),
          strategicObjective: str(t?.strategicObjective),
          hook: str(t?.hook),
          cta: str(t?.cta),
          productionNotes: str(t?.productionNotes),
          copy: t?.copy ?? null,
        })),
      })),
    })),
  };
}

/** Primeira frase da copy de um tema — serve de "padrão de abertura". */
function openingOf(t: RawTheme): string {
  const copy = t?.copy as any;
  if (typeof copy === "string" && copy.trim()) return copy.trim();
  if (copy && typeof copy === "object") {
    if (Array.isArray(copy.sections) && copy.sections[0]?.text) return str(copy.sections[0].text);
    if (Array.isArray(copy.slides) && copy.slides[0]?.text) return str(copy.slides[0].text);
    if (copy.static?.headline) return str(copy.static.headline);
  }
  return str(t?.hook) || str(t?.title);
}

function approxWords(t: RawTheme): number {
  const copy = t?.copy as any;
  let text = "";
  if (typeof copy === "string") text = copy;
  else if (copy && typeof copy === "object") {
    if (Array.isArray(copy.sections)) text = copy.sections.map((s: any) => str(s?.text)).join(" ");
    else if (Array.isArray(copy.slides)) text = copy.slides.map((s: any) => str(s?.text)).join(" ");
    else if (copy.static) text = [copy.static.headline, copy.static.subheadline, copy.static.body].map(str).join(" ");
  }
  return text ? text.split(/\s+/).filter(Boolean).length : 0;
}

function topCounts(values: string[], limit: number): Array<{ value: string; count: number }> {
  const map = new Map<string, number>();
  for (const v of values) {
    const k = v.trim();
    if (!k) continue;
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([value, count]) => ({ value, count }));
}

/** Uma entrada do estoque como lida para o contexto da IA (bounded). */
export interface StockEntry {
  version: number;
  competencia: string | null;
  sentAt: Date | null;
  approvedAt: Date | null;
  deliveryMethod: string | null;
  contentCount: number;
  positioning: string | null;
  pillars: unknown;
  editorialLines: RawLine[];
}

/**
 * Lê TODO o estoque e extrai os padrões que a IA usa para EVOLUIR (nunca copiar):
 *  - comunicação: ganchos, CTAs, aberturas, distribuição de formatos, tamanho médio
 *  - estratégia: temas recorrentes, categorias, posicionamentos, pilares
 *  - evolução: linha do tempo por competência + lacunas
 *
 * Roda em código (barato, escalável a centenas de linhas) — o custo não cresce
 * com o modelo de IA, só a agregação. O caller limita quantas entradas passa.
 */
export function summarizeStockForContext(entries: StockEntry[]) {
  const allThemes = entries.flatMap((e) => flattenThemes(e.editorialLines));
  const hooks: string[] = [];
  const ctas: string[] = [];
  const openings: string[] = [];
  const objectives: string[] = [];
  const formats: string[] = [];
  const themeTitles: string[] = [];
  let wordSum = 0;
  let wordN = 0;

  for (const t of allThemes) {
    if (str(t?.hook)) hooks.push(str(t.hook));
    if (str(t?.cta)) ctas.push(str(t.cta));
    if (str(t?.format)) formats.push(str(t.format));
    if (str(t?.strategicObjective)) objectives.push(str(t.strategicObjective));
    if (str(t?.title)) themeTitles.push(str(t.title));
    const op = openingOf(t);
    if (op) openings.push(op.slice(0, 140));
    const w = approxWords(t);
    if (w > 0) { wordSum += w; wordN += 1; }
  }

  const categories = entries.flatMap((e) =>
    (e.editorialLines ?? []).flatMap((l) => (l?.categories ?? []).map((c) => str(c?.name))),
  );
  const positionings = entries.map((e) => str(e.positioning)).filter(Boolean);
  const pillars = entries.flatMap((e) => (Array.isArray(e.pillars) ? (e.pillars as unknown[]).map(str) : []));

  const timeline = entries
    .slice()
    .sort((a, b) => (a.version ?? 0) - (b.version ?? 0))
    .map((e) => ({
      version: e.version,
      competencia: e.competencia,
      sentAt: e.sentAt,
      deliveryMethod: e.deliveryMethod,
      contentCount: e.contentCount,
      positioning: e.positioning,
    }));

  return {
    note:
      "ESTOQUE EDITORIAL — acervo COMPLETO de linhas editoriais já aprovadas e enviadas a este cliente. Analise TODAS antes de gerar a nova; compare-as entre si; extraia padrões; identifique repetições, assuntos pouco explorados e lacunas. A nova linha deve ser uma EVOLUÇÃO natural de todas as anteriores: preserve a identidade da marca, NUNCA copie conteúdos, NUNCA repita copies/ganchos/estruturas por facilidade.",
    totals: {
      linhas: entries.length,
      conteudos: allThemes.length,
      competencias: [...new Set(entries.map((e) => e.competencia).filter(Boolean))],
      tamanhoMedioPalavras: wordN > 0 ? Math.round(wordSum / wordN) : null,
    },
    comunicacao: {
      ganchosUsados: hooks.slice(0, 200),
      ctasUsadas: topCounts(ctas, 40),
      padroesDeAbertura: openings.slice(0, 120),
      distribuicaoFormatos: topCounts(formats, 12),
    },
    estrategia: {
      temasUsados: themeTitles.slice(0, 250),
      temasRecorrentes: topCounts(themeTitles, 40),
      categoriasUsadas: topCounts(categories, 40),
      objetivosTrabalhados: topCounts(objectives, 30),
      posicionamentos: [...new Set(positionings)].slice(0, 20),
      pilaresUsados: topCounts(pillars, 30),
    },
    evolucao: {
      linhaDoTempo: timeline,
      note:
        "Use a linha do tempo para detectar mudanças de linguagem/posicionamento/estratégia e identificar novas oportunidades e lacunas editoriais a explorar na próxima linha.",
    },
  };
}
