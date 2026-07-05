-- V2 Fase 1: Onboarding + Dossiê Estratégico + campos preparatórios
-- para versionamento de linha editorial e vínculo Theme↔Deliverable.
-- Aditivo apenas — nenhum drop, nada perde compatibilidade com a V1.

-- ── Client: FK opcional para a linha editorial ativa (aprovada corrente).
ALTER TABLE "clients" ADD COLUMN "activeStrategyId" UUID;

-- ── EditorialStrategy: versionamento + trilha de parent + timestamps de fluxo.
ALTER TABLE "editorial_strategies" ADD COLUMN "clientId" UUID;
ALTER TABLE "editorial_strategies" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "editorial_strategies" ADD COLUMN "parentStrategyId" UUID;
ALTER TABLE "editorial_strategies" ADD COLUMN "submittedAt" TIMESTAMP(3);
ALTER TABLE "editorial_strategies" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "editorial_strategies" ADD COLUMN "changesRequestedAt" TIMESTAMP(3);
CREATE INDEX "editorial_strategies_clientId_idx" ON "editorial_strategies"("clientId");

-- ── Theme: canal/formato pré-atribuídos + FK inversa ao Deliverable produzido.
ALTER TABLE "themes" ADD COLUMN "channel" TEXT;
ALTER TABLE "themes" ADD COLUMN "format" TEXT;
ALTER TABLE "themes" ADD COLUMN "deliverableId" UUID;
CREATE UNIQUE INDEX "themes_deliverableId_key" ON "themes"("deliverableId");
CREATE INDEX "themes_deliverableId_idx" ON "themes"("deliverableId");

-- ── Deliverable: FK reversa opcional ao tema origem + marcador de entrega.
ALTER TABLE "deliverables" ADD COLUMN "themeId" UUID;
ALTER TABLE "deliverables" ADD COLUMN "deliveredAt" TIMESTAMP(3);
CREATE INDEX "deliverables_themeId_idx" ON "deliverables"("themeId");

-- ── Novos modelos do fluxo V2 (onboarding, dossiê, aprovação da linha).
CREATE TABLE "strategic_onboardings" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "step" INTEGER NOT NULL DEFAULT 0,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "strategic_onboardings_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "strategic_onboardings_clientId_key" ON "strategic_onboardings"("clientId");
CREATE INDEX "strategic_onboardings_organizationId_idx" ON "strategic_onboardings"("organizationId");
ALTER TABLE "strategic_onboardings" ADD CONSTRAINT "strategic_onboardings_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "strategic_dossiers" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'generating',
    "summary" JSONB NOT NULL DEFAULT '{}',
    "sources" JSONB NOT NULL DEFAULT '[]',
    "generatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "strategic_dossiers_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "strategic_dossiers_organizationId_idx" ON "strategic_dossiers"("organizationId");
CREATE INDEX "strategic_dossiers_clientId_idx" ON "strategic_dossiers"("clientId");
ALTER TABLE "strategic_dossiers" ADD CONSTRAINT "strategic_dossiers_clientId_fkey"
    FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "editorial_review_links" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "strategyId" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdBy" UUID,
    "expiresAt" TIMESTAMP(3),
    "lastViewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "editorial_review_links_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "editorial_review_links_token_key" ON "editorial_review_links"("token");
CREATE INDEX "editorial_review_links_organizationId_idx" ON "editorial_review_links"("organizationId");
CREATE INDEX "editorial_review_links_strategyId_idx" ON "editorial_review_links"("strategyId");
ALTER TABLE "editorial_review_links" ADD CONSTRAINT "editorial_review_links_strategyId_fkey"
    FOREIGN KEY ("strategyId") REFERENCES "editorial_strategies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "editorial_review_comments" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "strategyId" UUID NOT NULL,
    "decision" TEXT NOT NULL,
    "comment" TEXT,
    "authorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "editorial_review_comments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "editorial_review_comments_strategyId_idx" ON "editorial_review_comments"("strategyId");
ALTER TABLE "editorial_review_comments" ADD CONSTRAINT "editorial_review_comments_strategyId_fkey"
    FOREIGN KEY ("strategyId") REFERENCES "editorial_strategies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── FK opcional Theme → Deliverable (SET NULL on delete).
ALTER TABLE "themes" ADD CONSTRAINT "themes_deliverableId_fkey"
    FOREIGN KEY ("deliverableId") REFERENCES "deliverables"("id") ON DELETE SET NULL ON UPDATE CASCADE;
