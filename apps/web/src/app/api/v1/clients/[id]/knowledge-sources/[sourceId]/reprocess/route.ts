import { z } from "zod";
import { prisma } from "@soie/db";
import { requireAuth } from "@/server/auth";
import { ok, handle, Errors } from "@/server/http";
import { reprocessKnowledgeSource } from "@/server/knowledge/ingest";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const uuid = z.string().uuid();

/**
 * POST /clients/:id/knowledge-sources/:sourceId/reprocess
 * "Atualizar conteúdo": re-busca a URL (ou re-chunka a nota/documento) e
 * reindexa. Só a própria fonte é afetada; escopada a org + cliente.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string; sourceId: string }> }) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const { id, sourceId } = await params;
    if (!uuid.safeParse(id).success || !uuid.safeParse(sourceId).success) throw Errors.notFound("Fonte");

    const doc = await prisma.knowledgeDocument.findFirst({
      where: { id: sourceId, organizationId: org, clientId: id },
      select: { id: true },
    });
    if (!doc) throw Errors.notFound("Fonte");

    const res = await reprocessKnowledgeSource(org, sourceId);
    return ok(res);
  });
}
