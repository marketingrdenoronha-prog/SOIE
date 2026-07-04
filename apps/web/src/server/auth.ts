import { scryptSync, randomBytes, timingSafeEqual, randomUUID } from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "@soie/config";
import { jwtClaims, type AuthTokens, type JwtClaims } from "@soie/contracts";
import { Errors } from "./http";

/** Password hashing with Node's built-in scrypt — no native module, so it
 * runs on serverless without a prebuilt binary. Format: scrypt$<salt>$<hash>. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  const [, salt, hash] = parts;
  const expected = Buffer.from(hash!, "hex");
  const actual = scryptSync(password, salt!, 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function signAccessToken(claims: Omit<JwtClaims, "sub"> & { sub: string }): AuthTokens {
  const accessToken = jwt.sign(claims, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL,
  });
  return { accessToken, refreshToken: randomUUID(), expiresIn: env.JWT_ACCESS_TTL };
}

/** Extracts and validates the bearer token from a request. Throws 401. */
export function requireAuth(req: Request): JwtClaims {
  const header = req.headers.get("authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) throw Errors.unauthorized();
  try {
    return jwtClaims.parse(jwt.verify(token, env.JWT_ACCESS_SECRET));
  } catch {
    throw Errors.unauthorized();
  }
}
