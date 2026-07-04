import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { randomUUID } from "node:crypto";
import { env } from "@soie/config";
import { jwtClaims } from "@soie/contracts";
import { TenantStore } from "./tenant-context.js";

/**
 * Establishes per-request context: generates a traceId and, when a valid
 * bearer token is present, binds the tenant (org), user and roles into
 * AsyncLocalStorage so downstream code and logs are always tenant-scoped.
 * Unauthenticated requests still get a traceId (for public routes).
 */
@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const traceId = (req.headers["x-trace-id"] as string) ?? randomUUID();
    res.setHeader("x-trace-id", traceId);

    const auth = req.headers.authorization;
    const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;

    if (!token) {
      next();
      return;
    }

    try {
      const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
      const claims = jwtClaims.parse(decoded);
      TenantStore.run(
        {
          traceId,
          organizationId: claims.org,
          userId: claims.sub,
          roles: claims.roles,
        },
        () => next(),
      );
    } catch {
      // Invalid/expired token: proceed unauthenticated; guards reject as needed.
      next();
    }
  }
}
