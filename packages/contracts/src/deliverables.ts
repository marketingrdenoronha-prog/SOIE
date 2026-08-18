import { z } from "zod";

/** Acquisition channels the platform produces for. */
export const Channel = z.enum([
  "instagram",
  "tiktok",
  "youtube",
  "linkedin",
  "blog",
  "email",
  "meta_ads",
  "google_ads",
]);
export type Channel = z.infer<typeof Channel>;

/** The kind of deliverable — each maps to a specialized script/brief. */
export const DeliverableType = z.enum([
  "video_script", // roteiro de vídeo (reel, tiktok, youtube, ad)
  "motion_script", // roteiro de motion design (cenas, timing, texto em tela)
  "design_brief", // briefing de arte estática / thumbnail
  "carousel", // carrossel (slides + brief de design)
  "copy", // copy avulsa (headline, corpo, CTA, legenda)
  "article", // artigo/blog com SEO
  "email_sequence", // sequência de e-mail
  "ad", // anúncio (copy + brief de criativo)
]);
export type DeliverableType = z.infer<typeof DeliverableType>;

/** Pipeline status, from request to client delivery. */
export const DeliverableStatus = z.enum([
  "queued",
  "generating",
  "draft",
  "internal_review",
  "client_review",
  "approved",
  "changes_requested",
  "delivered",
]);
export type DeliverableStatus = z.infer<typeof DeliverableStatus>;

// ── Roteiros (structured specs stored in Deliverable.spec) ────────────────

export const videoScene = z.object({
  n: z.number().int(),
  seconds: z.number().optional(),
  visual: z.string(),
  voiceover: z.string().optional(),
  onScreenText: z.string().optional(),
  brollNotes: z.string().optional(),
});
export const videoScriptSpec = z.object({
  channel: Channel,
  durationSec: z.number().optional(),
  hook: z.string(),
  scenes: z.array(videoScene),
  cta: z.string(),
  caption: z.string().optional(),
  hashtags: z.array(z.string()).default([]),
});

export const motionScene = z.object({
  n: z.number().int(),
  timing: z.string(), // e.g. "0:00–0:03"
  elements: z.string(),
  onScreenText: z.string().optional(),
  transition: z.string().optional(),
  motionNotes: z.string().optional(),
});
export const motionScriptSpec = z.object({
  durationSec: z.number().optional(),
  scenes: z.array(motionScene),
  soundtrackMood: z.string().optional(),
  palette: z.array(z.string()).default([]),
});

export const designBriefSpec = z.object({
  format: z.string(), // e.g. "Feed 1080x1350", "Story 1080x1920"
  dimensions: z.string().optional(),
  objective: z.string(),
  copyOnArt: z.array(z.object({ slot: z.string(), text: z.string() })).default([]),
  visualDirection: z.string(),
  palette: z.array(z.string()).default([]),
  references: z.array(z.string()).default([]),
});

export const carouselSpec = z.object({
  slides: z.array(
    z.object({ n: z.number().int(), title: z.string(), body: z.string(), designNote: z.string().optional() }),
  ),
  caption: z.string().optional(),
  cta: z.string(),
  designBrief: designBriefSpec.partial().optional(),
});

export const copySpec = z.object({
  variants: z.array(
    z.object({ label: z.string(), headline: z.string(), body: z.string(), cta: z.string() }),
  ),
});

export const articleSpec = z.object({
  title: z.string(),
  outline: z.array(z.object({ heading: z.string(), points: z.array(z.string()).default([]) })),
  seo: z.object({ keyword: z.string(), meta: z.string() }).optional(),
});

export const emailSpec = z.object({
  emails: z.array(
    z.object({ subject: z.string(), preview: z.string().optional(), body: z.string(), cta: z.string().optional() }),
  ),
});

export const adSpec = z.object({
  platform: z.string(),
  variants: z.array(z.object({ headline: z.string(), primaryText: z.string(), cta: z.string() })),
  creativeBrief: designBriefSpec.partial().optional(),
});

/** Maps a deliverable type to the schema validating its spec. */
export const SPEC_SCHEMAS = {
  video_script: videoScriptSpec,
  motion_script: motionScriptSpec,
  design_brief: designBriefSpec,
  carousel: carouselSpec,
  copy: copySpec,
  article: articleSpec,
  email_sequence: emailSpec,
  ad: adSpec,
} as const;

export const requestDeliverablesInput = z.object({
  projectId: z.string().uuid(),
  items: z
    .array(z.object({ channel: Channel, type: DeliverableType, brief: z.string().optional() }))
    .min(1),
});
export type RequestDeliverablesInput = z.infer<typeof requestDeliverablesInput>;
