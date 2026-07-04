import { z } from "zod";

/** Client decision on a shared deliverable. */
export const reviewDecision = z.enum(["approve", "request_changes"]);
export type ReviewDecision = z.infer<typeof reviewDecision>;

export const requestChangesInput = z.object({
  comment: z.string().min(1).max(4000),
  authorName: z.string().max(200).optional(),
});
export type RequestChangesInput = z.infer<typeof requestChangesInput>;

export const approveInput = z.object({
  authorName: z.string().max(200).optional(),
});
export type ApproveInput = z.infer<typeof approveInput>;

/** Public payload returned to the client at the open review link — no internal
 * fields, no auth. */
export const publicReviewView = z.object({
  token: z.string(),
  status: z.string(),
  brand: z.string(),
  project: z.string(),
  deliverable: z.object({
    title: z.string(),
    channel: z.string(),
    type: z.string(),
    spec: z.unknown(),
  }),
  history: z.array(
    z.object({ decision: z.string(), comment: z.string().nullable(), at: z.string(), author: z.string().nullable() }),
  ),
});
export type PublicReviewView = z.infer<typeof publicReviewView>;
