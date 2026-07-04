import { PrismaClient } from "@prisma/client";

/**
 * Single PrismaClient per process. In dev, cache on globalThis so hot-reload
 * doesn't open a new pool on every reload.
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
