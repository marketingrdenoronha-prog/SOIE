# SOIE — Deploy

Topologia sugerida: **backend (API + worker + Postgres + Redis) no Render** e **frontend na Vercel**. Qualquer provedor com Docker + Postgres + Redis serve; os arquivos abaixo são o ponto de partida.

## Backend no Render

1. No Render, **New → Blueprint** e aponte para este repositório. Ele lê o [`render.yaml`](render.yaml) e provisiona: Postgres (`soie-db`), Redis (`soie-redis`), o serviço web `soie-api` e o worker `soie-worker`.
2. Nos dois serviços, defina os segredos marcados `sync: false`: `APP_URL` (URL do frontend na Vercel) e as chaves de IA (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`) — ao menos uma.
3. Habilite o pgvector no banco uma vez: no console do Postgres, `CREATE EXTENSION IF NOT EXISTS vector;`.
4. Rode as migrações + RLS + seed (via Render Shell no serviço `soie-api` ou um Job):
   ```bash
   pnpm --filter @soie/db migrate:deploy
   pnpm --filter @soie/db rls
   pnpm --filter @soie/db seed
   ```

Os Dockerfiles ([`infra/Dockerfile.api`](infra/Dockerfile.api), [`infra/Dockerfile.worker`](infra/Dockerfile.worker)) são multi-stage e usam o contexto na raiz do repositório.

## Frontend na Vercel

1. **New Project** apontando para este repositório; a Vercel lê [`vercel.json`](vercel.json) (rootDirectory `apps/web`, build via pnpm no monorepo).
2. Defina a variável `API_URL` com a URL pública da API no Render (ex.: `https://soie-api.onrender.com`). O `next.config.mjs` faz o rewrite de `/api/*` para lá.
3. Deploy. A URL da Vercel é o endereço público do SOIE.

## Ordem de subida

```
Postgres + Redis  →  migrate + rls + seed  →  API  →  worker  →  Web (Vercel)
```

## Alternativas

- **Fly.io / Railway**: use os mesmos Dockerfiles; provisione Postgres (com pgvector) e Redis gerenciados e replique as variáveis de ambiente do `render.yaml`.
- **Tudo em um provedor**: a Web também roda em container (`next start`) se preferir não usar a Vercel.

## Variáveis de ambiente

A referência completa está em [`.env.example`](.env.example). Essenciais em produção: `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `APP_URL`, e pelo menos uma chave de provedor de IA.
