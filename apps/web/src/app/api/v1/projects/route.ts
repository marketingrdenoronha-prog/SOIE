import { z } from "zod";
import { prisma } from "@soie/db";
import { createProjectInput } from "@soie/contracts";
import { requireAuth } from "@/server/auth";
import { ok, handle, Errors } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuid = z.string().uuid();

export async function GET(req: Request) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const { searchParams } = new URL(req.url);
    const raw = searchParams.get("brandId");
    const brandId = raw && uuid.safeParse(raw).success ? raw : undefined;
    const projects = await prisma.project.findMany({
      where: { organizationId: org, ...(brandId ? { brandId } : {}) },
      orderBy: { createdAt: "desc" },
      include: { brand: { include: { client: { select: { id: true, name: true } } } } },
    });
    return ok(projects);
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const input = createProjectInput.parse(await req.json());
    // Marca precisa existir e pertencer a esta organização.
    const brand = await prisma.brand.findFirst({
      where: { id: input.brandId, organizationId: org },
      select: { id: true },
    });
    if (!brand) throw Errors.notFound("Marca");
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
