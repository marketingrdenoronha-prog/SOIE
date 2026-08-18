import { z } from "zod";

/** Confidence level attached to every AI-derived conclusion (Constitution §3, P8). */
export const Confidence = z.enum(["high", "medium", "low"]);
export type Confidence = z.infer<typeof Confidence>;

export const FunnelStage = z.enum(["tofu", "mofu", "bofu"]);
export type FunnelStage = z.infer<typeof FunnelStage>;

export const EditorialObjective = z.enum([
  "authority",
  "trust",
  "educate",
  "reduce_objection",
  "attract",
  "identify",
  "position",
  "desire",
  "relationship",
  "convert",
]);
export type EditorialObjective = z.infer<typeof EditorialObjective>;

export const Platform = z.enum([
  "instagram",
  "tiktok",
  "linkedin",
  "youtube",
  "blog",
  "x",
  "facebook",
  "email",
]);
export type Platform = z.infer<typeof Platform>;

export const cursorPagination = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type CursorPagination = z.infer<typeof cursorPagination>;

export function paginated<T extends z.ZodTypeAny>(item: T) {
  return z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
  });
}

/** Standard API error envelope. */
export const apiError = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
    traceId: z.string().optional(),
  }),
});
export type ApiError = z.infer<typeof apiError>;
