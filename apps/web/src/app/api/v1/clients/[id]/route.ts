import { prisma } from "@soie/db";
import { requireAuth } from "@/server/auth";
import { ok, handle, Errors } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { org } = requireAuth(_req);
    const { id } = await params;
    const client = await prisma.client.findFirst({
      where: { id, organizationId: org, deletedAt: null },
      include: { brands: { include: { projects: true } } },
    });
    if (!client) throw Errors.notFound("Cliente");
    return ok(client);
  });
}
