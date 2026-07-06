import { z } from "zod";
import { prisma } from "@soie/db";
import { requireAuth } from "@/server/auth";
import { ok, handle, Errors } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuid = z.string().uuid();

/**
 * GET /api/v1/clients/:id/editorial-stock
 *
 * Lista o Estoque Editorial do cliente: TODAS as linhas aprovadas + enviadas,
 * mais recentes primeiro. Retorna só os metadados dos cards (sem o snapshot
 * completo) — a visualização completa carrega o snapshot sob demanda via
 * GET /editorial-strategies/:id. Assim a lista escala para centenas de linhas.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const { id: clientId } = await params;
    if (!uuid.safeParse(clientId).success) throw Errors.notFound("Cliente");

    const items = await prisma.editorialStrategy.findMany({
      where: { organizationId: org, clientId, inStock: true },
      orderBy: [{ sentAt: "desc" }, { version: "desc" }],
      select: {
        id: true,
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
    return ok({ items });
  });
}
