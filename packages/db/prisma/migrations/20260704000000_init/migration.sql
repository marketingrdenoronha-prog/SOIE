-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateEnum
CREATE TYPE "OrgStatus" AS ENUM ('active', 'suspended', 'trialing');

-- CreateEnum
CREATE TYPE "MembershipStatus" AS ENUM ('active', 'invited', 'disabled');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('onboarding', 'research', 'strategy', 'production', 'review', 'done', 'archived');

-- CreateEnum
CREATE TYPE "Confidence" AS ENUM ('high', 'medium', 'low');

-- CreateEnum
CREATE TYPE "ResearchType" AS ENUM ('market', 'competitor', 'trend', 'audience', 'full');

-- CreateEnum
CREATE TYPE "FunnelStage" AS ENUM ('tofu', 'mofu', 'bofu');

-- CreateEnum
CREATE TYPE "EditorialObjective" AS ENUM ('authority', 'trust', 'educate', 'reduce_objection', 'attract', 'identify', 'position', 'desire', 'relationship', 'convert');

-- CreateEnum
CREATE TYPE "ContentStatus" AS ENUM ('draft', 'in_review', 'approved', 'published', 'archived');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('pending', 'approved', 'changes_requested', 'rejected');

-- CreateEnum
CREATE TYPE "AIProvider" AS ENUM ('openai', 'anthropic', 'gemini', 'deepseek');

-- CreateEnum
CREATE TYPE "ExecutionStatus" AS ENUM ('success', 'error', 'fallback');

-- CreateEnum
CREATE TYPE "OrchestrationStatus" AS ENUM ('queued', 'running', 'succeeded', 'failed', 'partial');

-- CreateEnum
CREATE TYPE "MemoryScope" AS ENUM ('org', 'client', 'brand', 'project');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('trialing', 'active', 'past_due', 'canceled');

-- CreateEnum
CREATE TYPE "DeliverableStatus" AS ENUM ('queued', 'generating', 'draft', 'internal_review', 'client_review', 'approved', 'changes_requested', 'delivered');

-- CreateEnum
CREATE TYPE "ReviewDecision" AS ENUM ('approve', 'request_changes');

