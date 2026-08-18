# Fase 0 — Visão Geral e Decisões de Stack

## Sumário executivo

O SOIE é uma plataforma SaaS B2B em modelo de **agência inteligente**: cada empresa cliente da plataforma (uma agência, um time de marketing ou um consultor) é um **tenant** que gerencia seus próprios **clientes finais**, marcas e projetos. A plataforma orquestra dezenas de agentes de IA para executar pesquisa de mercado, inteligência de audiência, definição de DNA de marca, construção de linha editorial e produção de conteúdo — sempre com custo de IA medido, versionado e observável.

Três forças moldam toda a arquitetura:

1. **Multi-tenancy real** — centenas de clientes coexistem com isolamento lógico rígido e sem vazamento de dados entre tenants.
2. **Cargas de IA assíncronas e caras** — as execuções de agentes são longas, custam dinheiro por token e falham de formas específicas; precisam de filas, retries, fallback entre modelos e contabilidade de custo por execução.
3. **Modularidade** — cada módulo de produto (mercado, audiência, DNA, linha editorial…) e cada agente é independente e substituível.

## Princípios de arquitetura

| # | Princípio | Consequência prática |
|---|-----------|----------------------|
| 1 | **Tenant-first** | Todo dado carrega `organization_id`; toda query é escopada; Row-Level Security no Postgres como rede de segurança. |
| 2 | **IA é I/O externo caro** | Nenhuma chamada de LLM acontece no request HTTP síncrono; tudo passa por fila, com timeout, retry e teto de custo. |
| 3 | **Assíncrono por padrão** | Operações longas retornam um `job_id` e emitem eventos; o front acompanha por polling/WebSocket. |
| 4 | **Contratos explícitos** | Cada agente e cada API têm schema de entrada/saída versionado (Zod/JSON Schema). |
| 5 | **Observabilidade não é opcional** | Log estruturado + tracing distribuído + métricas desde o primeiro serviço. |
| 6 | **Custo é cidadão de primeira classe** | Cada `AIExecution` grava tokens, modelo, provedor e custo em USD; há orçamento por tenant. |
| 7 | **Segurança por padrão** | Segredos (API keys de IA dos clientes) criptografados em repouso; RBAC; auditoria. |
| 8 | **Evolutivo** | Monólito modular no início (deploy simples), com fronteiras de módulo prontas para virar serviços quando a escala exigir. |

## Topologia (alto nível)

```
                          ┌──────────────────────────┐
                          │        Web (Next.js)      │
                          │   SPA/SSR + WebSocket      │
                          └─────────────┬────────────┘
                                        │ HTTPS / WSS
                                 ┌──────▼───────┐
                                 │   API Gateway │  (rate limit, auth, tenant)
                                 └──────┬───────┘
                     ┌──────────────────┼──────────────────┐
              ┌──────▼──────┐    ┌──────▼──────┐    ┌───────▼───────┐
              │  API (Nest) │    │  AI Gateway  │    │  Realtime svc │
              │  REST/tRPC  │    │  (provedores)│    │  (WS/SSE)     │
              └──────┬──────┘    └──────┬───────┘    └───────────────┘
                     │                  │
       ┌─────────────┼──────────────────┼───────────────┐
       │             │                  │               │
 ┌─────▼─────┐ ┌─────▼─────┐     ┌──────▼──────┐  ┌──────▼──────┐
 │ PostgreSQL│ │   Redis   │     │   BullMQ     │  │  S3 / R2    │
 │ +pgvector │ │ cache/pub │     │   (filas)    │  │  arquivos   │
 └───────────┘ └───────────┘     └──────┬──────┘  └─────────────┘
                                        │
                              ┌─────────▼──────────┐
                              │   Workers (pool)    │
                              │  Orchestrator +     │
                              │  agentes de IA      │
                              └─────────┬──────────┘
                                        │
                       ┌────────────────┼────────────────┐
                 ┌─────▼─────┐   ┌──────▼──────┐   ┌──────▼──────┐
                 │  OpenAI   │   │  Anthropic  │   │Gemini/DeepSeek│
                 └───────────┘   └─────────────┘   └─────────────┘
```

- **Fontes externas de dados** (Google Trends, Reddit, redes sociais, notícias) são acessadas por **conectores** rodando nos workers, nunca no request do usuário.

