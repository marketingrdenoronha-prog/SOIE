import { prisma } from "@soie/db";
import { requireAuth } from "@/server/auth";
import { ok, handle } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const url = new URL(req.url);
    const projectId = url.searchParams.get("projectId") ?? undefined;
    const deliverables = await prisma.deliverable.findMany({
      where: { organizationId: org, ...(projectId ? { projectId } : {}) },
      orderBy: { createdAt: "desc" },
      take: 200,
      include: { comments: { orderBy: { createdAt: "desc" } }, reviewLinks: true },
    });
    return ok(deliverables);
  });
}
