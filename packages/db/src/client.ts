import { PrismaClient } from "@prisma/client";

/**
 * Single PrismaClient per process. In dev, cache on globalThis so hot-reload
 * doesn't open a new pool on every reload.
 *
 * On Neon (host contains `neon.tech`), we swap in the Neon serverless driver
 * adapter — Prisma queries flow over Neon's HTTP fetch API instead of the
 * native query engine binary. That frees the deployment from carrying a
 * ~15 MB .so.node in every serverless function, which was blowing past
 * Vercel's 250 MB per-function limit as we grew /api/** routes.
 *
 * Everywhere else (local Postgres, Docker, CI) it stays on the classic
 * engine binary — the driver adapter is Neon-specific.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function makeClient(): PrismaClient {
  const url = process.env.DATABASE_URL ?? "";
  const isNeon = /\bneon\.tech\b/.test(url);

  if (isNeon) {
    // Lazy require so bundlers on non-Neon targets don't pull the driver.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PrismaNeon } = require("@prisma/adapter-neon");
    // v6 aceita connectionString direto — o adapter cuida do pool/WebSocket
    // internamente. Passar Pool manualmente quebrava no runtime da Vercel
    // com "WebSocket constructor not found".
    const adapter = new PrismaNeon({ connectionString: url });
    return new PrismaClient({ adapter, log: ["error"] });
  }

  return new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });
}

export const prisma: PrismaClient = globalForPrisma.prisma ?? makeClient();

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
