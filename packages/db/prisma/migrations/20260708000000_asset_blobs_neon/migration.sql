-- Armazenamento de arquivos NO PRÓPRIO BANCO (Neon), sem storage externo.
-- Tabela separada: os bytes (`data`) nunca entram nas listagens de assets;
-- só são lidos pela rota de download /api/v1/assets/:id/raw.

CREATE TABLE IF NOT EXISTS "asset_blobs" (
    "id"             UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "mimeType"       TEXT NOT NULL,
    "sizeBytes"      INTEGER NOT NULL,
    "data"           BYTEA NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "asset_blobs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "asset_blobs_organizationId_idx" ON "asset_blobs"("organizationId");
