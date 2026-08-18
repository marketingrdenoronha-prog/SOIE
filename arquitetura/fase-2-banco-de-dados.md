# Fase 2 — Modelagem do Banco de Dados

PostgreSQL 16 + `pgvector`. Multi-tenant por discriminador `organization_id` com Row-Level Security. Toda tabela de negócio tem: `id` (uuid v7), `organization_id`, `created_at`, `updated_at`, `deleted_at` (soft delete) e, quando aplicável, `created_by`.

Convenções: nomes de tabela no plural em snake_case; chaves estrangeiras com índice; enums via tipos Postgres; JSONB para atributos flexíveis; `pgvector` para colunas de embedding.

## 2.1 Mapa de domínios → entidades

| Domínio | Entidades |
|---------|-----------|
| Identity & Access | `organizations`, `users`, `memberships`, `roles`, `permissions`, `api_keys`, `sessions` |
| Client Management | `clients`, `brands`, `projects`, `briefings`, `files`, `uploads` |
| Brand DNA | `brand_voices`, `vocabularies`, `archetypes` |
| Market Intelligence | `researches`, `competitors`, `market_analyses`, `trends`, `news_items`, `connector_runs` |
| Audience Intelligence | `personas`, `pains`, `objections`, `desires`, `audience_questions`, `sentiment_analyses` |
| Editorial | `editorial_strategies`, `editorial_lines`, `categories`, `themes`, `content_ideas`, `contents`, `posts`, `copies`, `calendars`, `calendar_entries`, `approvals` |
| Library | `frameworks`, `hooks`, `templates`, `scripts` |
| AI Orchestration | `agents`, `agent_versions`, `prompts`, `prompt_versions`, `ai_executions`, `orchestration_runs`, `chats`, `chat_messages`, `memories`, `knowledge_bases`, `knowledge_documents`, `embeddings` |
| Billing & Usage | `plans`, `subscriptions`, `usage_records`, `invoices`, `ai_price_book` |
| Platform | `settings`, `notifications`, `audit_logs`, `logs`, `reports` |

## 2.2 Diagrama de relacionamentos (núcleo)

```
organizations ─┬─< memberships >─ users
               ├─< roles
               ├─< api_keys
               ├─< clients ─┬─< brands ─┬─< projects ─┬─< researches ─< competitors
               │            │           │             │              └─< market_analyses
               │            │           │             ├─< personas ─┬─< pains
               │            │           │             │             ├─< objections
               │            │           │             │             └─< desires
               │            │           │             ├─< editorial_strategies ─< editorial_lines ─< categories ─< themes
               │            │           │             ├─< content_ideas ─< contents ─┬─< posts
               │            │           │             │                              └─< copies
               │            │           │             ├─< calendars ─< calendar_entries
               │            │           │             └─< orchestration_runs ─< ai_executions
               │            │           └─< briefings
               │            └─< brand_voices, vocabularies, archetypes
               ├─< frameworks, hooks, templates, scripts        (biblioteca; escopo org, opcional por brand)
               ├─< agents ─< agent_versions
               ├─< prompts ─< prompt_versions
               ├─< knowledge_bases ─< knowledge_documents ─< embeddings
               ├─< chats ─< chat_messages
               ├─< memories
               ├─< reports
               ├─< subscriptions ─ plans
               ├─< usage_records
               ├─< notifications
               ├─< audit_logs
               └─< settings
```

`<` = "tem muitos". Todo relacionamento respeita `organization_id`.

## 2.3 Identity & Access

**organizations** — o tenant.
`id, name, slug (único), plan_id, status(enum: active|suspended|trialing), billing_email, settings(jsonb), byok_enabled(bool), created_at, updated_at, deleted_at`

**users** — identidade global (pode pertencer a várias orgs).
`id, email(único), name, password_hash, avatar_url, mfa_secret(nullable, cripto), status, last_login_at, created_at, updated_at`

**memberships** — usuário ↔ organização (N:N) com papel.
`id, organization_id→organizations, user_id→users, role_id→roles, status(active|invited|disabled), invited_by, scope(jsonb: restrição opcional a client_ids), created_at`
Único: `(organization_id, user_id)`.

**roles** — papéis por org (com defaults do sistema).
`id, organization_id(nullable p/ roles globais), name, is_system(bool), permissions(jsonb array)`

**permissions** — catálogo de permissões (referência). `key, description`.

**api_keys** — chaves de integração do tenant.
`id, organization_id, name, key_hash, prefix, scopes(jsonb), last_used_at, expires_at, created_by, revoked_at`

**sessions** — refresh tokens ativos.
`id, user_id, organization_id(ativo), refresh_token_hash, user_agent, ip, expires_at, revoked_at`

