import { z } from "zod";
import { prisma } from "@soie/db";
import { requireAuth } from "@/server/auth";
import { ok, handle, Errors } from "@/server/http";
import { hasZernio, createProfile, getConnectAuthUrl, ZERNIO_PLATFORMS, type ZernioPlatform } from "@/server/zernio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const input = z.object({ platform: z.enum(ZERNIO_PLATFORMS) });

/**
 * POST /clients/:id/social/connect  { platform }
 *
 * Garante o profile do cliente no Zernio (cria na primeira vez) e devolve a URL
 * para AUTORIZAR aquela rede — é o "conectar um por um": o operador abre o link,
 * faz login na conta do cliente naquela rede e autoriza.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const { id } = await params;
    const { platform } = input.parse(await req.json());

    if (!hasZernio()) {
      throw Errors.badRequest("Publicação não configurada. Defina ZERNIO_API_KEY para conectar as redes.");
    }

    const client = await prisma.client.findFirst({
      where: { id, organizationId: org, deletedAt: null },
      select: { id: true, name: true },
    });
    if (!client) throw Errors.notFound("Cliente");

    let conn = await prisma.socialConnection.findUnique({ where: { clientId: id } });
    if (!conn?.profileId) {
      const profileId = await createProfile(client.name);
      conn = await prisma.socialConnection.upsert({
        where: { clientId: id },
        create: { organizationId: org, clientId: id, profileId },
        update: { profileId },
      });
    }

    const url = await getConnectAuthUrl(conn!.profileId!, platform as ZernioPlatform);
    return ok({ url, profileId: conn!.profileId });
  });
}
