-- ESTOQUE EDITORIAL — acervo permanente de Linhas Editoriais aprovadas + enviadas.
-- Camada aditiva sobre editorial_strategies (sem tabela nova): a linha já
-- carrega editorial_lines→categories→themes; aqui adicionamos os metadados de
-- acervo + o snapshot congelado do documento exato enviado ao cliente.
ALTER TABLE "editorial_strategies"
    ADD COLUMN IF NOT EXISTS "inStock"         BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN IF NOT EXISTS "competencia"     TEXT,
    ADD COLUMN IF NOT EXISTS "deliveryMethod"  TEXT,
    ADD COLUMN IF NOT EXISTS "sentAt"          TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "contentSnapshot" JSONB,
    ADD COLUMN IF NOT EXISTS "contentCount"    INTEGER NOT NULL DEFAULT 0;

-- Consulta quente do Estoque: todas as linhas em acervo de um cliente.
CREATE INDEX IF NOT EXISTS "editorial_strategies_clientId_inStock_idx"
    ON "editorial_strategies"("clientId", "inStock");
