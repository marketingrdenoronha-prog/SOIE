import { prisma } from "@soie/db";
import { safeFetchUrl, KnowledgeFetchError } from "./ssrf";
import { extractPage } from "./extract";
import { chunkText, normalizeText, checksum, approxTokens } from "./chunk";
import { embedText } from "../ai-runtime";

/**
 * Ingestão de fontes na Base de Conhecimento (síncrona, no request do Next.js —
 * não depende de worker/Redis). Une notas, documentos e URLs na MESMA camada
 * (KnowledgeDocument) e indexa em chunks (Embedding). Embeddings são
 * best-effort; a busca lexical funciona sempre. Conteúdo externo é DADO — nunca
 * instrução — e é sanitizado (só texto, sem HTML executável).
 */

export type KnowledgeType = "manual" | "document" | "article" | "news" | "webpage";
const URL_TYPES: KnowledgeType[] = ["article", "news", "webpage"];
const MAX_CONTENT_CHARS = 200_000;
const MAX_EMBED_CHUNKS = 40; // teto p/ não estourar custo/tempo em fontes enormes

export interface IngestInput {
  organizationId: string;
  clientId: string;
  projectId?: string | null;
  type: KnowledgeType;
  title?: string;
  content?: string;
  url?: string;
  tags?: string[];
  priority?: number;
}

/** Uma Base de Conhecimento por cliente (auto-provisionada). */
export async function ensureKnowledgeBase(organizationId: string, clientId: string): Promise<string> {
  const existing = await prisma.knowledgeBase.findFirst({
    where: { organizationId, scope: "client", scopeId: clientId },
    select: { id: true },
  });
  if (existing) return existing.id;
  const created = await prisma.knowledgeBase.create({
    data: { organizationId, scope: "client", scopeId: clientId, name: "Base de Conhecimento" },
    select: { id: true },
  });
  return created.id;
}

/** Cria a fonte e a processa (fetch/extract → normaliza → chunk → indexa). */
export async function createKnowledgeSource(input: IngestInput): Promise<{ id: string; status: string; error?: string }> {
  const baseId = await ensureKnowledgeBase(input.organizationId, input.clientId);
  const isUrl = URL_TYPES.includes(input.type);

  const doc = await prisma.knowledgeDocument.create({
    data: {
      organizationId: input.organizationId,
      knowledgeBaseId: baseId,
      clientId: input.clientId,
      projectId: input.projectId ?? null,
      type: input.type,
      title: (input.title || input.url || "Conhecimento").slice(0, 300),
      source: isUrl ? "url" : "manual",
      status: "processing",
      url: input.url ?? null,
      tags: (input.tags ?? []) as object,
      priority: input.priority ?? 0,
      enabled: true,
    },
    select: { id: true },
  });

  try {
    await processSource(doc.id, input, isUrl);
    return { id: doc.id, status: "ready" };
  } catch (e) {
    const error = e instanceof KnowledgeFetchError ? e.message : e instanceof Error ? e.message : "Falha ao processar.";
    await prisma.knowledgeDocument
      .update({ where: { id: doc.id }, data: { status: "failed", meta: { error } } })
      .catch(() => {});
    // Fonte fica visível como "failed" (com o motivo) e o usuário recebe o erro.
    return { id: doc.id, status: "failed", error };
  }
}

/** Reprocessa uma fonte existente (re-fetch da URL ou re-chunk da nota/doc). */
export async function reprocessKnowledgeSource(organizationId: string, sourceId: string): Promise<{ status: string; error?: string }> {
  const doc = await prisma.knowledgeDocument.findFirst({
    where: { id: sourceId, organizationId },
    select: { id: true, type: true, url: true, title: true, content: true, clientId: true, projectId: true, tags: true, priority: true },
  });
  if (!doc) throw new Error("Fonte não encontrada.");
  await prisma.knowledgeDocument.update({ where: { id: doc.id }, data: { status: "processing" } });
  const isUrl = URL_TYPES.includes(doc.type as KnowledgeType);
  try {
    await processSource(
      doc.id,
      {
        organizationId,
        clientId: doc.clientId ?? "",
        projectId: doc.projectId,
        type: doc.type as KnowledgeType,
        title: doc.title,
        content: doc.content ?? undefined,
        url: doc.url ?? undefined,
      },
      isUrl,
    );
    return { status: "ready" };
  } catch (e) {
    const error = e instanceof Error ? e.message : "Falha ao reprocessar.";
    await prisma.knowledgeDocument.update({ where: { id: doc.id }, data: { status: "failed", meta: { error } } }).catch(() => {});
    return { status: "failed", error };
  }
}