## 2.4 Client Management

**clients** — cliente final atendido pela org.
`id, organization_id, name, industry, website, logo_url, status, owner_membership_id, tags(jsonb), created_at, updated_at, deleted_at`

**brands** — marca de um cliente (um cliente pode ter várias marcas).
`id, organization_id, client_id→clients, name, positioning, value_proposition, products(jsonb), objectives(jsonb), icp(jsonb), created_at`

**projects** — unidade de trabalho editorial de uma marca.
`id, organization_id, brand_id→brands, name, goal, status(enum: onboarding|research|strategy|production|review|done|archived), funnel_stage_focus, platforms(jsonb), starts_at, ends_at, created_at`

**briefings** — briefing/onboarding preenchido para um cliente/projeto.
`id, organization_id, client_id, project_id(nullable), payload(jsonb: respostas estruturadas), source(enum: form|document|ai_extracted), status, created_by`

**files** — metadados de arquivos no object storage.
`id, organization_id, client_id(nullable), project_id(nullable), name, mime_type, size_bytes, storage_key, checksum, uploaded_by, created_at`

**uploads** — sessão/estado de upload (multipart, processamento).
`id, organization_id, file_id(nullable), status(pending|processing|ready|failed), parse_result(jsonb), created_at`

## 2.5 Brand DNA

**brand_voices** — DNA verbal da marca (Contexto Linguístico da Constituição).
`id, organization_id, brand_id→brands, tone(jsonb), formality(enum), emojis_policy(jsonb), do_list(jsonb), dont_list(jsonb), examples(jsonb), confidence(enum: high|medium|low), created_at`

**vocabularies** — termos, expressões, gírias e proibições da marca.
`id, organization_id, brand_id, kind(enum: preferred|banned|jargon|expression), term, note`

**archetypes** — arquétipos de marca associados.
`id, organization_id, brand_id, archetype(enum: sage|hero|jester|...), weight(0..1), rationale`

## 2.6 Market Intelligence

**researches** — uma rodada de pesquisa (dispara conectores + agentes).
`id, organization_id, project_id→projects, type(enum: market|competitor|trend|audience|full), status, params(jsonb), summary(jsonb), confidence, orchestration_run_id, created_by, created_at`

**competitors** — concorrentes identificados/analisados.
`id, organization_id, project_id, name, url, positioning, strengths(jsonb), weaknesses(jsonb), content_strategy(jsonb), metrics(jsonb), source(enum: ai|manual|connector)`

**market_analyses** — sínteses de mercado (tamanho, tendências, ameaças, oportunidades).
`id, organization_id, project_id, research_id, swot(jsonb), trends(jsonb), opportunities(jsonb), threats(jsonb), confidence, created_at`

**trends** — sinais de tendência coletados (Google Trends, redes).
`id, organization_id, project_id(nullable), source(enum: google_trends|reddit|tiktok|instagram|linkedin|youtube), keyword, score, timeseries(jsonb), captured_at`

**news_items** — notícias/menções relevantes.
`id, organization_id, project_id(nullable), source, title, url, published_at, summary, sentiment, embedding(vector)`

**connector_runs** — execução de um conector externo (auditável).
`id, organization_id, connector(enum), status, request(jsonb), result_ref, items_count, cost, error, started_at, finished_at`

## 2.7 Audience Intelligence

**personas** — persona da audiência (Contexto da Audiência).
`id, organization_id, project_id→projects, name, demographics(jsonb), psychographics(jsonb), channels(jsonb), awareness_level(enum), language_notes(jsonb), confidence, created_at`

**pains** — dores mapeadas. `id, organization_id, persona_id→personas, description, intensity(1..5), evidence(jsonb)`

**objections** — objeções de compra. `id, organization_id, persona_id, description, counter_argument, evidence(jsonb)`

**desires** — desejos/motivações. `id, organization_id, persona_id, description, strength(1..5)`

**audience_questions** — perguntas frequentes da audiência (para pauta). `id, organization_id, persona_id, question, source, volume_hint`

**sentiment_analyses** — análise de sentimento de comentários/menções.
`id, organization_id, project_id, source, sample_size, distribution(jsonb: pos/neu/neg), themes(jsonb), created_at`

## 2.8 Editorial

**editorial_strategies** — estratégia editorial macro do projeto.
`id, organization_id, project_id→projects, positioning, pillars(jsonb), objectives(jsonb: kpis, funil), rationale, confidence, status, created_at`

**editorial_lines** — linhas editoriais (eixos de conteúdo).
`id, organization_id, strategy_id→editorial_strategies, name, objective(enum: authority|trust|educate|desire|convert|relationship), funnel_stage(enum: tofu|mofu|bofu), platforms(jsonb)`

