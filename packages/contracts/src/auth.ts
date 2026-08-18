import { z } from "zod";

export const registerInput = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(200),
  name: z.string().min(1).max(200),
  organizationName: z.string().min(1).max(200),
});
export type RegisterInput = z.infer<typeof registerInput>;

export const loginInput = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginInput>;

export const refreshInput = z.object({
  refreshToken: z.string().min(1),
});
export type RefreshInput = z.infer<typeof refreshInput>;

export const authTokens = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
});
export type AuthTokens = z.infer<typeof authTokens>;

/** Decoded access-token claims: identity + active tenant + roles. */
export const jwtClaims = z.object({
  sub: z.string().uuid(),
  org: z.string().uuid(),
  roles: z.array(z.string()),
  email: z.string().email(),
});
export type JwtClaims = z.infer<typeof jwtClaims>;