/** Núcleo: resolve o conteúdo, deduplica, chunka e indexa (com embeddings opc.). */
async function processSource(docId: string, input: IngestInput, isUrl: boolean): Promise<void> {
  const patch: Record<string, unknown> = { fetchedAt: new Date() };
  let rawContent = input.content ?? "";
  let title = input.title;

  if (isUrl) {
    if (!input.url) throw new Error("URL ausente.");
    const page = await safeFetchUrl(input.url);
    const extracted = extractPage(page.body);
    rawContent = extracted.text;
    title = title || extracted.title;
    let domain: string | undefined;
    try {
      domain = new URL(page.finalUrl).hostname.replace(/^www\./, "");
    } catch {
      /* ignore */
    }
    patch.domain = domain ?? null;
    patch.canonicalUrl = extracted.canonicalUrl ?? page.finalUrl;
    patch.author = extracted.author ?? null;
    patch.publishedAt = extracted.publishedAt ?? null;
    patch.summary = extracted.description ?? null;
    patch.language = extracted.language ?? null;
    patch.url = page.finalUrl;
  }

  const content = normalizeText(rawContent).slice(0, MAX_CONTENT_CHARS);
  if (!content || content.length < 20) {
    throw new Error("Não foi possível extrair conteúdo útil desta fonte.");
  }
  const sum = checksum(content);

  // Deduplicação: outra fonte PRONTA do MESMO cliente com o mesmo checksum.
  const dup = await prisma.knowledgeDocument.findFirst({
    where: { organizationId: input.organizationId, clientId: input.clientId, checksum: sum, status: "ready", id: { not: docId } },
    select: { id: true },
  });
  if (dup) throw new Error("Conteúdo idêntico já existe na base (duplicata).");

  const chunks = chunkText(content);

  // Substitui os chunks antigos (reprocessamento) e insere os novos.
  await prisma.embedding.deleteMany({ where: { knowledgeDocumentId: docId } });

  const canEmbed = Boolean(chunks.length) && chunks.length <= MAX_EMBED_CHUNKS;
  if (canEmbed) {
    // Insere um a um para capturar o id e gravar o vetor (best-effort) por raw.
    for (let i = 0; i < chunks.length; i++) {
      const c = chunks[i]!;
      const row = await prisma.embedding.create({
        data: {
          organizationId: input.organizationId,
          knowledgeDocumentId: docId,
          clientId: input.clientId,
          projectId: input.projectId ?? null,
          chunkIndex: i,
          content: c,
          tokens: approxTokens(c),
        },
        select: { id: true },
      });
      const vec = await embedText(c);
      if (vec) {
        await prisma
          .$executeRawUnsafe(`UPDATE "embeddings" SET "embedding" = $1::vector WHERE "id" = $2::uuid`, `[${vec.join(",")}]`, row.id)
          .catch(() => {});
      }
    }
  } else {
    // Fonte grande: só busca lexical (createMany é mais rápido; tsv é gerado).
    await prisma.embedding.createMany({
      data: chunks.map((c, i) => ({
        organizationId: input.organizationId,
        knowledgeDocumentId: docId,
        clientId: input.clientId,
        projectId: input.projectId ?? null,
        chunkIndex: i,
        content: c,
        tokens: approxTokens(c),
      })),
    });
  }

  await prisma.knowledgeDocument.update({
    where: { id: docId },
    data: {
      ...patch,
      title: (title || "Conhecimento").slice(0, 300),
      content,
      checksum: sum,
      status: "ready",
      meta: { chunks: chunks.length, chars: content.length },
    },
  });
}
