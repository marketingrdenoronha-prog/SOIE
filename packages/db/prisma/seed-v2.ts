/**
 * SOIE V2 — Backfill idempotente para clientes existentes.
 *
 * Antes da V2, um Client não implicava Brand+Project (o operador criava
 * manualmente). Este seed percorre todos os Clients ativos e garante que cada
 * um tenha pelo menos 1 Brand + 1 Project — usando o helper de escopo.
 *
 * Idempotente: pode rodar 2× sem duplicar (o helper checa antes de criar).
 * Roda com: pnpm --filter @soie/db exec tsx prisma/seed-v2.ts
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function ensureDefaultScope(clientId: string, organizationId: string): Promise<"noop" | "created"> {
  const existing = await prisma.project.findFirst({
    where: { organizationId, brand: { clientId } },
    select: { id: true },
  });
  if (existing) return "noop";

  const client = await prisma.client.findFirst({
    where: { id: clientId, organizationId },
    select: { name: true },
  });
  if (!client) return "noop";

  let brand = await prisma.brand.findFirst({
    where: { organizationId, clientId },
    select: { id: true },
  });
  if (!brand) {
    brand = await prisma.brand.create({
      data: { organizationId, clientId, name: client.name },
      select: { id: true },
    });
  }

  await prisma.project.create({
    data: {
      organizationId,
      brandId: brand.id,
      name: "default",
      status: "onboarding",
      platforms: [],
    },
  });
  return "created";
}

async function main() {
  const clients = await prisma.client.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, organizationId: true },
  });
  console.log(`V2 seed: ${clients.length} clientes a inspecionar…`);

  let created = 0;
  let noop = 0;
  for (const c of clients) {
    try {
      const res = await ensureDefaultScope(c.id, c.organizationId);
      if (res === "created") { created++; console.log(`  + Brand/Project default para "${c.name}"`); }
      else noop++;
    } catch (err) {
      console.error(`  ! erro em "${c.name}":`, err instanceof Error ? err.message : err);
    }
  }
  console.log(`V2 seed: ${created} escopos criados, ${noop} já existentes.`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
