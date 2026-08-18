import { z } from "zod";
import { prisma } from "@soie/db";
import { createBrandInput } from "@soie/contracts";
import { requireAuth } from "@/server/auth";
import { ok, handle, Errors } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuid = z.string().uuid();

export async function GET(req: Request) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const { searchParams } = new URL(req.url);
    const raw = searchParams.get("clientId");
    // Ignora clientId malformado em vez de deixar o Postgres estourar (P2023).
    const clientId = raw && uuid.safeParse(raw).success ? raw : undefined;
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
    // Garante que o cliente existe e é DESTA organização (isolamento + evita
    // P2003 de FK inexistente virando 500).
    const client = await prisma.client.findFirst({
      where: { id: input.clientId, organizationId: org, deletedAt: null },
      select: { id: true },
    });
    if (!client) throw Errors.notFound("Cliente");
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
