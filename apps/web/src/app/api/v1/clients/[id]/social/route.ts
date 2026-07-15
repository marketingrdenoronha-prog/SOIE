import { prisma } from "@soie/db";
import { requireAuth } from "@/server/auth";
import { ok, handle, Errors } from "@/server/http";
import { hasZernio, listAccounts, ZERNIO_PLATFORMS } from "@/server/zernio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /clients/:id/social — estado da conexão de redes do cliente. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const { id } = await params;
    const client = await prisma.client.findFirst({ where: { id, organizationId: org, deletedAt: null }, select: { id: true } });
    if (!client) throw Errors.notFound("Cliente");

    const conn = await prisma.socialConnection.findUnique({ where: { clientId: id } });

    // Se tem profile e Zernio configurado, atualiza o cache das contas.
    let accounts = (conn?.accounts as any[]) ?? [];
    if (conn?.profileId && hasZernio()) {
      try {
        accounts = await listAccounts(conn.profileId);
        await prisma.socialConnection.update({ where: { clientId: id }, data: { accounts } });
      } catch {
        /* mantém o cache anterior se a chamada falhar */
      }
    }

    return ok({
      configured: hasZernio(),
      platforms: ZERNIO_PLATFORMS,
      profileId: conn?.profileId ?? null,
      accounts,
    });
  });
}
