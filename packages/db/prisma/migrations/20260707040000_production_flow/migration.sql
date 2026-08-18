-- FLUXO PÓS-APROVAÇÃO DA LINHA EDITORIAL — produção controlada dentro do SOIE.
-- Aditivo: status por peça, responsável e histórico na Deliverable; portal de
-- produção na EditorialStrategy; tabelas de assets versionados e comentários.

ALTER TABLE "deliverables"
    ADD COLUMN IF NOT EXISTS "productionStatus" TEXT NOT NULL DEFAULT 'aguardando',
    ADD COLUMN IF NOT EXISTS "assignedToId"     UUID,
    ADD COLUMN IF NOT EXISTS "history"          JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "editorial_strategies"
    ADD COLUMN IF NOT EXISTS "productionPortalToken" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "editorial_strategies_productionPortalToken_key"
    ON "editorial_strategies"("productionPortalToken");

CREATE TABLE IF NOT EXISTS "deliverable_assets" (
    "id"             UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "deliverableId"  UUID NOT NULL,
    "version"        INTEGER NOT NULL DEFAULT 1,
    "kind"           TEXT NOT NULL DEFAULT 'link',
    "url"            TEXT NOT NULL,
    "name"           TEXT,
    "note"           TEXT,
    "fileId"         UUID,
    "uploadedById"   UUID,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "deliverable_assets_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "deliverable_assets_organizationId_idx" ON "deliverable_assets"("organizationId");
CREATE INDEX IF NOT EXISTS "deliverable_assets_deliverableId_idx" ON "deliverable_assets"("deliverableId");
ALTER TABLE "deliverable_assets" ADD CONSTRAINT "deliverable_assets_deliverableId_fkey"
    FOREIGN KEY ("deliverableId") REFERENCES "deliverables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "deliverable_comments" (
    "id"             UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "deliverableId"  UUID NOT NULL,
    "authorId"       UUID,
    "authorName"     TEXT,
    "role"           TEXT,
    "body"           TEXT NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "deliverable_comments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "deliverable_comments_organizationId_idx" ON "deliverable_comments"("organizationId");
CREATE INDEX IF NOT EXISTS "deliverable_comments_deliverableId_idx" ON "deliverable_comments"("deliverableId");
ALTER TABLE "deliverable_comments" ADD CONSTRAINT "deliverable_comments_deliverableId_fkey"
    FOREIGN KEY ("deliverableId") REFERENCES "deliverables"("id") ON DELETE CASCADE ON UPDATE CASCADE;
