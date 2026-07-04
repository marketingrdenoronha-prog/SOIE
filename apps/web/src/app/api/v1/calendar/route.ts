import { prisma } from "@soie/db";
import { requireAuth } from "@/server/auth";
import { ok, handle } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const { searchParams } = new URL(req.url);
    const projectId = searchParams.get("projectId") ?? undefined;
    const calendars = await prisma.calendar.findMany({
      where: { organizationId: org, ...(projectId ? { projectId } : {}) },
      include: {
        entries: { orderBy: { date: "asc" } },
        project: { select: { name: true, brand: { select: { name: true } } } },
      },
      orderBy: { createdAt: "desc" },
    });
    return ok(calendars);
  });
}
