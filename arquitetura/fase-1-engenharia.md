# Fase 1 — Engenharia do Sistema

Arquitetura completa do SOIE. Este documento define **como o sistema é construído e opera**; a organização do código está na [Fase 7](fase-7-backend.md), o dado na [Fase 2](fase-2-banco-de-dados.md) e a IA na [Fase 8](fase-8-ia.md).

## 1.1 Arquitetura completa

O SOIE nasce como um **monólito modular** deployado como poucos processos, mas com fronteiras internas rígidas por módulo (bounded contexts). Cada módulo pode virar um serviço independente sem reescrita quando a escala exigir.

Processos executáveis (deployables):

| Processo | Responsabilidade | Escala |
|----------|------------------|--------|
| `api` | HTTP/REST + WebSocket gateway, auth, CRUD, orquestração de jobs | Horizontal (stateless) |
| `worker` | Executa jobs das filas: agentes de IA, conectores, exportações, e-mails | Horizontal por tipo de fila |
| `scheduler` | Cron jobs (pesquisas recorrentes, agregação de custos, limpeza) | 1 líder (lock) |
| `realtime` | Fan-out de eventos via WS/SSE (pode viver dentro do `api` no início) | Horizontal + Redis pub/sub |

Todos compartilham o mesmo código-base (monorepo) e as mesmas bibliotecas de domínio, mas cada um sobe com um _entrypoint_ diferente.

### Bounded contexts (módulos de domínio)

1. **Identity & Access** — orgs, usuários, membros, papéis, sessões, API keys.
2. **Client Management** — clientes finais, marcas, projetos, briefings, uploads.
3. **Market Intelligence** — pesquisa, concorrentes, tendências, notícias, conectores externos.
4. **Audience Intelligence** — personas, dores, objeções, sentimento, linguagem.
5. **Brand DNA** — tom de voz, vocabulário, arquétipos, formalidade.
6. **Editorial** — linha editorial, categorias, temas, calendário, conteúdos, copies.
7. **Library** — frameworks, hooks, templates, scripts reutilizáveis.
8. **AI Orchestration** — orquestrador, agentes, execuções, prompts, memória, RAG.
9. **Billing & Usage** — planos, assinaturas, medição de uso, faturamento.
10. **Platform** — logs, auditoria, notificações, settings, observabilidade.

## 1.2 Backend

- **Runtime:** Node.js LTS + TypeScript, framework **NestJS**.
- **Estilo:** camadas Controller → Use Case → Service → Repository (detalhe na Fase 7).
- **APIs:** REST versionada (`/api/v1`) para clientes externos; **tRPC** opcional para o front interno (tipos ponta a ponta). WebSocket para tempo real.
- **Validação:** Zod nos limites (DTOs de entrada e saída de agentes).
- **Idempotência:** endpoints que disparam jobs aceitam `Idempotency-Key`.
- **Contrato assíncrono:** `POST /projects/:id/research` → `202 Accepted { jobId }`; progresso via `GET /jobs/:id` e/ou WS.

## 1.3 Frontend

- **Next.js 14 (App Router)**, React, TypeScript, Tailwind, shadcn/ui.
- **Camadas de dados:** TanStack Query (server state) + Zustand (UI state local).
- **Autenticação:** cookie httpOnly com refresh; contexto de tenant carregado no layout.
- **Tempo real:** hook `useJob(jobId)` que assina WS e cai para polling.
- **Renderização:** SSR para dashboards e listas; client components para editores (calendário drag-and-drop, chat de IA).
- Detalhes de navegação e componentes na [Fase 6](fase-6-ux.md).

## 1.4 Banco de dados

- **PostgreSQL 16** como fonte de verdade transacional, com **`pgvector`** para embeddings.
- **Multi-tenant** por discriminador `organization_id` + **Row-Level Security** como rede de segurança.
- **Migrations** versionadas (Prisma Migrate), aplicadas no pipeline antes do deploy.
- **Read replicas** para relatórios/dashboards pesados quando necessário.
- Modelo completo na [Fase 2](fase-2-banco-de-dados.md).

