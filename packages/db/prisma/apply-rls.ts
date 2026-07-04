import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PrismaClient } from "@prisma/client";

/** Applies the RLS policies from sql/rls.sql. Run after migrations:
 *  pnpm --filter @soie/db exec tsx prisma/apply-rls.ts */
const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(__dirname, "sql", "rls.sql"), "utf8");

const prisma = new PrismaClient();
prisma
  .$executeRawUnsafe(sql)
  .then(() => console.log("RLS policies applied."))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
