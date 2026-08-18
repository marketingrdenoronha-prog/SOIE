-- Base de Conhecimento V3: evolui knowledge_documents (fonte) e embeddings
-- (chunk) para ingestão de URLs/notas/documentos + recuperação contextual.
-- Idempotente e não-destrutivo (tabelas hoje sem uso; colunas nullable/default).

-- knowledge_documents → fonte de conhecimento
ALTER TABLE "knowledge_documents" ADD COLUMN IF NOT EXISTS "clientId" UUID;
ALTER TABLE "knowledge_documents" ADD COLUMN IF NOT EXISTS "projectId" UUID;
ALTER TABLE "knowledge_documents" ADD COLUMN IF NOT EXISTS "type" TEXT NOT NULL DEFAULT 'document';
ALTER TABLE "knowledge_documents" ADD COLUMN IF NOT EXISTS "url" TEXT;
ALTER TABLE "knowledge_documents" ADD COLUMN IF NOT EXISTS "canonicalUrl" TEXT;
ALTER TABLE "knowledge_documents" ADD COLUMN IF NOT EXISTS "domain" TEXT;
ALTER TABLE "knowledge_documents" ADD COLUMN IF NOT EXISTS "author" TEXT;
ALTER TABLE "knowledge_documents" ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3);
ALTER TABLE "knowledge_documents" ADD COLUMN IF NOT EXISTS "fetchedAt" TIMESTAMP(3);
ALTER TABLE "knowledge_documents" ADD COLUMN IF NOT EXISTS "content" TEXT;
ALTER TABLE "knowledge_documents" ADD COLUMN IF NOT EXISTS "summary" TEXT;
ALTER TABLE "knowledge_documents" ADD COLUMN IF NOT EXISTS "language" TEXT;
ALTER TABLE "knowledge_documents" ADD COLUMN IF NOT EXISTS "tags" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "knowledge_documents" ADD COLUMN IF NOT EXISTS "priority" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "knowledge_documents" ADD COLUMN IF NOT EXISTS "enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "knowledge_documents" ADD COLUMN IF NOT EXISTS "checksum" TEXT;
ALTER TABLE "knowledge_documents" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS "knowledge_documents_clientId_idx" ON "knowledge_documents"("clientId");
CREATE INDEX IF NOT EXISTS "knowledge_documents_projectId_idx" ON "knowledge_documents"("projectId");
CREATE INDEX IF NOT EXISTS "knowledge_documents_type_idx" ON "knowledge_documents"("type");
CREATE INDEX IF NOT EXISTS "knowledge_documents_status_idx" ON "knowledge_documents"("status");
CREATE INDEX IF NOT EXISTS "knowledge_documents_createdAt_idx" ON "knowledge_documents"("createdAt");

-- embeddings → chunk
ALTER TABLE "embeddings" ADD COLUMN IF NOT EXISTS "clientId" UUID;
ALTER TABLE "embeddings" ADD COLUMN IF NOT EXISTS "projectId" UUID;
CREATE INDEX IF NOT EXISTS "embeddings_clientId_idx" ON "embeddings"("clientId");

-- Busca lexical (fallback sem embeddings): coluna gerada tsvector + índice GIN.
-- 'portuguese' cobre o conteúdo em pt-BR do produto.
ALTER TABLE "embeddings" ADD COLUMN IF NOT EXISTS "tsv" tsvector
  GENERATED ALWAYS AS (to_tsvector('portuguese', coalesce("content", ''))) STORED;
CREATE INDEX IF NOT EXISTS "embeddings_tsv_idx" ON "embeddings" USING GIN ("tsv");
