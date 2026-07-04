# SOIE — Deploy

Há dois caminhos:

- **Grátis (recomendado)** — tudo na Vercel + Neon, sem cartão. O backend roda como
  rotas de API dentro do próprio Next.js (serverless) e o Postgres fica no Neon. Não
  precisa de Render, Redis nem worker (a geração de IA roda na hora). Ver logo abaixo.
- **Container (Render/Docker)** — API NestJS + worker + Postgres + Redis, para escala
  e processamento assíncrono. Ver a seção "Backend em container" mais abaixo.

---

## Grátis: Vercel + Neon (sem cartão)

### 1. Banco no Neon
1. Crie uma conta em https://neon.tech (grátis, sem cartão) e um **projeto**.
2. Copie a **connection string** (formato `postgresql://...neon.tech/...?sslmode=require`).
3. O pgvector é criado pela migração automaticamente; se o Neon pedir, rode uma vez no
   SQL editor: `CREATE EXTENSION IF NOT EXISTS vector;`.

### 2. App na Vercel
1. No projeto **soie-web** (Root Directory = `apps/web`), em **Settings → Environment
   Variables**, adicione:
   - **`DATABASE_URL`** = a connection string do Neon.
   - **`JWT_ACCESS_SECRET`** e **`JWT_REFRESH_SECRET`** = qualquer texto longo aleatório.
   - *(opcional)* **`ANTHROPIC_API_KEY`** (ou OpenAI/Gemini) para roteiros de IA reais;
     sem chave, sai um roteiro de exemplo (modo demonstração).
2. **Redeploy**. No build, a Vercel roda a migração e o seed no Neon automaticamente
   (via `buildCommand` do `apps/web/vercel.json`) e publica o site + as rotas de API.
3. Pronto: abra a URL da Vercel → **Criar conta** → **Entregas** → gere um roteiro →
   copie o **link do cliente** → aprove/peça ajuste.

Não há CORS nem `API_URL`: o front e a API são a mesma origem (`/api/v1/...`).

---

## Backend em container (Render/Docker)

Topologia: **backend (API + worker + Postgres + Redis) no Render** e **frontend na
Vercel**. Qualquer provedor com Docker + Postgres + Redis serve; os arquivos abaixo são
o ponto de partida. (Neste modo, defina `REDIS_URL` para ativar as filas + worker.)

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
