import { prisma } from "@soie/db";
import { requireAuth } from "@/server/auth";
import { ok, handle, Errors } from "@/server/http";
import { hasZernio, createPost, channelToPlatform } from "@/server/zernio";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * POST /editorial-strategies/:id/schedule/publish
 *
 * Envia ao Zernio as peças agendadas (com data e canal conectado). Cada peça
 * vira um post agendado na rede do cliente. Idempotente por peça: quem já foi
 * agendado (tem externalId) é pulado.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const { id } = await params;
    const origin = new URL(req.url).origin;

    if (!hasZernio()) throw Errors.badRequest("Publicação não configurada (defina ZERNIO_API_KEY).");

    const strategy = await prisma.editorialStrategy.findFirst({
      where: { id, organizationId: org },
      select: { id: true, clientId: true },
    });
    if (!strategy) throw Errors.notFound("Linha editorial");
    if (!strategy.clientId) throw Errors.badRequest("Linha sem cliente vinculado.");

    const conn = await prisma.socialConnection.findUnique({ where: { clientId: strategy.clientId } });
    if (!conn?.profileId) throw Errors.badRequest("Conecte as redes do cliente antes de agendar.");
    const accounts = (conn.accounts as any[]) ?? [];

    const schedules = await prisma.scheduledPost.findMany({
      where: { organizationId: org, strategyId: strategy.id },
    });

    let scheduled = 0;
    let skipped = 0;
    const failures: Array<{ deliverableId: string; error: string }> = [];

    for (const s of schedules) {
      if (s.externalId) { skipped++; continue; }        // já agendado
      if (!s.scheduledFor) { skipped++; continue; }      // sem data
      const platform = channelToPlatform(s.channel);
      const account = platform ? accounts.find((a) => a.platform === platform) : null;
      if (!platform || !account) {
        const error = `Sem conta conectada para "${s.channel}".`;
        failures.push({ deliverableId: s.deliverableId, error });
        await prisma.scheduledPost.update({ where: { id: s.id }, data: { status: "failed", error } });
        continue;
      }

      // Mídia: a arte/vídeo guardada no Neon, com URL absoluta (Zernio busca).
      const assets = await prisma.deliverableAsset.findMany({
        where: { organizationId: org, deliverableId: s.deliverableId },
        orderBy: { version: "desc" },
      });
      const latest = assets.length ? assets[0].version : 0;
      const mediaUrls = assets
        .filter((a) => a.version === latest)
        .map((a) => (a.url.startsWith("http") ? a.url : `${origin}${a.url}`));

      try {
        const externalId = await createPost({
          profileId: conn.profileId,
          accountId: account.accountId,
          platform,
          content: s.caption ?? "",
          mediaUrls,
          scheduledFor: s.scheduledFor.toISOString(),
        });
        await prisma.scheduledPost.update({
          where: { id: s.id },
          data: { status: "scheduled", externalId: externalId || "zernio", error: null },
        });
        scheduled++;
      } catch (e) {
        const error = e instanceof Error ? e.message : "Erro no Zernio";
        failures.push({ deliverableId: s.deliverableId, error });
        await prisma.scheduledPost.update({ where: { id: s.id }, data: { status: "failed", error } });
      }
    }

    return ok({ scheduled, skipped, failures });
  });
}
