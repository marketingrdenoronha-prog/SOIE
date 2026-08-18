import { prisma } from "@soie/db";
import { ok } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let db = false;
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    db = true;
  } catch {
    db = false;
  }
  return ok({ status: db ? "ok" : "degraded", db });
}