**categories** — categorias de conteúdo dentro de uma linha.
`id, organization_id, editorial_line_id→editorial_lines, name, description, parent_id(self, p/ subcategorias)`

**themes** — temas e microtemas.
`id, organization_id, category_id→categories, title, angle, microthemes(jsonb), priority`

**content_ideas** — ideias/pautas geradas.
`id, organization_id, project_id, theme_id(nullable), title, hook_id(nullable), format(enum), funnel_stage, objective, rationale, status(enum: suggested|approved|rejected|scheduled), score(jsonb), created_by(enum: ai|user), created_at`

**contents** — peça de conteúdo (ativo editorial).
`id, organization_id, project_id, idea_id(nullable), title, platform(enum), format, status(enum: draft|in_review|approved|published|archived), body(jsonb: blocks), briefing(jsonb), created_by, assigned_to, version, created_at`

**posts** — instância publicável/agendada de um `content` por plataforma.
`id, organization_id, content_id→contents, platform, scheduled_for, published_at, external_ref, status, metrics(jsonb)`

**copies** — variações de copy (headline, corpo, CTA) de um conteúdo.
`id, organization_id, content_id(nullable), project_id, kind(enum: headline|body|cta|caption|script|ad), text, framework_id(nullable), hook_id(nullable), variant_label, score(jsonb), ai_execution_id`

**calendars** — calendário editorial de um projeto.
`id, organization_id, project_id→projects, name, timezone, view_default(enum: month|week), created_at`

**calendar_entries** — item posicionado no calendário.
`id, organization_id, calendar_id→calendars, content_id(nullable), post_id(nullable), date, time, status, platform, owner, drag_order`

**approvals** — trilha de aprovação (workflow).
`id, organization_id, subject_type(enum: content|copy|calendar|idea), subject_id, requested_by, reviewer, status(enum: pending|approved|changes_requested|rejected), comment, decided_at`

## 2.9 Library (biblioteca reutilizável)

Escopo padrão: organização (compartilhada entre projetos), com opção de escopo por marca. Itens do sistema (`is_system`) vêm no seed.

**frameworks** — frameworks de copy/estrutura (AIDA, PAS, StoryBrand…).
`id, organization_id(nullable=sistema), name, kind, structure(jsonb), when_to_use, examples(jsonb)`

**hooks** — ganchos de abertura.
`id, organization_id(nullable), text, category, emotion, platform_fit(jsonb), performance_hint`

**templates** — modelos de peça/roteiro/carrossel.
`id, organization_id(nullable), name, format, blocks(jsonb), variables(jsonb)`

**scripts** — roteiros reutilizáveis (vídeo, reels). `id, organization_id(nullable), title, structure(jsonb), duration_hint`

## 2.10 AI Orchestration

**agents** — definição lógica de um agente (identidade e papel).
`id, organization_id(nullable=sistema), key(enum: client|market|competition|persona|language|copy|seo|social|calendar|evaluator|critic|planning|orchestrator), name, description, active_version_id, config(jsonb: modelo default, tools, params), created_at`

**agent_versions** — versionamento do agente (system prompt, tools, política).
`id, organization_id, agent_id→agents, version(int), system_prompt_ref(prompt_version_id), tools(jsonb), model_policy(jsonb), changelog, created_by, created_at`
Único: `(agent_id, version)`.

**prompts** — prompt nomeado (template).
`id, organization_id(nullable=sistema), key, name, description, active_version_id, variables_schema(jsonb)`

**prompt_versions** — versão imutável de um prompt.
`id, organization_id, prompt_id→prompts, version(int), template(text), variables(jsonb), notes, validator_report(jsonb), created_by, created_at`
Único: `(prompt_id, version)`.

**orchestration_runs** — execução de um pipeline de agentes (uma "missão").
`id, organization_id, project_id→projects, kind(enum: research|strategy|editorial_line|calendar|content), status(enum: queued|running|succeeded|failed|partial), input(jsonb), output(jsonb), steps(jsonb: DAG e estados), total_cost, confidence, started_at, finished_at, triggered_by`

**ai_executions** — uma chamada de LLM (unidade de custo). **Tabela quente.**
`id, organization_id, orchestration_run_id(nullable), chat_id(nullable), agent_id(nullable), agent_version_id, prompt_version_id, provider(enum: openai|anthropic|gemini|deepseek), model, input_tokens, output_tokens, latency_ms, cost_usd, status(enum: success|error|fallback), fallback_from, cache_hit(bool), error, request_ref, response_ref, created_at`
Índices: `(organization_id, created_at)`, `(orchestration_run_id)`, `(provider, model)`. Candidata a particionamento por tempo.

