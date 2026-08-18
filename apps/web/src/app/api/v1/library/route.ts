import { prisma } from "@soie/db";
import { requireAuth } from "@/server/auth";
import { ok, handle } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Library items: system rows (organizationId = null) + this org's rows. */
export async function GET(req: Request) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const where = { OR: [{ organizationId: null }, { organizationId: org }] };
    const [frameworks, hooks, templates, scripts] = await Promise.all([
      prisma.framework.findMany({ where, orderBy: { name: "asc" } }),
      prisma.hook.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 }),
      prisma.template.findMany({ where, orderBy: { name: "asc" } }),
      prisma.script.findMany({ where, orderBy: { title: "asc" } }),
    ]);
    return ok({ frameworks, hooks, templates, scripts });
  });
}
