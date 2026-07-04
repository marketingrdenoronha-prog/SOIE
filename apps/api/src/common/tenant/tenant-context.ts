import { AsyncLocalStorage } from "node:async_hooks";

export interface TenantContext {
  traceId: string;
  organizationId: string;
  userId: string;
  roles: string[];
}

const storage = new AsyncLocalStorage<TenantContext>();

export const TenantStore = {
  run<T>(ctx: TenantContext, fn: () => T): T {
    return storage.run(ctx, fn);
  },
  get(): TenantContext | undefined {
    return storage.getStore();
  },
  require(): TenantContext {
    const ctx = storage.getStore();
    if (!ctx) throw new Error("No tenant context in scope");
    return ctx;
  },
};
