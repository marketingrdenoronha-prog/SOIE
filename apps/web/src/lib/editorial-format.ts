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
  estimatedDuration?: string;   // vídeo/motion
  sections?: CopySection[];     // vídeo/motion (Gancho, Conexão, Desenvolvimento, Virada, CTA)
  slides?: CopySlide[];         // carrossel
  static?: StaticCopy;          // estático
}

export function isStructuredCopy(v: unknown): v is StructuredCopy {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v) && "format" in (v as Record<string, unknown>);
}
