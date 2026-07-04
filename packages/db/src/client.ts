import { PrismaClient } from "@prisma/client";

/**
 * Single PrismaClient per process. In dev, cache on globalThis so hot-reload
 * doesn't open a new pool on every reload.
 *
 * Classic engine over TCP everywhere — Neon speaks normal Postgres protocol,
 * so no driver adapter is needed. (We tried the Neon serverless adapters to
 * drop the engine binary from the Vercel bundle; it turned out the engine is
 * loaded even with an adapter, and the HTTP adapter can't run $transaction.
 * The real deploy fix was declaring the Prisma deps in apps/web so file
 * tracing bundles the client + engine into each serverless function.)
 *
 * On Vercel + Neon, prefer the pooled connection string (host with `-pooler`)
 * to avoid exhausting direct connections across many lambdas.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Runs a callback inside a transaction where the Postgres session variable
 * `app.current_org` is set to the tenant id. Row-Level Security policies
 * (added via SQL migration) read this variable, so even a query that forgets
 * its `organizationId` filter cannot cross tenant boundaries.
 */
export async function withTenant<T>(
  organizationId: string,
  fn: (tx: PrismaClient) => Promise<T>,
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      `SET LOCAL app.current_org = '${organizationId.replace(/'/g, "")}'`,
    );
    return fn(tx as unknown as PrismaClient);
  });
}
