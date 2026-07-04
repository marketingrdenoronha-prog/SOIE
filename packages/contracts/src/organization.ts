import { z } from "zod";

export const createClientInput = z.object({
  name: z.string().min(1).max(200),
  industry: z.string().max(200).optional(),
  website: z.string().url().optional(),
  tags: z.array(z.string()).default([]),
});
export type CreateClientInput = z.infer<typeof createClientInput>;

export const createBrandInput = z.object({
  clientId: z.string().uuid(),
  name: z.string().min(1).max(200),
  positioning: z.string().max(2000).optional(),
  valueProposition: z.string().max(2000).optional(),
  products: z.array(z.string()).default([]),
  objectives: z.array(z.string()).default([]),
});
export type CreateBrandInput = z.infer<typeof createBrandInput>;

export const createProjectInput = z.object({
  brandId: z.string().uuid(),
  name: z.string().min(1).max(200),
  goal: z.string().max(2000).optional(),
  platforms: z.array(z.string()).default([]),
});
export type CreateProjectInput = z.infer<typeof createProjectInput>;

export const inviteMemberInput = z.object({
  email: z.string().email(),
  roleKey: z.enum(["admin", "strategist", "editor", "viewer"]),
});
export type InviteMemberInput = z.infer<typeof inviteMemberInput>;
