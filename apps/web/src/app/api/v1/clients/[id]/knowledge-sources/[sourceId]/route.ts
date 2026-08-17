import { z } from "zod";
import { prisma } from "@soie/db";
import { requireAuth } from "@/server/auth";
import { ok, handle, Errors } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuid = z.string().uuid();

const patchInput = z.object({
  title: z.string().min(1).max(300).optional(),
  tags: z.array(z.string().max(40)).max(20).optional(),
  priority: z.number().int().min(0).max(5).optional(),
  enabled: z.boolean().optional(),
});

/** Confirma que a fonte pertence ao cliente + organização do usuário. */
async function ownedSource(org: string, clientId: string, sourceId: string) {
  if (!uuid.safeParse(clientId).success || !uuid.safeParse(sourceId).success) throw Errors.notFound("Fonte");
  const doc = await prisma.knowledgeDocument.findFirst({
    where: { id: sourceId, organizationId: org, clientId },
    select: { id: true },
  });
  if (!doc) throw Errors.notFound("Fonte");
  return doc;
}

/** GET — detalhe da fonte (com os primeiros chunks para visualização). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string; sourceId: string }> }) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const { id, sourceId } = await params;
    await ownedSource(org, id, sourceId);

    const source = await prisma.knowledgeDocument.findFirst({
      where: { id: sourceId, organizationId: org },
      select: {
        id: true, type: true, title: true, url: true, canonicalUrl: true, domain: true,
        author: true, publishedAt: true, fetchedAt: true, createdAt: true, updatedAt: true,
        status: true, enabled: true, tags: true, priority: true, summary: true, language: true,
        content: true, meta: true,
      },
    });
    const chunks = await prisma.embedding.count({ where: { knowledgeDocumentId: sourceId, organizationId: org } });
    return ok({ ...source, chunks });
  });
}

/** PATCH — edita metadados (título, tags, prioridade) e ativa/desativa. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; sourceId: string }> }) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const { id, sourceId } = await params;
    await ownedSource(org, id, sourceId);
    const body = patchInput.parse(await req.json());

    const data: Record<string, unknown> = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.tags !== undefined) data.tags = body.tags as object;
    if (body.priority !== undefined) data.priority = body.priority;
    if (body.enabled !== undefined) {
      data.enabled = body.enabled;
      // Refletir no status quando a fonte está pronta: desativada some do
      // retrieval (o retrieval filtra enabled=true de qualquer forma).
    }
    if (Object.keys(data).length === 0) throw Errors.badRequest("Nada para atualizar.");

    const updated = await prisma.knowledgeDocument.update({
      where: { id: sourceId },
      data,
      select: { id: true, title: true, tags: true, priority: true, enabled: true, status: true },
    });
    return ok(updated);
  });
}

/** DELETE — remove a fonte e seus chunks (cascade). */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; sourceId: string }> }) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const { id, sourceId } = await params;
    await ownedSource(org, id, sourceId);
    await prisma.knowledgeDocument.delete({ where: { id: sourceId } });
    return ok({ id: sourceId, deleted: true });
  });
}
