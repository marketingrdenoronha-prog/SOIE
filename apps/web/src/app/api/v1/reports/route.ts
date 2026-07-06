import { prisma } from "@soie/db";
import { requireAuth } from "@/server/auth";
import { ok, handle } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const [deliverables, aiExecs, aiTotals, projects] = await Promise.all([
      prisma.deliverable.groupBy({
        by: ["status"], where: { organizationId: org }, _count: true,
      }),
      prisma.aIExecution.findMany({
        where: { organizationId: org }, orderBy: { createdAt: "desc" }, take: 20,
      }),
      // Totais agregados no Postgres — somar só as 20 rows recentes reportava
      // um custo financeiro errado assim que a org passava de 20 execuções.
      prisma.aIExecution.aggregate({
        where: { organizationId: org },
        _sum: { costUsd: true },
        _count: true,
      }),
      prisma.project.count({ where: { organizationId: org } }),
    ]);
    return ok({
      summary: {
        projects,
        totalAiCostUsd: aiTotals._sum.costUsd ?? 0,
        aiExecutionsCount: aiTotals._count,
      },
      deliverablesByStatus: deliverables,
      recentAiExecutions: aiExecs,
    });
  });
}
