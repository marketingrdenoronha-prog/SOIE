/**
 * Formatos oficiais da Linha Editorial (V3). O sistema trabalha EXCLUSIVAMENTE
 * com estes quatro formatos — nada além disso deve ser gerado.
 */
export const EDITORIAL_FORMATS = [
  { key: "video", label: "Vídeo" },
  { key: "motion", label: "Motion" },
  { key: "carrossel", label: "Carrossel" },
  { key: "estatico", label: "Estático" },
] as const;

export type FormatKey = (typeof EDITORIAL_FORMATS)[number]["key"];

export type FormatCounts = Record<FormatKey, number>;

export const EMPTY_FORMAT_COUNTS: FormatCounts = { video: 0, motion: 0, carrossel: 0, estatico: 0 };

export function formatLabel(key: string): string {
  return EDITORIAL_FORMATS.find((f) => f.key === key)?.label ?? key;
}

/** Normaliza um rótulo/chave livre para uma das 4 chaves oficiais. */
export function toFormatKey(v?: string | null): FormatKey {
  const s = (v ?? "").toLowerCase().trim();
  if (["video", "motion", "carrossel", "estatico"].includes(s)) return s as FormatKey;
  if (s.includes("motion")) return "motion";
  if (s.includes("carro") || s.includes("carousel") || s.includes("slide")) return "carrossel";
  if (s.includes("estát") || s.includes("estat") || s.includes("static") || s.includes("arte") || s.includes("design") || s.includes("feed") || s.includes("post")) return "estatico";
  // vídeo, reels, roteiro, tiktok, etc. → vídeo
  return "video";
}

/** Mapeia um formato oficial para o DeliverableType usado na produção da peça. */
export function deliverableTypeForFormat(key: string): "video_script" | "motion_script" | "carousel" | "design_brief" {
  switch (toFormatKey(key)) {
    case "motion": return "motion_script";
    case "carrossel": return "carousel";
    case "estatico": return "design_brief";
    default: return "video_script";
  }
}

export interface CopySection { label: string; text: string }
export interface CopySlide { title?: string; text: string }
export interface StaticCopy { headline: string; subheadline?: string; body: string; caption?: string; cta?: string; designNotes?: string }

/** Copy completa estruturada, por formato. */
export interface StructuredCopy {
  format: FormatKey;
  estimatedDuration?: string;   // vídeo/motion — rótulo legível (ex.: "1min05s")
  durationSeconds?: number;     // vídeo/motion — duração definida pelo usuário (segundos)
  sections?: CopySection[];     // vídeo/motion (Gancho, Conexão, Desenvolvimento, Virada, CTA)
  slides?: CopySlide[];         // carrossel
  slideCount?: number;          // carrossel — quantidade de telas definida pelo usuário (2–8)
  static?: StaticCopy;          // estático
}

export function isStructuredCopy(v: unknown): v is StructuredCopy {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v) && "format" in (v as Record<string, unknown>);
}

// ── Configuração individual de telas por carrossel ──────────────────────────
export const CAROUSEL_MIN_SLIDES = 2;
export const CAROUSEL_MAX_SLIDES = 8;
export const CAROUSEL_DEFAULT_SLIDES = 5;

/** Uma configuração por carrossel (índice + quantidade obrigatória de telas). */
export interface CarouselConfig { index: number; slideCount: number }

/** Garante inteiro dentro de [2,8] (padrão 5 quando inválido). */
export function clampSlideCount(n: unknown): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v)) return CAROUSEL_DEFAULT_SLIDES;
  return Math.min(CAROUSEL_MAX_SLIDES, Math.max(CAROUSEL_MIN_SLIDES, v));
}

/** Ajusta a lista de contagens de telas ao número de carrosséis: preserva as
 * existentes, novas recebem o padrão e as excedentes são removidas. */
export function reconcileCarouselSlides(current: number[], carouselCount: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < Math.max(0, carouselCount); i++) {
    out.push(clampSlideCount(current[i] ?? CAROUSEL_DEFAULT_SLIDES));
  }
  return out;
}

/** Deriva o slideCount efetivo de uma copy de carrossel (compat. com dados
 * antigos sem o campo: usa o nº de telas presentes). */
export function effectiveSlideCount(copy: StructuredCopy | undefined | null): number | undefined {
  if (!copy) return undefined;
  if (typeof copy.slideCount === "number") return clampSlideCount(copy.slideCount);
  if (Array.isArray(copy.slides) && copy.slides.length > 0) return copy.slides.length;
  return undefined;
}

// ── Configuração individual por CONTEÚDO (todos os formatos) ────────────────
export const VIDEO_DEFAULT_DURATION = 30;
export const MOTION_DEFAULT_DURATION = 15;
export const DURATION_MIN = 1;   // inteiro positivo (> 0)
export const DURATION_MAX = 3600; // guarda de segurança (não é limite de produto)

/** Garante duração inteira e positiva; usa `fallback` quando inválida. */
export function clampDuration(n: unknown, fallback: number): number {
  const v = Math.round(Number(n));
  if (!Number.isFinite(v) || v <= 0) return fallback;
  return Math.min(DURATION_MAX, Math.max(DURATION_MIN, v));
}

/** Duração legível a partir de segundos (ex.: 30 → "30s", 65 → "1min05s"). */
export function formatDuration(seconds: number): string {
  const s = Math.max(1, Math.round(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return rem === 0 ? `${m}min` : `${m}min${String(rem).padStart(2, "0")}s`;
}

/** Configuração de UM conteúdo: tema opcional + (duração | telas) por formato. */
export interface ContentItemConfig { theme?: string; durationSeconds?: number; slideCount?: number }
/** Configurações por formato (uma lista por formato, na ordem dos conteúdos). */
export type ContentConfigs = Partial<Record<FormatKey, ContentItemConfig[]>>;

/** Valor padrão de um item novo, conforme o formato. */
export function defaultConfigFor(format: FormatKey): ContentItemConfig {
  if (format === "video") return { theme: "", durationSeconds: VIDEO_DEFAULT_DURATION };
  if (format === "motion") return { theme: "", durationSeconds: MOTION_DEFAULT_DURATION };
  if (format === "carrossel") return { theme: "", slideCount: CAROUSEL_DEFAULT_SLIDES };
  return { theme: "" };
}

/** Reconcilia TODAS as configs às quantidades por formato: preserva o que já
 * foi digitado, cria novos itens com o padrão e remove excedentes. Nunca há
 * mais configs que conteúdos daquele formato. */
export function reconcileContentConfigs(prev: ContentConfigs, counts: Record<FormatKey, number>): Record<FormatKey, ContentItemConfig[]> {
  const out = { video: [], motion: [], carrossel: [], estatico: [] } as Record<FormatKey, ContentItemConfig[]>;
  for (const f of ["video", "motion", "carrossel", "estatico"] as FormatKey[]) {
    const n = Math.max(0, Math.floor(counts[f] ?? 0));
    const cur = prev[f] ?? [];
    for (let i = 0; i < n; i++) {
      const existing = cur[i];
      out[f].push(existing ? { ...defaultConfigFor(f), ...existing } : defaultConfigFor(f));
    }
  }
  return out;
}

/** Normaliza um tema: string vazia/espaços → undefined (livre para a IA). */
export function normalizeTheme(theme: unknown): string | undefined {
  const t = typeof theme === "string" ? theme.trim() : "";
  return t ? t.slice(0, 300) : undefined;
}
