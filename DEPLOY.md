# SOIE — Deploy

Topologia sugerida: **backend (API + worker + Postgres + Redis) no Render** e **frontend na Vercel**. Qualquer provedor com Docker + Postgres + Redis serve; os arquivos abaixo são o ponto de partida.

## Backend no Render

1. No Render, **New → Blueprint** e aponte para este repositório. Ele lê o [`render.yaml`](render.yaml) e provisiona: Postgres (`soie-db`), Redis (`soie-redis`), o serviço web `soie-api` e o worker `soie-worker`.
2. Nos dois serviços, defina os segredos marcados `sync: false`: `APP_URL` (URL do frontend na Vercel) e as chaves de IA (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `DEEPSEEK_API_KEY`) — ao menos uma.
3. As **migrações + RLS + seed rodam automaticamente** antes de cada deploy da API
   (via `preDeployCommand` no `render.yaml`). A migração inicial já cria a extensão
   `vector` (pgvector). Não é preciso rodar nada à mão.
   - Caso o provedor exija habilitar a extensão manualmente, rode uma vez no console
     do Postgres: `CREATE EXTENSION IF NOT EXISTS vector;`.

Os Dockerfiles ([`infra/Dockerfile.api`](infra/Dockerfile.api), [`infra/Dockerfile.worker`](infra/Dockerfile.worker)) são multi-stage e usam o contexto na raiz do repositório.

## Frontend na Vercel

1. **New Project** apontando para este repositório.
2. Em **Settings → Root Directory**, defina **`apps/web`** (é ajuste de projeto na
   Vercel, não vai no arquivo). A Vercel então lê [`apps/web/vercel.json`](apps/web/vercel.json),
   que roda o install e o build a partir da raiz do monorepo.
3. Em **Settings → Environment Variables**, defina `API_URL` com a URL pública da
   API no Render (ex.: `https://soie-api.onrender.com`) **antes do build** — o
   `next.config.mjs` resolve o rewrite de `/api/*` em tempo de build, então mudar
   `API_URL` depois exige um novo deploy.
4. Deploy. A URL da Vercel é o endereço público do SOIE.

## Ordem de subida

```
Postgres + Redis  →  migrate + rls + seed  →  API  →  worker  →  Web (Vercel)
```

## Alternativas

- **Fly.io / Railway**: use os mesmos Dockerfiles; provisione Postgres (com pgvector) e Redis gerenciados e replique as variáveis de ambiente do `render.yaml`.
- **Tudo em um provedor**: a Web também roda em container (`next start`) se preferir não usar a Vercel.

## Variáveis de ambiente

A referência completa está em [`.env.example`](.env.example). Essenciais em produção: `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `APP_URL`, e pelo menos uma chave de provedor de IA.
