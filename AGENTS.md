# AGENTS.md

## Cursor Cloud specific instructions

Monorepo (pnpm + turbo). The user-facing product is the **Next.js app in `apps/web`**
— it serves both the UI and its own REST API (`apps/web/src/app/api/v1/**`) using
Prisma directly. `apps/api` (NestJS) and `apps/worker` (BullMQ) exist but are **not
required** to run/test the web product; the web app runs its AI/production flows
inline (with a stub fallback, so it works with or without AI keys).

### Services & how to run them
- **Postgres 16 + pgvector** and **Redis** are installed via apt (persisted in the
  VM snapshot), not Docker (Docker isn't available here). Start them each session:
  - `sudo pg_ctlcluster 16 main start`
  - `sudo redis-server --daemonize yes`
- **Web dev server** (the thing to demo): from repo root, `set -a && . ./.env && set +a`
  then `pnpm --filter @soie/web dev` → http://localhost:3000. Next.js reads
  `apps/web/.env` (a symlink to the root `.env`).
- Standard scripts live in `package.json` / `GETTING_STARTED.md` (`pnpm dev`,
  `pnpm typecheck`, `pnpm build`, `pnpm db:migrate`, `pnpm db:seed`). Lint is a
  no-op (`echo 'no lint'`) in every package.

### Database setup (first time / fresh DB)
- App DB role is `soie` / `soie`, DB `soie` (see `.env` `DATABASE_URL`).
- RLS is **FORCE**d on tenant tables (`packages/db/prisma/sql/rls.sql`). Registration
  creates an org + rows in the same transaction **without** setting `app.current_org`,
  so the app's connecting role must bypass RLS (as it effectively does on Neon/Render).
  Locally: `ALTER ROLE soie BYPASSRLS;` — otherwise `POST /auth/register` fails with
  a `roles`/`memberships` RLS violation. The app still scopes every query by
  `organizationId` in code.
- Apply schema + policies + seed:
  `pnpm --filter @soie/db migrate:deploy` · `pnpm --filter @soie/db rls` · `pnpm --filter @soie/db seed`
- `prisma/seed-demo-esteira.ts` seeds a demo Produção board (editorial lines across
  all 5 Kanban columns) for manual testing.

### Non-obvious gotchas
- **`next dev` + workspace packages:** in dev, Next resolves the packages'
  `development` export condition to their **TS source**, whose ESM imports use
  explicit `.js` extensions. `apps/web/next.config.mjs` adds a webpack
  `resolve.extensionAlias` mapping `.js`→`.ts`; without it `next dev` throws
  "Module not found: ./client.js". (Production build uses the built `dist`, so it's
  a dev-only concern.)
- After changing the Prisma schema / running `pnpm db:generate`, **restart the web
  dev server** — the running Next process caches the generated Prisma client and
  otherwise reports "Unknown field ..." for new columns.
- Never run `next build` with `NODE_ENV=development` exported (e.g. from sourcing
  `.env`); it breaks the `/404` prerender. Let `next build` set `NODE_ENV=production`.

### Produção esteira (Linha Editorial lifecycle)
- The **Produção** tab (`/production`) is a Kanban where **each card is one Linha
  Editorial** (`EditorialStrategy`), not an individual peça. Peças (`Deliverable`)
  are subordinate and shown inside the card's side panel.
- Columns map to `EditorialStrategy.productionStage`:
  `client_review → approved → design → final_review → to_post`. Movements are logged
  append-only in `EditorialStrategy.stageHistory` (never deleted).
- A line enters the esteira via **"Enviar para Cliente"** (`POST /editorial-strategies/:id/submit`).
  Client decision routes (`/public/editorial-review/:token/{approve,request-changes}`)
  move it to `approved` or back out to the Editorial module. Operator moves use
  `POST /editorial-strategies/:id/stage` (allowed transitions in
  `apps/web/src/server/production-stage.ts`).

### Editorial output (pronto para produção)
- The Linha Editorial is generated **ready-to-produce**: only 4 formats (Vídeo,
  Motion, Carrossel, Estático — see `apps/web/src/lib/editorial-format.ts`), the
  user picks a quantity per format, and each content carries tema, objetivo
  estratégico, gancho, copy completa (structured per format), CTA e observações
  de produção. Coercion/validation + the demo generator live in
  `apps/web/src/server/editorial-content.ts`.
- **Without an AI key the demo generator (`apps/web/src/server/ai-demo.ts`,
  `planning` case) is what actually runs** — keep it in sync with the real model
  contract in `packages/ai/src/orchestrator/agent-prompts.ts` (`planning`) and the
  `OUTPUT_SCHEMA` in `apps/web/src/server/ai-runtime.ts` whenever the output shape
  changes, or the demo output and the real output will diverge.
