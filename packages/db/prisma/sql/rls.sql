-- Row-Level Security backstop for multi-tenancy (Architecture Phase 1.13).
--
-- Every tenant table is filtered by the session variable `app.current_org`,
-- set per-transaction by withTenant() in the app. This is a safety net BELOW
-- the application's own organizationId scoping: even a query that forgets its
-- filter cannot read or write another tenant's rows.
--
-- Idempotent: safe to re-run. Apply after `prisma migrate`.
-- Note: the DB role the app connects as must NOT have the BYPASSRLS attribute
-- and must not be the table owner (owners bypass RLS unless FORCE is set), so
-- we FORCE RLS on each table below.

DO $$
DECLARE
  t text;
  -- Tables that carry organization_id and must be tenant-isolated.
  tenant_tables text[] := ARRAY[
    'memberships','roles','api_keys','clients','brands','projects','briefings',
    'files','uploads','brand_voices','vocabularies','archetypes','researches',
    'competitors','market_analyses','trends','news_items','connector_runs',
    'personas','pains','objections','desires','audience_questions',
    'sentiment_analyses','editorial_strategies','editorial_lines','categories',
    'themes','content_ideas','contents','posts','copies','calendars',
    'calendar_entries','approvals','agents','agent_versions','prompts',
    'prompt_versions','orchestration_runs','ai_executions','chats',
    'chat_messages','memories','knowledge_bases','knowledge_documents',
    'embeddings','subscriptions','usage_records','invoices','settings',
    'notifications','audit_logs','logs','reports',
    -- Produção e revisão pública (fase de entregas)
    'deliverables','review_links','review_comments',
    -- V2: onboarding estratégico, dossiê congelado e aprovação da linha editorial
    'strategic_onboardings','strategic_dossiers',
    'editorial_review_links','editorial_review_comments'
  ];
BEGIN
  FOREACH t IN ARRAY tenant_tables LOOP
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t) THEN
      EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY;', t);
      EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY;', t);
      EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I;', t);
      -- organization_id may be nullable (system rows). Allow NULL org rows to
      -- be visible to everyone (shared/system), tenant rows only to their org.
      EXECUTE format($f$
        CREATE POLICY tenant_isolation ON %I
        USING (
          "organizationId" IS NULL
          OR "organizationId" = current_setting('app.current_org', true)::uuid
        )
        WITH CHECK (
          "organizationId" IS NULL
          OR "organizationId" = current_setting('app.current_org', true)::uuid
        );
      $f$, t);
    END IF;
  END LOOP;
END $$;