## 1.5 APIs

| Grupo | Exemplos | Auth |
|-------|----------|------|
| Auth | `POST /auth/login`, `/auth/refresh`, `/auth/invite/accept` | público / token |
| Orgs & membros | `GET/POST /orgs`, `/orgs/:id/members`, `/roles` | JWT + RBAC |
| Clientes/Marcas | `/clients`, `/clients/:id/brands`, `/brands/:id/projects` | JWT + escopo |
| Inteligência | `POST /projects/:id/research`, `/market/competitors`, `/audience/personas` | JWT + job |
| Editorial | `/editorial/lines`, `/calendars`, `/contents`, `/copies` | JWT + escopo |
| IA | `/ai/agents`, `/ai/executions`, `/ai/prompts`, `POST /ai/chat` | JWT + custo |
| Billing | `/billing/subscription`, `/billing/usage`, webhooks Stripe | JWT / webhook |
| Webhooks | entrada de provedores externos, assinados | HMAC |

- **Versionamento:** prefixo `/api/v1`; mudanças quebráveis sobem `/v2`.
- **Rate limiting:** por tenant e por usuário (Redis token bucket).
- **Paginação:** cursor-based nas listas grandes.
- **Erros:** envelope padrão `{ error: { code, message, details, traceId } }`.

## 1.6 Estrutura de pastas (monorepo)

```
soie/
├── apps/
│   ├── api/              # NestJS: HTTP + WS + entrypoint dos workers
│   │   └── src/modules/  # um módulo por bounded context
│   ├── web/              # Next.js
│   └── worker/           # entrypoint de workers (reusa libs de domínio)
├── packages/
│   ├── domain/           # entities, value objects, regras puras
│   ├── contracts/        # schemas Zod / tipos de API e de agentes
│   ├── ai/               # AI Gateway, agentes, orchestrator, RAG
│   ├── db/               # Prisma schema, migrations, repositórios base
│   ├── ui/               # design system compartilhado
│   └── config/           # env, logger, telemetry
├── infra/                # Terraform, k8s manifests, docker-compose
└── arquitetura/          # esta documentação
```

A estrutura interna de cada módulo do backend está detalhada na [Fase 7](fase-7-backend.md).

## 1.7 Serviços

Serviços de domínio (dentro do backend) e serviços de plataforma (cross-cutting):

- **Domínio:** `ClientService`, `PersonaService`, `EditorialLineService`, `CalendarService`, `ContentService`, etc.
- **Plataforma:** `AuthService`, `RbacService`, `NotificationService`, `AuditService`, `BillingService`, `UsageMeteringService`, `SecretsService`.
- **IA:** `OrchestratorService`, `AgentRunnerService`, `PromptService`, `MemoryService`, `RagService`, `AIGateway`, `CostGuardService` (ver Fase 8).

## 1.8 Workers

Workers consomem filas e executam trabalho pesado/assíncrono:

| Worker | Fila | Tarefa |
|--------|------|--------|
| `ai-orchestration` | `ai:orchestrate` | Roda pipelines de agentes de um projeto |
| `ai-agent` | `ai:agent` | Executa um agente único (chamada de LLM + tools) |
| `connector` | `connect:*` | Coleta dados externos (Trends, Reddit, social, notícias) |
| `embedding` | `ai:embed` | Gera embeddings e indexa no vector store |
| `export` | `export` | Gera PDF/CSV/decks de relatórios e calendários |
| `email` | `email` | Envia transacionais e digests |
| `billing` | `billing` | Agrega uso, sincroniza Stripe |

- **Concorrência** configurável por fila; workers escalam por tipo de carga.
- **Isolamento de falha:** um agente que falha não derruba o pipeline; o orquestrador decide retry/fallback.