-- CreateTable
CREATE TABLE "organizations" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "status" "OrgStatus" NOT NULL DEFAULT 'trialing',
    "billingEmail" TEXT,
    "byokEnabled" BOOLEAN NOT NULL DEFAULT false,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "planId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "mfaSecret" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memberships" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "roleId" UUID NOT NULL,
    "status" "MembershipStatus" NOT NULL DEFAULT 'invited',
    "scope" JSONB NOT NULL DEFAULT '{}',
    "invitedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" UUID NOT NULL,
    "organizationId" UUID,
    "name" TEXT NOT NULL,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "permissions" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "api_keys" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "scopes" JSONB NOT NULL DEFAULT '[]',
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdBy" UUID,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "refreshTokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ip" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "industry" TEXT,
    "website" TEXT,
    "logoUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "tags" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brands" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "positioning" TEXT,
    "valueProposition" TEXT,
    "products" JSONB NOT NULL DEFAULT '[]',
    "objectives" JSONB NOT NULL DEFAULT '[]',
    "icp" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "projects" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "brandId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "goal" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'onboarding',
    "funnelStageFocus" "FunnelStage",
    "platforms" JSONB NOT NULL DEFAULT '[]',
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "briefings" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "clientId" UUID NOT NULL,
    "projectId" UUID,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "source" TEXT NOT NULL DEFAULT 'form',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "briefings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "files" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "clientId" UUID,
    "projectId" UUID,
    "name" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "checksum" TEXT,
    "uploadedBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "uploads" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "fileId" UUID,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "parseResult" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "uploads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "brand_voices" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "brandId" UUID NOT NULL,
    "tone" JSONB NOT NULL DEFAULT '{}',
    "formality" TEXT,
    "emojisPolicy" JSONB NOT NULL DEFAULT '{}',
    "doList" JSONB NOT NULL DEFAULT '[]',
    "dontList" JSONB NOT NULL DEFAULT '[]',
    "examples" JSONB NOT NULL DEFAULT '[]',
    "confidence" "Confidence" NOT NULL DEFAULT 'medium',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "brand_voices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vocabularies" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "brandId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "term" TEXT NOT NULL,
    "note" TEXT,

    CONSTRAINT "vocabularies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "archetypes" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "brandId" UUID NOT NULL,
    "archetype" TEXT NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "rationale" TEXT,

    CONSTRAINT "archetypes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "researches" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "type" "ResearchType" NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "params" JSONB NOT NULL DEFAULT '{}',
    "summary" JSONB NOT NULL DEFAULT '{}',
    "confidence" "Confidence" NOT NULL DEFAULT 'low',
    "orchestrationRunId" UUID,
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "researches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competitors" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "researchId" UUID,
    "name" TEXT NOT NULL,
    "url" TEXT,
    "positioning" TEXT,
    "strengths" JSONB NOT NULL DEFAULT '[]',
    "weaknesses" JSONB NOT NULL DEFAULT '[]',
    "contentStrategy" JSONB NOT NULL DEFAULT '{}',
    "metrics" JSONB NOT NULL DEFAULT '{}',
    "source" TEXT NOT NULL DEFAULT 'ai',

    CONSTRAINT "competitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_analyses" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "researchId" UUID,
    "swot" JSONB NOT NULL DEFAULT '{}',
    "trends" JSONB NOT NULL DEFAULT '[]',
    "opportunities" JSONB NOT NULL DEFAULT '[]',
    "threats" JSONB NOT NULL DEFAULT '[]',
    "confidence" "Confidence" NOT NULL DEFAULT 'medium',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trends" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "projectId" UUID,
    "source" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "timeseries" JSONB NOT NULL DEFAULT '[]',
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trends_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "news_items" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "projectId" UUID,
    "source" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "summary" TEXT,
    "sentiment" TEXT,
    "embedding" vector(1536),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "connector_runs" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "connector" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'running',
    "request" JSONB NOT NULL DEFAULT '{}',
    "resultRef" TEXT,
    "itemsCount" INTEGER NOT NULL DEFAULT 0,
    "cost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "error" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "connector_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "personas" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "demographics" JSONB NOT NULL DEFAULT '{}',
    "psychographics" JSONB NOT NULL DEFAULT '{}',
    "channels" JSONB NOT NULL DEFAULT '[]',
    "awarenessLevel" TEXT,
    "languageNotes" JSONB NOT NULL DEFAULT '{}',
    "confidence" "Confidence" NOT NULL DEFAULT 'medium',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "personas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pains" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "personaId" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "intensity" INTEGER NOT NULL DEFAULT 3,
    "evidence" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "pains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "objections" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "personaId" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "counterArgument" TEXT,
    "evidence" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "objections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "desires" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "personaId" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "strength" INTEGER NOT NULL DEFAULT 3,

    CONSTRAINT "desires_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audience_questions" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "personaId" UUID NOT NULL,
    "question" TEXT NOT NULL,
    "source" TEXT,
    "volumeHint" TEXT,

    CONSTRAINT "audience_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sentiment_analyses" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "source" TEXT NOT NULL,
    "sampleSize" INTEGER NOT NULL DEFAULT 0,
    "distribution" JSONB NOT NULL DEFAULT '{}',
    "themes" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sentiment_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "editorial_strategies" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "positioning" TEXT,
    "pillars" JSONB NOT NULL DEFAULT '[]',
    "objectives" JSONB NOT NULL DEFAULT '{}',
    "rationale" TEXT,
    "confidence" "Confidence" NOT NULL DEFAULT 'medium',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "editorial_strategies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "editorial_lines" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "strategyId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "objective" "EditorialObjective" NOT NULL,
    "funnelStage" "FunnelStage" NOT NULL,
    "platforms" JSONB NOT NULL DEFAULT '[]',

    CONSTRAINT "editorial_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "editorialLineId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "parentId" UUID,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "themes" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "categoryId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "angle" TEXT,
    "microthemes" JSONB NOT NULL DEFAULT '[]',
    "priority" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "themes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "content_ideas" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "themeId" UUID,
    "title" TEXT NOT NULL,
    "format" TEXT,
    "funnelStage" "FunnelStage",
    "objective" "EditorialObjective",
    "rationale" TEXT,
    "status" TEXT NOT NULL DEFAULT 'suggested',
    "score" JSONB NOT NULL DEFAULT '{}',
    "createdBy" TEXT NOT NULL DEFAULT 'ai',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_ideas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "contents" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "ideaId" UUID,
    "title" TEXT NOT NULL,
    "platform" TEXT,
    "format" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'draft',
    "body" JSONB NOT NULL DEFAULT '{}',
    "briefing" JSONB NOT NULL DEFAULT '{}',
    "createdBy" UUID,
    "assignedTo" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "contents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "posts" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "contentId" UUID NOT NULL,
    "platform" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "externalRef" TEXT,
    "status" "ContentStatus" NOT NULL DEFAULT 'draft',
    "metrics" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "copies" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "contentId" UUID,
    "projectId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "frameworkId" UUID,
    "hookId" UUID,
    "variantLabel" TEXT,
    "score" JSONB NOT NULL DEFAULT '{}',
    "aiExecutionId" UUID,

    CONSTRAINT "copies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendars" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
    "viewDefault" TEXT NOT NULL DEFAULT 'month',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "calendars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calendar_entries" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "calendarId" UUID NOT NULL,
    "contentId" UUID,
    "postId" UUID,
    "date" TIMESTAMP(3) NOT NULL,
    "time" TEXT,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "platform" TEXT,
    "owner" UUID,
    "dragOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "calendar_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approvals" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "subjectType" TEXT NOT NULL,
    "subjectId" UUID NOT NULL,
    "requestedBy" UUID,
    "reviewer" UUID,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'pending',
    "comment" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "deliverables" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "contentId" UUID,
    "channel" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "brief" TEXT,
    "spec" JSONB NOT NULL DEFAULT '{}',
    "status" "DeliverableStatus" NOT NULL DEFAULT 'queued',
    "version" INTEGER NOT NULL DEFAULT 1,
    "confidence" "Confidence",
    "evaluationScore" INTEGER,
    "orchestrationRunId" UUID,
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "deliverables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_links" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "deliverableId" UUID NOT NULL,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdBy" UUID,
    "expiresAt" TIMESTAMP(3),
    "lastViewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_comments" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "deliverableId" UUID NOT NULL,
    "reviewLinkId" UUID,
    "decision" "ReviewDecision" NOT NULL,
    "comment" TEXT,
    "authorName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "frameworks" (
    "id" UUID NOT NULL,
    "organizationId" UUID,
    "name" TEXT NOT NULL,
    "kind" TEXT,
    "structure" JSONB NOT NULL DEFAULT '{}',
    "whenToUse" TEXT,
    "examples" JSONB NOT NULL DEFAULT '[]',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "frameworks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hooks" (
    "id" UUID NOT NULL,
    "organizationId" UUID,
    "text" TEXT NOT NULL,
    "category" TEXT,
    "emotion" TEXT,
    "platformFit" JSONB NOT NULL DEFAULT '[]',
    "performanceHint" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hooks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "templates" (
    "id" UUID NOT NULL,
    "organizationId" UUID,
    "name" TEXT NOT NULL,
    "format" TEXT,
    "blocks" JSONB NOT NULL DEFAULT '[]',
    "variables" JSONB NOT NULL DEFAULT '[]',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scripts" (
    "id" UUID NOT NULL,
    "organizationId" UUID,
    "title" TEXT NOT NULL,
    "structure" JSONB NOT NULL DEFAULT '{}',
    "durationHint" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agents" (
    "id" UUID NOT NULL,
    "organizationId" UUID,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "activeVersionId" UUID,
    "config" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_versions" (
    "id" UUID NOT NULL,
    "organizationId" UUID,
    "agentId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "systemPromptRef" UUID,
    "tools" JSONB NOT NULL DEFAULT '[]',
    "modelPolicy" JSONB NOT NULL DEFAULT '{}',
    "changelog" TEXT,
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompts" (
    "id" UUID NOT NULL,
    "organizationId" UUID,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "activeVersionId" UUID,
    "variablesSchema" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prompts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prompt_versions" (
    "id" UUID NOT NULL,
    "organizationId" UUID,
    "promptId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "template" TEXT NOT NULL,
    "variables" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,
    "validatorReport" JSONB NOT NULL DEFAULT '{}',
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prompt_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orchestration_runs" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "status" "OrchestrationStatus" NOT NULL DEFAULT 'queued',
    "input" JSONB NOT NULL DEFAULT '{}',
    "output" JSONB NOT NULL DEFAULT '{}',
    "steps" JSONB NOT NULL DEFAULT '[]',
    "totalCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "confidence" "Confidence",
    "triggeredBy" UUID,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "orchestration_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_executions" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "orchestrationRunId" UUID,
    "chatId" UUID,
    "agentId" UUID,
    "agentVersionId" UUID,
    "promptVersionId" UUID,
    "provider" "AIProvider" NOT NULL,
    "model" TEXT NOT NULL,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "latencyMs" INTEGER NOT NULL DEFAULT 0,
    "costUsd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "ExecutionStatus" NOT NULL DEFAULT 'success',
    "fallbackFrom" TEXT,
    "cacheHit" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "requestRef" TEXT,
    "responseRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chats" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "projectId" UUID,
    "userId" UUID NOT NULL,
    "title" TEXT,
    "agentKey" TEXT NOT NULL DEFAULT 'planning',
    "contextRef" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "chatId" UUID NOT NULL,
    "role" TEXT NOT NULL,
    "content" JSONB NOT NULL DEFAULT '{}',
    "aiExecutionId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "memories" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "scope" "MemoryScope" NOT NULL,
    "scopeId" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1536),
    "sourceRef" TEXT,
    "confidence" "Confidence" NOT NULL DEFAULT 'medium',
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "memories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_bases" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "scope" "MemoryScope" NOT NULL,
    "scopeId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_bases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_documents" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "knowledgeBaseId" UUID NOT NULL,
    "fileId" UUID,
    "title" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'upload',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "meta" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "embeddings" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "knowledgeDocumentId" UUID NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "embedding" vector(1536),
    "tokens" INTEGER NOT NULL DEFAULT 0,
    "meta" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "embeddings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plans" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "priceMonth" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "limits" JSONB NOT NULL DEFAULT '{}',
    "features" JSONB NOT NULL DEFAULT '[]',
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "planId" UUID NOT NULL,
    "stripeSubscriptionId" TEXT,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'trialing',
    "currentPeriodStart" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "seats" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usage_records" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "period" DATE NOT NULL,
    "metric" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "breakdown" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "usage_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "stripeInvoiceId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "pdfUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_price_book" (
    "id" UUID NOT NULL,
    "provider" "AIProvider" NOT NULL,
    "model" TEXT NOT NULL,
    "inputPricePer1k" DOUBLE PRECISION NOT NULL,
    "outputPricePer1k" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'usd',
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveTo" TIMESTAMP(3),

    CONSTRAINT "ai_price_book_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" UUID NOT NULL,
    "organizationId" UUID,
    "namespace" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL DEFAULT '{}',
    "updatedBy" UUID,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "data" JSONB NOT NULL DEFAULT '{}',
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "actorUserId" UUID,
    "action" TEXT NOT NULL,
    "subjectType" TEXT,
    "subjectId" UUID,
    "before" JSONB NOT NULL DEFAULT '{}',
    "after" JSONB NOT NULL DEFAULT '{}',
    "ip" TEXT,
    "traceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "logs" (
    "id" UUID NOT NULL,
    "organizationId" UUID,
    "level" TEXT NOT NULL,
    "module" TEXT,
    "message" TEXT NOT NULL,
    "context" JSONB NOT NULL DEFAULT '{}',
    "traceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "projectId" UUID,
    "kind" TEXT NOT NULL,
    "params" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'queued',
    "fileId" UUID,
    "summary" JSONB NOT NULL DEFAULT '{}',
    "createdBy" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "memberships_userId_idx" ON "memberships"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "memberships_organizationId_userId_key" ON "memberships"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "roles_organizationId_idx" ON "roles"("organizationId");

-- CreateIndex
CREATE INDEX "api_keys_organizationId_idx" ON "api_keys"("organizationId");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE INDEX "clients_organizationId_idx" ON "clients"("organizationId");

-- CreateIndex
CREATE INDEX "brands_organizationId_idx" ON "brands"("organizationId");

-- CreateIndex
CREATE INDEX "brands_clientId_idx" ON "brands"("clientId");

-- CreateIndex
CREATE INDEX "projects_organizationId_idx" ON "projects"("organizationId");

-- CreateIndex
CREATE INDEX "projects_brandId_idx" ON "projects"("brandId");

-- CreateIndex
CREATE INDEX "briefings_organizationId_idx" ON "briefings"("organizationId");

-- CreateIndex
CREATE INDEX "briefings_clientId_idx" ON "briefings"("clientId");

-- CreateIndex
CREATE INDEX "files_organizationId_idx" ON "files"("organizationId");

-- CreateIndex
CREATE INDEX "uploads_organizationId_idx" ON "uploads"("organizationId");

-- CreateIndex
CREATE INDEX "brand_voices_organizationId_idx" ON "brand_voices"("organizationId");

-- CreateIndex
CREATE INDEX "brand_voices_brandId_idx" ON "brand_voices"("brandId");

-- CreateIndex
CREATE INDEX "vocabularies_organizationId_idx" ON "vocabularies"("organizationId");

-- CreateIndex
CREATE INDEX "vocabularies_brandId_idx" ON "vocabularies"("brandId");

-- CreateIndex
CREATE INDEX "archetypes_organizationId_idx" ON "archetypes"("organizationId");

-- CreateIndex
CREATE INDEX "archetypes_brandId_idx" ON "archetypes"("brandId");

-- CreateIndex
CREATE INDEX "researches_organizationId_idx" ON "researches"("organizationId");

-- CreateIndex
CREATE INDEX "researches_projectId_idx" ON "researches"("projectId");

-- CreateIndex
CREATE INDEX "competitors_organizationId_idx" ON "competitors"("organizationId");

-- CreateIndex
CREATE INDEX "competitors_projectId_idx" ON "competitors"("projectId");

-- CreateIndex
CREATE INDEX "market_analyses_organizationId_idx" ON "market_analyses"("organizationId");

-- CreateIndex
CREATE INDEX "market_analyses_projectId_idx" ON "market_analyses"("projectId");

-- CreateIndex
CREATE INDEX "trends_organizationId_idx" ON "trends"("organizationId");

-- CreateIndex
CREATE INDEX "news_items_organizationId_idx" ON "news_items"("organizationId");

-- CreateIndex
CREATE INDEX "connector_runs_organizationId_idx" ON "connector_runs"("organizationId");

-- CreateIndex
CREATE INDEX "personas_organizationId_idx" ON "personas"("organizationId");

-- CreateIndex
CREATE INDEX "personas_projectId_idx" ON "personas"("projectId");

-- CreateIndex
CREATE INDEX "pains_organizationId_idx" ON "pains"("organizationId");

-- CreateIndex
CREATE INDEX "pains_personaId_idx" ON "pains"("personaId");

-- CreateIndex
CREATE INDEX "objections_organizationId_idx" ON "objections"("organizationId");

-- CreateIndex
CREATE INDEX "objections_personaId_idx" ON "objections"("personaId");

-- CreateIndex
CREATE INDEX "desires_organizationId_idx" ON "desires"("organizationId");

-- CreateIndex
CREATE INDEX "desires_personaId_idx" ON "desires"("personaId");

-- CreateIndex
CREATE INDEX "audience_questions_organizationId_idx" ON "audience_questions"("organizationId");

-- CreateIndex
CREATE INDEX "audience_questions_personaId_idx" ON "audience_questions"("personaId");

-- CreateIndex
CREATE INDEX "sentiment_analyses_organizationId_idx" ON "sentiment_analyses"("organizationId");

-- CreateIndex
CREATE INDEX "sentiment_analyses_projectId_idx" ON "sentiment_analyses"("projectId");

-- CreateIndex
CREATE INDEX "editorial_strategies_organizationId_idx" ON "editorial_strategies"("organizationId");

-- CreateIndex
CREATE INDEX "editorial_strategies_projectId_idx" ON "editorial_strategies"("projectId");

-- CreateIndex
CREATE INDEX "editorial_lines_organizationId_idx" ON "editorial_lines"("organizationId");

-- CreateIndex
CREATE INDEX "editorial_lines_strategyId_idx" ON "editorial_lines"("strategyId");

-- CreateIndex
CREATE INDEX "categories_organizationId_idx" ON "categories"("organizationId");

-- CreateIndex
CREATE INDEX "categories_editorialLineId_idx" ON "categories"("editorialLineId");

-- CreateIndex
CREATE INDEX "themes_organizationId_idx" ON "themes"("organizationId");

-- CreateIndex
CREATE INDEX "themes_categoryId_idx" ON "themes"("categoryId");

-- CreateIndex
CREATE INDEX "content_ideas_organizationId_idx" ON "content_ideas"("organizationId");

-- CreateIndex
CREATE INDEX "content_ideas_projectId_idx" ON "content_ideas"("projectId");

-- CreateIndex
CREATE INDEX "contents_organizationId_idx" ON "contents"("organizationId");

-- CreateIndex
CREATE INDEX "contents_projectId_idx" ON "contents"("projectId");

-- CreateIndex
CREATE INDEX "posts_organizationId_idx" ON "posts"("organizationId");

-- CreateIndex
CREATE INDEX "posts_contentId_idx" ON "posts"("contentId");

-- CreateIndex
CREATE INDEX "copies_organizationId_idx" ON "copies"("organizationId");

-- CreateIndex
CREATE INDEX "copies_projectId_idx" ON "copies"("projectId");

-- CreateIndex
CREATE INDEX "calendars_organizationId_idx" ON "calendars"("organizationId");

-- CreateIndex
CREATE INDEX "calendars_projectId_idx" ON "calendars"("projectId");

-- CreateIndex
CREATE INDEX "calendar_entries_organizationId_idx" ON "calendar_entries"("organizationId");

-- CreateIndex
CREATE INDEX "calendar_entries_calendarId_idx" ON "calendar_entries"("calendarId");

-- CreateIndex
CREATE INDEX "approvals_organizationId_idx" ON "approvals"("organizationId");

-- CreateIndex
CREATE INDEX "approvals_subjectType_subjectId_idx" ON "approvals"("subjectType", "subjectId");

-- CreateIndex
CREATE INDEX "deliverables_organizationId_idx" ON "deliverables"("organizationId");

-- CreateIndex
CREATE INDEX "deliverables_projectId_idx" ON "deliverables"("projectId");

-- CreateIndex
CREATE INDEX "deliverables_status_idx" ON "deliverables"("status");

-- CreateIndex
CREATE UNIQUE INDEX "review_links_token_key" ON "review_links"("token");

-- CreateIndex
CREATE INDEX "review_links_organizationId_idx" ON "review_links"("organizationId");

-- CreateIndex
CREATE INDEX "review_links_deliverableId_idx" ON "review_links"("deliverableId");

-- CreateIndex
CREATE INDEX "review_comments_organizationId_idx" ON "review_comments"("organizationId");

-- CreateIndex
CREATE INDEX "review_comments_deliverableId_idx" ON "review_comments"("deliverableId");

-- CreateIndex
CREATE INDEX "frameworks_organizationId_idx" ON "frameworks"("organizationId");

-- CreateIndex
CREATE INDEX "hooks_organizationId_idx" ON "hooks"("organizationId");

-- CreateIndex
CREATE INDEX "templates_organizationId_idx" ON "templates"("organizationId");

-- CreateIndex
CREATE INDEX "scripts_organizationId_idx" ON "scripts"("organizationId");

-- CreateIndex
CREATE INDEX "agents_organizationId_idx" ON "agents"("organizationId");

-- CreateIndex
CREATE INDEX "agent_versions_organizationId_idx" ON "agent_versions"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "agent_versions_agentId_version_key" ON "agent_versions"("agentId", "version");

-- CreateIndex
CREATE INDEX "prompts_organizationId_idx" ON "prompts"("organizationId");

-- CreateIndex
CREATE INDEX "prompt_versions_organizationId_idx" ON "prompt_versions"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "prompt_versions_promptId_version_key" ON "prompt_versions"("promptId", "version");

-- CreateIndex
CREATE INDEX "orchestration_runs_organizationId_idx" ON "orchestration_runs"("organizationId");

-- CreateIndex
CREATE INDEX "orchestration_runs_projectId_idx" ON "orchestration_runs"("projectId");

-- CreateIndex
CREATE INDEX "ai_executions_organizationId_createdAt_idx" ON "ai_executions"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "ai_executions_orchestrationRunId_idx" ON "ai_executions"("orchestrationRunId");

-- CreateIndex
CREATE INDEX "ai_executions_provider_model_idx" ON "ai_executions"("provider", "model");

-- CreateIndex
CREATE INDEX "chats_organizationId_idx" ON "chats"("organizationId");

-- CreateIndex
CREATE INDEX "chat_messages_organizationId_idx" ON "chat_messages"("organizationId");

-- CreateIndex
CREATE INDEX "chat_messages_chatId_idx" ON "chat_messages"("chatId");

-- CreateIndex
CREATE INDEX "memories_organizationId_idx" ON "memories"("organizationId");

-- CreateIndex
CREATE INDEX "memories_scope_scopeId_idx" ON "memories"("scope", "scopeId");

-- CreateIndex
CREATE INDEX "knowledge_bases_organizationId_idx" ON "knowledge_bases"("organizationId");

-- CreateIndex
CREATE INDEX "knowledge_bases_scope_scopeId_idx" ON "knowledge_bases"("scope", "scopeId");

-- CreateIndex
CREATE INDEX "knowledge_documents_organizationId_idx" ON "knowledge_documents"("organizationId");

-- CreateIndex
CREATE INDEX "knowledge_documents_knowledgeBaseId_idx" ON "knowledge_documents"("knowledgeBaseId");

-- CreateIndex
CREATE INDEX "embeddings_organizationId_idx" ON "embeddings"("organizationId");

-- CreateIndex
CREATE INDEX "embeddings_knowledgeDocumentId_idx" ON "embeddings"("knowledgeDocumentId");

-- CreateIndex
CREATE INDEX "subscriptions_organizationId_idx" ON "subscriptions"("organizationId");

-- CreateIndex
CREATE INDEX "usage_records_organizationId_idx" ON "usage_records"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "usage_records_organizationId_period_metric_key" ON "usage_records"("organizationId", "period", "metric");

-- CreateIndex
CREATE INDEX "invoices_organizationId_idx" ON "invoices"("organizationId");

-- CreateIndex
CREATE INDEX "ai_price_book_provider_model_idx" ON "ai_price_book"("provider", "model");

-- CreateIndex
CREATE INDEX "settings_organizationId_idx" ON "settings"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "settings_organizationId_namespace_key_key" ON "settings"("organizationId", "namespace", "key");

-- CreateIndex
CREATE INDEX "notifications_organizationId_idx" ON "notifications"("organizationId");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "notifications"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_organizationId_createdAt_idx" ON "audit_logs"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "logs_organizationId_createdAt_idx" ON "logs"("organizationId", "createdAt");

-- CreateIndex
CREATE INDEX "reports_organizationId_idx" ON "reports"("organizationId");

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "memberships" ADD CONSTRAINT "memberships_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "roles" ADD CONSTRAINT "roles_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brands" ADD CONSTRAINT "brands_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "projects" ADD CONSTRAINT "projects_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "briefings" ADD CONSTRAINT "briefings_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "brand_voices" ADD CONSTRAINT "brand_voices_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vocabularies" ADD CONSTRAINT "vocabularies_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "archetypes" ADD CONSTRAINT "archetypes_brandId_fkey" FOREIGN KEY ("brandId") REFERENCES "brands"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "researches" ADD CONSTRAINT "researches_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competitors" ADD CONSTRAINT "competitors_researchId_fkey" FOREIGN KEY ("researchId") REFERENCES "researches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_analyses" ADD CONSTRAINT "market_analyses_researchId_fkey" FOREIGN KEY ("researchId") REFERENCES "researches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "personas" ADD CONSTRAINT "personas_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pains" ADD CONSTRAINT "pains_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "personas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "objections" ADD CONSTRAINT "objections_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "personas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "desires" ADD CONSTRAINT "desires_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "personas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audience_questions" ADD CONSTRAINT "audience_questions_personaId_fkey" FOREIGN KEY ("personaId") REFERENCES "personas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editorial_strategies" ADD CONSTRAINT "editorial_strategies_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editorial_lines" ADD CONSTRAINT "editorial_lines_strategyId_fkey" FOREIGN KEY ("strategyId") REFERENCES "editorial_strategies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_editorialLineId_fkey" FOREIGN KEY ("editorialLineId") REFERENCES "editorial_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categories" ADD CONSTRAINT "categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "themes" ADD CONSTRAINT "themes_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_ideas" ADD CONSTRAINT "content_ideas_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_ideas" ADD CONSTRAINT "content_ideas_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "themes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contents" ADD CONSTRAINT "contents_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "contents" ADD CONSTRAINT "contents_ideaId_fkey" FOREIGN KEY ("ideaId") REFERENCES "content_ideas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "posts" ADD CONSTRAINT "posts_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "contents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "copies" ADD CONSTRAINT "copies_contentId_fkey" FOREIGN KEY ("contentId") REFERENCES "contents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendars" ADD CONSTRAINT "calendars_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_entries" ADD CONSTRAINT "calendar_entries_calendarId_fkey" FOREIGN KEY ("calendarId") REFERENCES "calendars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calendar_entries" ADD CONSTRAINT "calendar_entries_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deliverables" ADD CONSTRAINT "deliverables_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_links" ADD CONSTRAINT "review_links_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "deliverables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_comments" ADD CONSTRAINT "review_comments_deliverableId_fkey" FOREIGN KEY ("deliverableId") REFERENCES "deliverables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_versions" ADD CONSTRAINT "agent_versions_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prompt_versions" ADD CONSTRAINT "prompt_versions_promptId_fkey" FOREIGN KEY ("promptId") REFERENCES "prompts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orchestration_runs" ADD CONSTRAINT "orchestration_runs_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_executions" ADD CONSTRAINT "ai_executions_orchestrationRunId_fkey" FOREIGN KEY ("orchestrationRunId") REFERENCES "orchestration_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "chats"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_documents" ADD CONSTRAINT "knowledge_documents_knowledgeBaseId_fkey" FOREIGN KEY ("knowledgeBaseId") REFERENCES "knowledge_bases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "embeddings" ADD CONSTRAINT "embeddings_knowledgeDocumentId_fkey" FOREIGN KEY ("knowledgeDocumentId") REFERENCES "knowledge_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_planId_fkey" FOREIGN KEY ("planId") REFERENCES "plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

