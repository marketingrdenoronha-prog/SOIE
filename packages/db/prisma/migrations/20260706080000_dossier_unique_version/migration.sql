-- Fecha a corrida do double-submit no finalize do onboarding: dois cliques
-- concorrentes não podem criar dois dossiês com a mesma versão. Antes de criar
-- o índice único, renumera qualquer duplicata existente (gerada pela antiga
-- estratégia count+1 sem lock) preservando a ordem de criação.
WITH ranked AS (
    SELECT "id", ROW_NUMBER() OVER (PARTITION BY "clientId" ORDER BY "createdAt", "id") AS rn
    FROM "strategic_dossiers"
)
UPDATE "strategic_dossiers" d
SET "version" = r.rn
FROM ranked r
WHERE d."id" = r."id" AND d."version" <> r.rn;

CREATE UNIQUE INDEX "strategic_dossiers_clientId_version_key"
    ON "strategic_dossiers"("clientId", "version");
