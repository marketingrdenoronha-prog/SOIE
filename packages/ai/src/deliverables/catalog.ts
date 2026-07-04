import type { AgentKey, Channel, DeliverableType } from "@soie/contracts";

/**
 * Maps each deliverable type to the specialist agent that produces it and a
 * format instruction that shapes the roteiro. This is what lets a single
 * "produce content" request fan out into channel-and-format-specific scripts:
 * a reel becomes a video roteiro, a carousel becomes slides + design brief,
 * a motion piece becomes timed scenes, and so on.
 */
export interface FormatSpec {
  type: DeliverableType;
  agent: AgentKey;
  /** What the agent must output, in the roteiro's own vocabulary. */
  instruction: string;
  /** Human label per channel+type (pt-BR). */
  label: (channel: Channel) => string;
}

export const FORMAT_CATALOG: Record<DeliverableType, FormatSpec> = {
  video_script: {
    type: "video_script",
    agent: "scriptwriter",
    instruction:
      "Escreva um roteiro de vídeo com gancho nos 3 primeiros segundos, cenas numeradas (visual, narração/fala, texto em tela, b-roll e duração por cena), CTA final, legenda e hashtags. Ajuste o ritmo ao canal.",
    label: (c) =>
      c === "tiktok" ? "Roteiro TikTok" : c === "youtube" ? "Roteiro YouTube" : "Roteiro Reels",
  },
  motion_script: {
    type: "motion_script",
    agent: "motion",
    instruction:
      "Escreva um roteiro de motion design: cenas com timing (0:00–0:03), elementos animados, texto em tela, transições e notas de animação; sugira mood da trilha e paleta.",
    label: () => "Roteiro Motion",
  },
  design_brief: {
    type: "design_brief",
    agent: "designer",
    instruction:
      "Escreva um briefing de design: formato e dimensões, objetivo, textos que vão na arte (por slot), direção visual, paleta e referências.",
    label: (c) => (c === "youtube" ? "Thumbnail" : "Arte estática"),
  },
  carousel: {
    type: "carousel",
    agent: "designer",
    instruction:
      "Escreva um carrossel: slides numerados (título, corpo e nota de design por slide), legenda e CTA; inclua um mini briefing de design para as artes.",
    label: () => "Carrossel",
  },
  copy: {
    type: "copy",
    agent: "copy",
    instruction:
      "Escreva 3 variações de copy (rótulo, headline, corpo e CTA), aderentes ao DNA verbal da marca.",
    label: () => "Copy",
  },
  article: {
    type: "article",
    agent: "seo",
    instruction:
      "Escreva a estrutura de um artigo: título, outline com seções e pontos, e SEO (palavra-chave e meta description).",
    label: () => "Artigo/Blog",
  },
  email_sequence: {
    type: "email_sequence",
    agent: "copy",
    instruction:
      "Escreva uma sequência de e-mails (assunto, preview, corpo e CTA por e-mail), com progressão lógica de nutrição.",
    label: () => "Sequência de e-mail",
  },
  ad: {
    type: "ad",
    agent: "ads",
    instruction:
      "Escreva um anúncio: variações de copy (headline, texto principal, CTA) e um briefing do criativo (formato, direção visual e textos na arte).",
    label: (c) => (c === "google_ads" ? "Anúncio Google" : "Anúncio Meta"),
  },
};

/** Default deliverable set suggested for a channel (a channel usually needs
 * more than one asset — e.g. a reel needs a video roteiro AND a caption copy). */
export const CHANNEL_DEFAULTS: Record<Channel, DeliverableType[]> = {
  instagram: ["video_script", "carousel", "design_brief", "copy"],
  tiktok: ["video_script", "motion_script"],
  youtube: ["video_script", "design_brief"],
  linkedin: ["copy", "carousel", "article"],
  blog: ["article"],
  email: ["email_sequence"],
  meta_ads: ["ad", "video_script"],
  google_ads: ["ad"],
};
