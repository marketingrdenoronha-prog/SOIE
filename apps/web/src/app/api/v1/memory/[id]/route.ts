import { prisma } from "@soie/db";
import { z } from "zod";
import { requireAuth } from "@/server/auth";
import { ok, handle, Errors } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const updateInput = z.object({
  kind: z.string().min(1).max(60).optional(),
  content: z.string().min(1).max(4000).optional(),
});

async function ownedMemory(org: string, id: string) {
  const memory = await prisma.memory.findFirst({ where: { id, organizationId: org }, select: { id: true } });
  if (!memory) throw Errors.notFound("Memória");
  return memory;
}

/** PATCH /memory/:id → edit kind/content. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const { id } = await params;
    await ownedMemory(org, id);
    const input = updateInput.parse(await req.json());
    const memory = await prisma.memory.update({ where: { id }, data: input });
    return ok(memory);
  });
}

/** DELETE /memory/:id */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const { id } = await params;
    await ownedMemory(org, id);
    await prisma.memory.delete({ where: { id } });
    return ok({ ok: true });
  });
}
