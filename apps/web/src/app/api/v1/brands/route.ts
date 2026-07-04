import { prisma } from "@soie/db";
import { createBrandInput } from "@soie/contracts";
import { requireAuth } from "@/server/auth";
import { ok, handle } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const { searchParams } = new URL(req.url);
    const clientId = searchParams.get("clientId") ?? undefined;
    const brands = await prisma.brand.findMany({
      where: { organizationId: org, ...(clientId ? { clientId } : {}) },
      orderBy: { createdAt: "desc" },
      include: { client: { select: { name: true } } },
    });
    return ok(brands);
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const input = createBrandInput.parse(await req.json());
    const brand = await prisma.brand.create({
      data: {
        organizationId: org,
        clientId: input.clientId,
        name: input.name,
        positioning: input.positioning,
        valueProposition: input.valueProposition,
        products: input.products,
        objectives: input.objectives,
      },
    });
    return ok(brand, 201);
  });
}
