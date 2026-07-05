import { prisma } from "@soie/db";
import { createClientInput } from "@soie/contracts";
import { requireAuth } from "@/server/auth";
import { ok, handle } from "@/server/http";
import { resolveDefaultProjectId } from "@/server/client-scope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const clients = await prisma.client.findMany({
      where: { organizationId: org, deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return ok(clients);
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const input = createClientInput.parse(await req.json());
    const client = await prisma.client.create({
      data: {
        organizationId: org,
        name: input.name,
        industry: input.industry,
        website: input.website,
        tags: input.tags,
      },
    });
    // V2: auto-provisiona Brand+Project default para que módulos internos
    // (linhas editoriais, memória, pesquisa) já tenham um escopo pronto.
    await resolveDefaultProjectId(client.id, org);
    return ok(client, 201);
  });
}
