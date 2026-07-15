-- Agendamento de postagens + conexão de redes sociais (via Zernio).

CREATE TABLE IF NOT EXISTS "social_connections" (
    "id"             UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "clientId"       UUID NOT NULL,
    "provider"       TEXT NOT NULL DEFAULT 'zernio',
    "profileId"      TEXT,
    "accounts"       JSONB NOT NULL DEFAULT '[]',
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "social_connections_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "social_connections_clientId_key" ON "social_connections"("clientId");
CREATE INDEX IF NOT EXISTS "social_connections_organizationId_idx" ON "social_connections"("organizationId");

CREATE TABLE IF NOT EXISTS "scheduled_posts" (
    "id"             UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "clientId"       UUID,
    "strategyId"     UUID NOT NULL,
    "deliverableId"  UUID NOT NULL,
    "channel"        TEXT NOT NULL,
    "caption"        TEXT,
    "scheduledFor"   TIMESTAMP(3),
    "status"         TEXT NOT NULL DEFAULT 'draft',
    "externalId"     TEXT,
    "error"          TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,
    CONSTRAINT "scheduled_posts_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "scheduled_posts_deliverableId_key" ON "scheduled_posts"("deliverableId");
CREATE INDEX IF NOT EXISTS "scheduled_posts_organizationId_idx" ON "scheduled_posts"("organizationId");
CREATE INDEX IF NOT EXISTS "scheduled_posts_strategyId_idx" ON "scheduled_posts"("strategyId");
