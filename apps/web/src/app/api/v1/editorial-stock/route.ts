import { prisma } from "@soie/db";
import { requireAuth } from "@/server/auth";
import { ok, handle } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/v1/editorial-stock
 *
 * Estoque Editorial global (todos os clientes da organização). Cada cliente tem
 * seu acervo exclusivo — aqui só listamos todos juntos para a página do menu
 * lateral, agrupados por cliente no front. Metadados apenas (sem o snapshot
 * completo) para escalar; o documento é carregado sob demanda por linha.
 */
export async function GET(req: Request) {
  return handle(async () => {
    const { org } = requireAuth(req);

    const items = await prisma.editorialStrategy.findMany({
      where: { organizationId: org, inStock: true, clientId: { not: null } },
      orderBy: [{ sentAt: "desc" }, { version: "desc" }],
      select: {
        id: true,
        clientId: true,
        version: true,
        positioning: true,
        competencia: true,
        status: true,
        deliveryMethod: true,
        contentCount: true,
        createdAt: true,
        approvedAt: true,
        sentAt: true,
      },
    });

    // EditorialStrategy guarda clientId como escalar (sem relação Prisma), então
    // resolvemos os nomes numa segunda query e anexamos a cada item.
    const clientIds = [...new Set(items.map((i) => i.clientId).filter(Boolean) as string[])];
    const clients = clientIds.length
      ? await prisma.client.findMany({
          where: { organizationId: org, id: { in: clientIds } },
          select: { id: true, name: true },
        })
      : [];
    const nameById = new Map(clients.map((c) => [c.id, c.name]));

    const withClient = items.map((i) => ({
      ...i,
      clientName: (i.clientId && nameById.get(i.clientId)) || "Cliente",
    }));

    return ok({ items: withClient });
  });
}
