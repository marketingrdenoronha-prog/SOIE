import { z } from "zod";
import { prisma } from "@soie/db";
import { requireAuth } from "@/server/auth";
import { ok, handle, Errors } from "@/server/http";
import { createKnowledgeSource, mapKnowledgeError, type KnowledgeType } from "@/server/knowledge/ingest";
import { normalizePublicUrl, UrlValidationError } from "@/server/knowledge/ssrf";

const URL_TYPES = new Set(["article", "news", "webpage"]);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Ingestão de URL (fetch + extração + chunk + embeddings) precisa de janela.
export const maxDuration = 120;

const uuid = z.string().uuid();

const createInput = z
  .object({
    type: z.enum(["manual", "document", "article", "news", "webpage"]),
    title: z.string().max(300).optional(),
    content: z.string().max(200_000).optional(),
    url: z.string().max(2000).optional(),
    tags: z.array(z.string().max(40)).max(20).optional(),
    priority: z.number().int().min(0).max(5).optional(),
  })
  .refine((v) => (["article", "news", "webpage"].includes(v.type) ? Boolean(v.url) : Boolean(v.content?.trim())), {
    message: "Informe a URL (link/artigo/notícia) ou o conteúdo (nota/documento).",
  });

async function ownedClient(org: string, id: string) {
  if (!uuid.safeParse(id).success) throw Errors.notFound("Cliente");
  const c = await prisma.client.findFirst({ where: { id, organizationId: org, deletedAt: null }, select: { id: true } });
  if (!c) throw Errors.notFound("Cliente");
  return c;
}

/** GET /clients/:id/knowledge-sources — lista as fontes (com filtros). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const { id } = await params;
    await ownedClient(org, id);

    const url = new URL(req.url);
    const q = url.searchParams.get("q")?.trim();
    const type = url.searchParams.get("type")?.trim();
    const status = url.searchParams.get("status")?.trim();

    const sources = await prisma.knowledgeDocument.findMany({
      where: {
        organizationId: org,
        clientId: id,
        ...(type ? { type } : {}),
        ...(status ? { status } : {}),
        ...(q ? { OR: [{ title: { contains: q, mode: "insensitive" } }, { domain: { contains: q, mode: "insensitive" } }] } : {}),
      },
      orderBy: [{ createdAt: "desc" }],
      take: 300,
      select: {
        id: true, type: true, title: true, url: true, domain: true, author: true,
        publishedAt: true, fetchedAt: true, createdAt: true, updatedAt: true,
        status: true, enabled: true, tags: true, priority: true, summary: true, meta: true,
      },
    });
    return ok(sources);
  });
}

/** POST /clients/:id/knowledge-sources — adiciona e processa uma fonte. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const { id } = await params;
    await ownedClient(org, id);
    const input = createInput.parse(await req.json());

    // Validação SINTÁTICA antes de persistir: erros locais (vazio, sintaxe,
    // protocolo) viram 400 e NÃO criam uma fonte "Falhou" inútil. Erros de rede/
    // segurança/extração (URL já aceita) seguem para a fonte persistida abaixo.
    if (URL_TYPES.has(input.type)) {
      try {
        normalizePublicUrl(input.url ?? "");
      } catch (e) {
        if (e instanceof UrlValidationError) throw Errors.badRequest(mapKnowledgeError(e).message);
        throw e;
      }
    }

    const res = await createKnowledgeSource({
      organizationId: org,
      clientId: id,
      type: input.type as KnowledgeType,
      title: input.title,
      content: input.content,
      url: input.url,
      tags: input.tags,
      priority: input.priority,
    });

    const source = await prisma.knowledgeDocument.findFirst({
      where: { id: res.id, organizationId: org },
      select: {
        id: true, type: true, title: true, url: true, domain: true, author: true,
        publishedAt: true, fetchedAt: true, createdAt: true, updatedAt: true,
        status: true, enabled: true, tags: true, priority: true, summary: true, meta: true,
      },
    });
    // 201 mesmo em falha de processamento: a fonte fica listada como "failed"
    // com o motivo, e o cliente recebe `error`/`errorCode` para exibir.
    return ok({ source, error: res.error ?? null, errorCode: res.errorCode ?? null }, 201);
  });
}
