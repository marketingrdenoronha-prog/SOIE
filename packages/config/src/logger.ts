import pino, { type Logger } from "pino";
import { env } from "./env.js";

/**
 * Structured JSON logger. Every log line should carry correlation fields
 * (traceId, organizationId, userId, module) — attach them with child loggers
 * at request/job boundaries. Secrets and PII must never be logged; sensitive
 * keys are redacted here as a backstop.
 */
export const logger: Logger = pino({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  redact: {
    paths: [
      "*.password",
      "*.password_hash",
      "*.token",
      "*.refreshToken",
      "*.apiKey",
      "*.authorization",
      "req.headers.authorization",
    ],
    censor: "[redacted]",
  },
  transport:
    env.NODE_ENV === "development"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
});

export type { Logger };
