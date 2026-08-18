import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { TenantStore } from "../tenant/tenant-context.js";

/**
 * Requires an authenticated tenant context (populated by
 * RequestContextMiddleware). Apply to any controller handling tenant data.
 */
@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(_context: ExecutionContext): boolean {
    const ctx = TenantStore.get();
    if (!ctx) throw new UnauthorizedException("Authentication required");
    return true;
  }
}
