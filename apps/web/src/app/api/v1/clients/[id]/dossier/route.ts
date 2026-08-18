import { z } from "zod";
import { prisma } from "@soie/db";
import { requireAuth } from "@/server/auth";
import { ok, handle, Errors } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuid = z.string().uuid();

/**
 * GET /api/v1/clients/:id/dossier
 * Devolve o dossiê estratégico mais recente do cliente (o congelado após o
 * onboarding). Retorna `null` se ainda não gerou nenhum.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const { id } = await params;
    if (!uuid.safeParse(id).success) throw Errors.notFound("Cliente");

    const client = await prisma.client.findFirst({
      where: { id, organizationId: org, deletedAt: null },
      select: { id: true },
    });
    if (!client) throw Errors.notFound("Cliente");

    let dossier = await prisma.strategicDossier.findFirst({
      where: { organizationId: org, clientId: id },
      orderBy: { createdAt: "desc" },
    });

    // Auto-heal: se o request do finalize morreu (timeout/deploy) entre criar
    // o dossier e consolidá-lo, ele ficaria "generating" para sempre e a UI
    // presa no spinner. Depois de 10min sem consolidar, marca como failed para
    // o operador poder refazer o finalize.
    if (dossier?.status === "generating" && Date.now() - dossier.createdAt.getTime() > 10 * 60 * 1000) {
      dossier = await prisma.strategicDossier.update({
        where: { id: dossier.id },
        data: { status: "failed" },
      });
    }
    return ok({ dossier });
  });
}