## 1.9 Filas

- **BullMQ** sobre Redis. Uma fila por natureza de trabalho (acima).
- **Prioridades:** interativo (chat/IA sob demanda) > pipelines de projeto > jobs em lote/cron.
- **Retry:** backoff exponencial; número de tentativas por tipo de job.
- **Dead-letter queue** para jobs que esgotam retries → alerta + inspeção manual.
- **Idempotência:** `jobId` determinístico quando aplicável para evitar duplicação.
- **Rate limit por provedor de IA** na saída (respeitar limites de OpenAI/Anthropic/etc.).

## 1.10 Cache

Camadas de cache com Redis:

1. **Cache de leitura** de dados quentes (perfis de marca, personas, settings) com invalidação por evento.
2. **Cache de resposta de IA** por hash de (prompt + modelo + params) → economiza custo em execuções repetidas (Fase 8).
3. **Cache de conectores externos** (Trends, notícias) com TTL, respeitando ToS das fontes.
4. **Locks distribuídos** (Redlock) para scheduler e para evitar execuções concorrentes do mesmo pipeline.
5. **Rate limit / token bucket** por tenant.

## 1.11 Autenticação

- **JWT** com _access token_ curto (15 min) + _refresh token_ rotativo (persistido, revogável).
- Senhas com **Argon2id**; suporte a **OAuth** (Google) e **magic link** de convite.
- **MFA** (TOTP) opcional por organização.
- Cada token carrega `sub` (user), `org` (tenant ativo) e `roles`. Trocar de organização reemite o token com o novo escopo.
- **API keys** de plataforma (para integrações do cliente) com escopo e expiração, hasheadas.

## 1.12 Permissões

- **RBAC** com papéis por organização: `owner`, `admin`, `strategist`, `editor`, `viewer` (customizáveis).
- **Autorização por recurso** com CASL: regras do tipo _"editor pode editar Content do próprio project"_.
- **Escopo de tenant** aplicado em toda query (middleware + RLS).
- **Escopo por cliente/marca:** membros podem ser restritos a um subconjunto de clientes.
- Toda ação sensível gera registro de **auditoria** (quem, o quê, quando, tenant).

## 1.13 Multiempresa (multi-tenancy)

- **Modelo:** banco e schema compartilhados; discriminador `organization_id` em todas as tabelas de negócio.
- **Isolamento em profundidade:**
  1. Camada de aplicação — `TenantContext` injetado por request; repositórios exigem `organization_id`.
  2. Banco — **Row-Level Security** com policy por `organization_id` (a sessão do Postgres recebe o tenant atual). Mesmo um bug de aplicação não vaza entre tenants.
- **Recursos por tenant:** cotas de uso de IA, planos, chaves de IA próprias (BYOK), feature flags, branding.
- **Onboarding de tenant:** criação de org → seed de papéis, biblioteca base e settings padrão.

## 1.14 Multiusuário

- Usuário pode pertencer a **várias organizações** (via `Membership`).
- Colaboração: comentários, atribuição de tarefas, status de aprovação em conteúdos.
- Presença/edição concorrente controlada (locks otimistas + aviso de edição simultânea).
- Convites por e-mail com papel pré-definido.

## 1.15 Logs

- **Log estruturado (JSON)** com `pino`: cada linha carrega `traceId`, `organizationId`, `userId`, `module`, `jobId`.
- **Níveis:** `debug` (dev), `info`, `warn`, `error`.
- **Log de negócio ≠ log técnico:** eventos de negócio relevantes viram registros de **auditoria** persistidos no banco; logs técnicos vão para o agregador (Loki/CloudWatch).
- **Sem PII sensível** nem segredos em log; redaction automático de campos marcados.
- **Retenção** configurável; logs de auditoria têm retenção maior.

## 1.16 Observabilidade

Três pilares:

