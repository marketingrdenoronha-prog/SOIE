# SOIE — Começando (desenvolvimento)

Monorepo da plataforma SaaS SOIE. Este documento cobre como rodar o ambiente local. A arquitetura está em [`arquitetura/`](arquitetura/) e a constituição do sistema em [`sistema/`](sistema/).

## Pré-requisitos

- Node.js ≥ 22
- pnpm ≥ 10
- Docker (para Postgres + Redis locais)

## Estrutura

```
apps/
  api/     NestJS — HTTP/REST + tenant + auth + orquestração de IA
  web/     Next.js — app shell, dashboard, módulos
packages/
  config/    env validado (Zod) + logger (pino)
  contracts/ schemas Zod compartilhados (API ↔ Web ↔ Agentes)
  db/        Prisma schema (todas as entidades) + client + seed
  ai/        AI Gateway multi-provedor, Orchestrator, AgentRunner, CostGuard
```

## Passos

```bash
# 1. Dependências
pnpm install

# 2. Variáveis de ambiente
cp .env.example .env        # ajuste segredos e chaves de IA

# 3. Infra local (Postgres 16 + pgvector, Redis)
docker compose up -d

# 4. Banco: gerar client, migrar e semear dados de sistema
pnpm db:generate
pnpm db:migrate             # cria as tabelas a partir do schema
pnpm db:seed                # papéis, 12 agentes, frameworks, price book, planos

# 5. Rodar em desenvolvimento
pnpm dev                    # sobe api (:3333) e web (:3000) via turbo
```

- API: `http://localhost:3333/api/v1` (ex.: `GET /health`, `POST /auth/register`)
- Web: `http://localhost:3000`

## Comandos úteis

```bash
pnpm typecheck              # typecheck de todos os pacotes
pnpm build                  # build de tudo (turbo)
pnpm --filter @soie/db studio   # Prisma Studio
```

## Verificação rápida do motor de IA (sem banco)

O Orchestrator roda com adapters stub, útil para exercitar o pipeline de
agentes sem chaves de IA:

```bash
cd apps/api && node <caminho-do-tsx> scripts/smoke.mts
# -> executa o pipeline "research": client → market/competition/persona →
#    language → evaluate → critique, com custo por execução.
```

## Estado atual da implementação

| Componente | Estado |
|-----------|--------|
| Monorepo, tooling, docker-compose | ✅ |
| `@soie/config`, `@soie/contracts` | ✅ typecheck limpo |
| `@soie/db` — schema Prisma completo (Fase 2) + seed | ✅ `prisma validate` OK |
| `@soie/ai` — Gateway, fallback, Orchestrator, AgentRunner, CostGuard | ✅ smoke test E2E OK |
| `apps/api` — tenant/RLS, auth (register/login), clients, ai, health | ✅ typecheck limpo |
| `apps/web` — app shell (sidebar, topbar, dark mode), dashboard, IA | ✅ typecheck limpo |
| Adapters reais de IA (OpenAI/Anthropic/Gemini/DeepSeek) | ⏳ stub → plugar SDKs |
| Workers/filas BullMQ, conectores externos, RAG/embeddings ao vivo | ⏳ próximos |
| Migração SQL de RLS + billing Stripe + WebSocket de progresso | ⏳ próximos |

Os pontos ⏳ têm as interfaces e contratos já definidos — falta a fiação com os serviços externos.
