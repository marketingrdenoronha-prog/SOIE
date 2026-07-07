#!/usr/bin/env node
// Vercel build for @soie/web. Kept as a script because vercel.json's
// buildCommand has a 256-char limit and the logic doesn't fit inline:
// 1. Prisma client (always).
// 2. Migrate + seed against Neon IF DATABASE_URL is set — skipped on the very
//    first deploy so the site can go live before the DB is configured.
// 3. Next build via turbo.
import { spawnSync } from "node:child_process";

function run(cmd, args) {
  console.log(`▸ ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, { stdio: "inherit", env: process.env });
  if (r.status !== 0) process.exit(r.status ?? 1);
}

run("pnpm", ["--filter", "@soie/db", "generate"]);

if (process.env.DATABASE_URL) {
  console.log("► DATABASE_URL set — running migrate:deploy + seed + V2 backfill");
  run("pnpm", ["--filter", "@soie/db", "migrate:deploy"]);
  run("pnpm", ["--filter", "@soie/db", "seed"]);
  // V2 Fase 1: garante Brand+Project default para clientes legado. Idempotente.
  run("pnpm", ["--filter", "@soie/db", "seed:v2"]);
  // Reset one-shot de senha (temporário — removido no commit seguinte).
  run("pnpm", ["--filter", "@soie/db", "seed:reset"]);
} else {
  console.log("► DATABASE_URL not set — skipping migrate/seed (site builds anyway)");
}

run("pnpm", ["exec", "turbo", "run", "build", "--filter=@soie/web"]);