1. **Logs** — agregados (Loki/CloudWatch/ELK), pesquisáveis por `traceId`.
2. **Traces** — **OpenTelemetry** cobrindo request HTTP → job na fila → chamadas de LLM/DB, com propagação de contexto.
3. **Métricas** — **Prometheus + Grafana**: latência de API, profundidade de fila, taxa de erro de agentes, tokens/min por provedor, custo/hora, jobs por estado.

Complementos: **Sentry** para exceções com contexto; **health checks** (`/health`, `/ready`); **dashboards** por módulo e alertas (fila crescendo, erro de provedor de IA, custo acima do orçamento, DLQ não vazia).

## 1.17 Custos de IA

Peça central do produto. Ver detalhamento na [Fase 8](fase-8-ia.md).

- Cada chamada de LLM vira uma linha em **`AIExecution`** com: provedor, modelo, tokens de entrada/saída, latência, custo estimado em USD, `agent`, `promptVersion`, projeto, tenant e status.
- **Tabela de preços por modelo/provedor** versionada calcula o custo.
- **Medição de uso (`Usage`)** agrega por tenant/período para faturamento e cotas.
- **CostGuard:** orçamento por tenant/projeto; ao aproximar do limite → avisa; ao estourar → bloqueia ou exige aprovação.
- **Otimizações:** cache de respostas, escolha de modelo por tarefa (roteamento custo/qualidade), truncagem de contexto via RAG, batelamento de embeddings.
- **BYOK:** quando o cliente usa a própria chave, o custo é dele; a plataforma ainda mede tokens para relatórios.

## 1.18 Segurança

- **Segredos:** chaves de IA dos clientes criptografadas em repouso (envelope encryption, KMS); nunca em log, nunca no front.
- **Transporte:** TLS everywhere; HSTS.
- **Isolamento de tenant:** RLS + escopo de aplicação (1.13).
- **Autorização:** RBAC + regras por recurso (1.12).
- **Input:** validação Zod, sanitização, proteção contra **prompt injection** em conteúdo vindo de fontes externas (conteúdo externo é tratado como não confiável e delimitado ao alimentar agentes).
- **Rate limiting** e proteção contra abuso; WAF na borda.
- **Auditoria** de ações sensíveis; **least privilege** em credenciais de infra.
- **Compliance:** LGPD/GDPR — direito a exclusão, exportação de dados, DPA; dados por região se necessário.
- **Dependências:** SCA (auditoria de libs), Dependabot, scanning de secrets no CI.

## 1.19 Escalabilidade

- **Stateless API** → escala horizontal atrás de load balancer.
- **Workers escalam por tipo de fila** de forma independente (o gargalo de IA não afeta CRUD).
- **Banco:** índices por `organization_id` + colunas de acesso; read replicas para leitura pesada; particionamento futuro de tabelas quentes (`ai_executions`, `logs`) por tempo/tenant.
- **Redis** em cluster; filas particionadas por prioridade.
- **Vetores:** pgvector no início → Qdrant/serviço dedicado quando o índice crescer.
- **Backpressure:** limites de concorrência por provedor de IA e por tenant evitam esgotar cotas.
- **Autoscaling** por profundidade de fila e uso de CPU.
- **Caminho evolutivo:** os bounded contexts já são fronteiras; extrair `AI Orchestration` ou `Market Intelligence` como serviço é uma mudança de deploy, não de arquitetura.

## 1.20 Resiliência

- **Retries com backoff** e **circuit breaker** por provedor de IA.
- **Fallback entre modelos** (Fase 8): se OpenAI falha/estoura limite, cai para Anthropic/Gemini conforme política.
- **Timeouts** em toda chamada externa.
- **DLQ** + alertas para trabalho não processável.
- **Degradação graciosa:** se um conector externo cai, o pipeline segue com os dados disponíveis e sinaliza baixa confiança (alinhado ao Princípio 8 da Constituição).
- **Backups** automáticos do Postgres (PITR) e do storage; testes de restauração.
