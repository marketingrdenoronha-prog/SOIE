import { prisma } from "@soie/db";
import { requireAuth } from "@/server/auth";
import { ok, handle } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const [deliverables, aiExecs, projects] = await Promise.all([
      prisma.deliverable.groupBy({
        by: ["status"], where: { organizationId: org }, _count: true,
      }),
      prisma.aIExecution.findMany({
        where: { organizationId: org }, orderBy: { createdAt: "desc" }, take: 20,
      }),
      prisma.project.count({ where: { organizationId: org } }),
    ]);
    const totalCost = aiExecs.reduce((s, e) => s + (e.costUsd || 0), 0);
    return ok({
      summary: { projects, totalAiCostUsd: totalCost, aiExecutionsCount: aiExecs.length },
      deliverablesByStatus: deliverables,
      recentAiExecutions: aiExecs,
    });
  });
}
