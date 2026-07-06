-- V3: Esteira de Produção orientada à Linha Editorial.
-- Cada Linha Editorial (EditorialStrategy) é um card no Kanban de Produção.
-- `productionStage` é a coluna da esteira (client_review → approved → design →
-- final_review → to_post), independente do `status` de aprovação do cliente.
-- `stageHistory` guarda a timeline append-only de movimentações (nunca apagada).
ALTER TABLE "editorial_strategies" ADD COLUMN IF NOT EXISTS "productionStage" TEXT;
ALTER TABLE "editorial_strategies" ADD COLUMN IF NOT EXISTS "responsibleUserId" UUID;
ALTER TABLE "editorial_strategies" ADD COLUMN IF NOT EXISTS "stageHistory" JSONB NOT NULL DEFAULT '[]';
