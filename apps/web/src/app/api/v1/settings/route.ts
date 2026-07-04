import { prisma } from "@soie/db";
import { requireAuth } from "@/server/auth";
import { ok, handle } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Organization overview: org info, members and current plan. */
export async function GET(req: Request) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const [organization, memberships, roles] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: org },
        select: {
          id: true, name: true, slug: true, status: true, byokEnabled: true, createdAt: true,
        },
      }),
      prisma.membership.findMany({
        where: { organizationId: org },
        include: {
          user: { select: { id: true, name: true, email: true, lastLoginAt: true } },
          role: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.role.findMany({ where: { organizationId: org }, orderBy: { name: "asc" } }),
    ]);
    return ok({ organization, memberships, roles });
  });
}
