import { prisma } from "@soie/db";
import { safeFetchUrl, KnowledgeFetchError } from "./ssrf";
import { extractContent, assessContent } from "./extract";
import { chunkText, normalizeText, checksum, approxTokens } from "./chunk";
import { embedText } from "../ai-runtime";

/** Diagnóstico estruturado da ingestão (persistido em meta; nunca conteúdo
 * sensível completo nem credenciais). */
export interface IngestDiagnostics {
  errorCode?: string;
  httpStatus?: number;
  contentType?: string;
  htmlLength?: number;
  extractedTextLength?: number;
  extractionMethod?: string;
  finalUrl?: string;
  domain?: string;
  likelyJavascriptRendered?: boolean;
}

/** Erro de ingestão com código estruturado + diagnóstico (extração/qualidade). */
class KnowledgeIngestError extends Error {
  constructor(public readonly errorCode: string, message: string, public readonly diagnostics: IngestDiagnostics = {}) {
    super(message);
  }
}

/** Traduz um erro de fetch/ingestão em { errorCode, message, httpStatus } com
 * mensagem ÚTIL ao usuário (sem stack trace nem dados sensíveis). */
function mapError(e: unknown): { errorCode: string; message: string; httpStatus?: number; diagnostics?: IngestDiagnostics } {
  if (e instanceof KnowledgeIngestError) return { errorCode: e.errorCode, message: e.message, diagnostics: e.diagnostics };
  if (e instanceof KnowledgeFetchError) {
    switch (e.code) {
      case "invalid_url":
      case "blocked_protocol":
      case "blocked_host":
        return { errorCode: "BLOCKED_URL", message: e.message };
      case "timeout":
        return { errorCode: "TIMEOUT", message: "Tempo esgotado ao acessar a página." };
      case "dns_error":
        return { errorCode: "DNS_ERROR", message: "Domínio não encontrado (verifique a URL)." };
      case "bad_content_type":
        return { errorCode: "UNSUPPORTED_CONTENT_TYPE", message: e.message };
      case "too_large":
        return { errorCode: "HTTP_ERROR", message: e.message };
      case "too_many_redirects":
        return { errorCode: "HTTP_ERROR", message: "Muitos redirecionamentos." };
      case "http_error": {
        const s = e.httpStatus;
        if (s === 403) return { errorCode: "HTTP_403", message: "O servidor recusou a importação automática (HTTP 403).", httpStatus: 403 };
        if (s === 404) return { errorCode: "HTTP_404", message: "Página não encontrada (HTTP 404).", httpStatus: 404 };
        return { errorCode: "HTTP_ERROR", message: e.message, httpStatus: s };
      }
      default:
        return { errorCode: "HTTP_ERROR", message: "Não foi possível acessar a página." };
    }
  }
  return { errorCode: "EXTRACTION_ERROR", message: e instanceof Error ? e.message : "Falha ao processar a fonte." };
}

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
export async function createKnowledgeSource(input: IngestInput): Promise<{ id: string; status: string; error?: string; errorCode?: string }> {
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
    return failSource(doc.id, input, e);
  }
}

/** Persiste a falha com diagnóstico estruturado + log (sem conteúdo sensível). */
async function failSource(docId: string, input: IngestInput, e: unknown): Promise<{ id: string; status: string; error?: string; errorCode?: string }> {
  const mapped = mapError(e);
  const diagnostics: IngestDiagnostics = { errorCode: mapped.errorCode, httpStatus: mapped.httpStatus, ...(mapped.diagnostics ?? {}) };
  let host: string | undefined;
  try { host = input.url ? new URL(input.url).hostname : undefined; } catch { /* ignore */ }
  console.log("knowledge.ingest.failed", JSON.stringify({ sourceId: docId, organizationId: input.organizationId, clientId: input.clientId, host, ...diagnostics }));
  await prisma.knowledgeDocument
    .update({ where: { id: docId }, data: { status: "failed", meta: { error: mapped.message, ...diagnostics } } })
    .catch(() => {});
  return { id: docId, status: "failed", error: mapped.message, errorCode: mapped.errorCode };
}

/** Reprocessa uma fonte existente (re-fetch da URL ou re-chunk da nota/doc). */
export async function reprocessKnowledgeSource(organizationId: string, sourceId: string): Promise<{ status: string; error?: string; errorCode?: string }> {
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
    const r = await failSource(doc.id, {
      organizationId, clientId: doc.clientId ?? "", projectId: doc.projectId,
      type: doc.type as KnowledgeType, title: doc.title, content: doc.content ?? undefined, url: doc.url ?? undefined,
    }, e);
    return { status: "failed", error: r.error, errorCode: r.errorCode };
  }
}

