import { prisma } from "@soie/db";
import { createProjectInput } from "@soie/contracts";
import { requireAuth } from "@/server/auth";
import { ok, handle } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const { searchParams } = new URL(req.url);
    const brandId = searchParams.get("brandId") ?? undefined;
    const projects = await prisma.project.findMany({
      where: { organizationId: org, ...(brandId ? { brandId } : {}) },
      orderBy: { createdAt: "desc" },
      include: { brand: { include: { client: { select: { name: true } } } } },
    });
    return ok(projects);
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const input = createProjectInput.parse(await req.json());
    const project = await prisma.project.create({
      data: {
        organizationId: org,
        brandId: input.brandId,
        name: input.name,
        goal: input.goal,
        platforms: input.platforms,
      },
    });
    return ok(project, 201);
  });
}