**chats** — conversa interativa (assistente do usuário).
`id, organization_id, project_id(nullable), user_id, title, agent_key, context_ref(jsonb), created_at`

**chat_messages** — mensagens do chat.
`id, organization_id, chat_id→chats, role(enum: user|assistant|system|tool), content(jsonb), ai_execution_id(nullable), created_at`

**memories** — memória de longo prazo (fatos consolidados por projeto/marca).
`id, organization_id, scope(enum: org|client|brand|project), scope_id, kind(enum: fact|preference|decision|summary), content(text), embedding(vector), source_ref, confidence, expires_at, created_at`

**knowledge_bases** — base de conhecimento (RAG) por escopo.
`id, organization_id, scope(enum: org|client|brand|project), scope_id, name, description, created_at`

**knowledge_documents** — documento indexado na KB.
`id, organization_id, knowledge_base_id→knowledge_bases, file_id(nullable), title, source(enum: upload|url|briefing|research), status(enum: pending|chunked|indexed|failed), meta(jsonb), created_at`

**embeddings** — chunks vetorizados (RAG).
`id, organization_id, knowledge_document_id→knowledge_documents, chunk_index, content(text), embedding(vector(1536)), tokens, meta(jsonb)`
Índice vetorial: `ivfflat`/`hnsw` em `embedding`, filtrado por `organization_id` + `knowledge_base_id`.

## 2.11 Billing & Usage

**plans** — planos comerciais. `id, name, price_month, limits(jsonb: seats, projetos, tokens/mês, agentes), features(jsonb), is_public`

**subscriptions** — assinatura da org.
`id, organization_id→organizations, plan_id→plans, stripe_subscription_id, status(enum: trialing|active|past_due|canceled), current_period_start, current_period_end, seats, created_at`

**usage_records** — medição agregada de uso (por período).
`id, organization_id, period(date), metric(enum: ai_tokens|ai_cost|executions|active_seats|storage), value, breakdown(jsonb: por provedor/projeto)`

**invoices** — faturas. `id, organization_id, stripe_invoice_id, amount, currency, status, period_start, period_end, pdf_url`

**ai_price_book** — tabela de preços por modelo (para custear execuções).
`id, provider, model, input_price_per_1k, output_price_per_1k, currency, effective_from, effective_to`

## 2.12 Platform

**settings** — configurações por org (e defaults do sistema).
`id, organization_id(nullable=global), namespace(enum: general|ai|editorial|notifications|security), key, value(jsonb), updated_by`

**notifications** — notificações in-app.
`id, organization_id, user_id, type, title, body, data(jsonb), read_at, created_at`

**audit_logs** — trilha de auditoria (ações sensíveis).
`id, organization_id, actor_user_id, action, subject_type, subject_id, before(jsonb), after(jsonb), ip, trace_id, created_at`

**logs** — eventos técnicos relevantes persistidos (complementa o agregador externo).
`id, organization_id(nullable), level, module, message, context(jsonb), trace_id, created_at`

**reports** — relatórios gerados (performance, conteúdo, pesquisa, IA).
`id, organization_id, project_id(nullable), kind(enum: performance|content|research|ai_cost), params(jsonb), status, file_id(nullable, export), summary(jsonb), created_by, created_at`

## 2.13 Regras transversais de dados

- **Soft delete** (`deleted_at`) em entidades de negócio; hard delete apenas em cascata controlada e em rotinas de LGPD.
- **RLS**: policy por `organization_id` em todas as tabelas de negócio; a conexão do request seta `app.current_org`.
- **Índices**: `(organization_id, <coluna de filtro frequente>)` em todas as listas; FKs indexadas; índices parciais para `deleted_at IS NULL`.
- **Auditoria de custo**: `ai_executions` é imutável (append-only); correções por estorno, não update.
- **Versionamento**: `prompt_versions` e `agent_versions` são imutáveis; a entidade "pai" aponta a versão ativa.
- **JSONB validado**: campos `jsonb` têm schema Zod correspondente em `packages/contracts` — o banco guarda, a aplicação valida.
- **Chaves de IA (BYOK)**: guardadas em `settings` namespace `ai` **cifradas** (envelope encryption), nunca retornadas em claro pela API.

## 2.14 Migrations e seed

- **Migrations** via Prisma Migrate, revisadas em PR, aplicadas no pipeline antes do deploy.
- **Seed** de sistema: papéis padrão, catálogo de permissões, agentes e prompts do sistema, biblioteca base (frameworks/hooks/templates), `ai_price_book` inicial e planos.