## Stack tecnológica (decisões)

| Camada | Escolha | Por quê |
|--------|---------|---------|
| Monorepo | **pnpm workspaces + Turborepo** | Compartilhar tipos entre API e Web; build incremental. |
| Backend | **NestJS + TypeScript** | DI nativa, modularidade forte, casa com a estrutura de controllers/services/use-cases da Fase 7. |
| Frontend | **Next.js 14 (App Router) + React + TypeScript** | SSR para dashboards, ótimo DX, streaming de UI. |
| UI | **TailwindCSS + shadcn/ui + Radix** | Componentização rápida, acessível, dark mode nativo. |
| Estado de dados | **TanStack Query** | Cache de servidor, invalidação, polling de jobs. |
| Banco | **PostgreSQL 16 + extensão `pgvector`** | Relacional forte + embeddings no mesmo lugar (simplicidade operacional). |
| ORM | **Prisma** | Migrations, tipos gerados, produtividade. Repositórios encapsulam o Prisma (Fase 7). |
| Cache / Pub-Sub | **Redis** | Cache de leitura, locks, rate limit, canal de eventos realtime. |
| Filas | **BullMQ** (sobre Redis) | Jobs de IA, retries, backoff, prioridade, agendamento. |
| Vetores | **pgvector** (default) → **Qdrant** (em escala) | Começa simples; migra para vector DB dedicado se o volume exigir. |
| Storage | **S3-compatible (AWS S3 / Cloudflare R2)** | Uploads, exportações, documentos de briefing. |
| Busca | **Postgres FTS** → **Meilisearch** | Busca global começa no Postgres; indexador dedicado quando necessário. |
| Auth | **JWT (access+refresh) + Argon2**, OAuth opcional | Stateless, com refresh rotativo; sessão por tenant. |
| Autorização | **RBAC + escopo por tenant** (CASL) | Papéis por organização + regras por recurso. |
| Realtime | **WebSocket (Socket.IO) / SSE** | Progresso de execuções de IA e notificações. |
| Observabilidade | **pino** (logs), **OpenTelemetry** (traces), **Prometheus + Grafana** (métricas), **Sentry** (erros) | Stack aberta e padrão. |
| Infra | **Docker + Kubernetes** (ou ECS Fargate) | Escala horizontal de API e workers de forma independente. |
| IaC | **Terraform** | Ambientes reproduzíveis. |
| CI/CD | **GitHub Actions** | Lint, test, migrate, build, deploy. |
| Pagamentos | **Stripe** | Assinaturas, billing por uso, faturas. |

### Alternativas consideradas (ADRs resumidos)

- **NestJS vs. Fastify puro** → NestJS pela modularidade e DI, que reduzem acoplamento entre módulos e facilitam extrair serviços depois.
- **Prisma vs. TypeORM/Drizzle** → Prisma pela ergonomia de migrations e tipos; o acesso fica atrás de repositórios, então trocar é localizado.
- **pgvector vs. Qdrant desde o início** → pgvector reduz peças de infra no MVP; a interface de `VectorStore` (Fase 8) abstrai a troca.
- **Schema-per-tenant vs. discriminador `organization_id`** → discriminador compartilhado + RLS. Centenas de tenants com schema-per-tenant explodem migrations e conexões; o modelo compartilhado escala melhor nessa faixa.
- **Multi-provider de IA** → gateway próprio com fallback, em vez de amarrar a um SDK, porque os clientes trazem suas próprias chaves (BYOK) e o custo/latência varia por provedor.

## Modelo de tenancy (resumo)

```
Organization (TENANT / conta pagante)
   └── Users (via Memberships, com Roles)
   └── Clients (clientes finais que a org atende)
         └── Brands
               └── Projects
                     └── (Personas, Researches, Strategies, Contents, Calendars…)
```

Detalhado na [Fase 2](fase-2-banco-de-dados.md). O `organization_id` é o eixo de isolamento; `client_id`/`brand_id`/`project_id` são eixos de organização interna do tenant.

## Ambientes

`local` (docker-compose) → `staging` → `production`. Cada um com seu banco, Redis, bucket e chaves. Migrations aplicadas via pipeline. Feature flags para liberar módulos gradualmente.
