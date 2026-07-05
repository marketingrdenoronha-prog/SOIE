import { z } from "zod";
import { prisma } from "@soie/db";
import { requireAuth } from "@/server/auth";
import { ok, handle, Errors } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function ownedClient(org: string, id: string) {
  const client = await prisma.client.findFirst({
    where: { id, organizationId: org, deletedAt: null },
    select: { id: true },
  });
  if (!client) throw Errors.notFound("Cliente");
  return client;
}

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

const patchBody = z.object({
  name: z.string().min(1).max(200).optional(),
  industry: z.string().max(200).nullish(),
  website: z.string().max(500).nullish(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const { id } = await params;
    await ownedClient(org, id);
    const input = patchBody.parse(await req.json());
    const client = await prisma.client.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.industry !== undefined ? { industry: input.industry } : {}),
        ...(input.website !== undefined ? { website: input.website } : {}),
      },
    });
    return ok(client);
  });
}

/** Soft-delete (archive): sets deletedAt so it disappears from lists but the
 * history (brands, projects, deliverables) is preserved. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const { id } = await params;
    await ownedClient(org, id);
    await prisma.client.update({ where: { id }, data: { deletedAt: new Date() } });
    return ok({ ok: true });
  });
}
