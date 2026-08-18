import { Injectable, type OnModuleDestroy } from "@nestjs/common";
import { prisma, withTenant } from "@soie/db";

/**
 * Thin Nest-injectable wrapper over the shared PrismaClient. Prefer
 * `forTenant` for any query touching tenant data — it opens a transaction with
 * the Postgres RLS variable set, so a missing `organizationId` filter still
 * cannot leak across tenants.
 */
@Injectable()
export class PrismaService implements OnModuleDestroy {
  readonly client = prisma;

  forTenant = withTenant;

  async onModuleDestroy(): Promise<void> {
    await prisma.$disconnect();
  }
}