/** Núcleo: resolve o conteúdo (com CASCATA de extração p/ URLs), deduplica,
 * chunka e indexa (com embeddings opc.). */
async function processSource(docId: string, input: IngestInput, isUrl: boolean): Promise<void> {
  const patch: Record<string, unknown> = { fetchedAt: new Date() };
  const meta: Record<string, unknown> = {};
  let rawContent = input.content ?? "";
  let title = input.title;

  if (isUrl) {
    if (!input.url) throw new KnowledgeIngestError("BLOCKED_URL", "URL ausente.");
    const page = await safeFetchUrl(input.url); // valida SSRF + revalida redirects
    const extracted = extractContent(page.body);
    let domain: string | undefined;
    try { domain = new URL(page.finalUrl).hostname.replace(/^www\./, ""); } catch { /* ignore */ }

    const diag: IngestDiagnostics = {
      httpStatus: page.status,
      contentType: page.contentType.split(";")[0] || undefined,
      htmlLength: extracted.htmlLength,
      extractedTextLength: extracted.textLength,
      extractionMethod: extracted.method,
      finalUrl: page.finalUrl,
      domain,
      likelyJavascriptRendered: extracted.likelyJavascriptRendered,
    };

    // Página curta e útil ainda vale: inclui título/descrição no conteúdo
    // indexável quando o corpo é pequeno (institucional).
    const parts = extracted.textLength < 300 && extracted.description
      ? [`${extracted.title}. ${extracted.description}`, extracted.text]
      : [extracted.text];
    rawContent = parts.filter(Boolean).join("\n\n");
    title = title || extracted.title;

    const normalized = normalizeText(rawContent);
    const useful = assessContent({ ...extracted, textLength: normalized.length }, Boolean(extracted.description));
    if (!useful.useful) {
      if (extracted.likelyJavascriptRendered) {
        throw new KnowledgeIngestError("JS_RENDER_REQUIRED", "O site parece carregar o conteúdo usando JavaScript — não há texto suficiente no HTML inicial.", diag);
      }
      if (extracted.htmlLength < 200) {
        throw new KnowledgeIngestError("EMPTY_RESPONSE", "A página retornou praticamente vazia.", diag);
      }
      throw new KnowledgeIngestError("INSUFFICIENT_CONTENT", "Página acessada, mas encontramos pouco conteúdo textual para indexar.", diag);
    }

    console.log("knowledge.ingest.ok", JSON.stringify({ sourceId: docId, organizationId: input.organizationId, clientId: input.clientId, host: domain, httpStatus: diag.httpStatus, contentType: diag.contentType, htmlLength: diag.htmlLength, extractionMethod: diag.extractionMethod, extractedTextLength: diag.extractedTextLength }));

    patch.domain = domain ?? null;
    patch.canonicalUrl = extracted.canonicalUrl ?? page.finalUrl;
    patch.author = extracted.author ?? null;
    patch.publishedAt = extracted.publishedAt ?? null;
    patch.summary = extracted.description ?? null;
    patch.language = extracted.language ?? null;
    patch.url = page.finalUrl;
    meta.httpStatus = diag.httpStatus;
    meta.contentType = diag.contentType;
    meta.htmlLength = diag.htmlLength;
    meta.extractionMethod = diag.extractionMethod;
    meta.finalUrl = diag.finalUrl;
  }

  const content = normalizeText(rawContent).slice(0, MAX_CONTENT_CHARS);
  // Nota/documento (texto do usuário): floor baixo; URL já passou pela avaliação.
  if (!content || (!isUrl && content.length < 10)) {
    throw new KnowledgeIngestError("INSUFFICIENT_CONTENT", "Sem conteúdo útil para indexar.");
  }
  const sum = checksum(content);

  // Deduplicação: outra fonte PRONTA do MESMO cliente com o mesmo checksum.
  const dup = await prisma.knowledgeDocument.findFirst({
    where: { organizationId: input.organizationId, clientId: input.clientId, checksum: sum, status: "ready", id: { not: docId } },
    select: { id: true },
  });
  if (dup) throw new KnowledgeIngestError("DUPLICATE", "Conteúdo idêntico já existe na base (duplicata).");

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
      meta: { chunks: chunks.length, chars: content.length, ...meta },
    },
  });
}
