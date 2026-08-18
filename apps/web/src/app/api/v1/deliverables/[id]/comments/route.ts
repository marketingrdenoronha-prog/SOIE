import { z } from "zod";
import { prisma } from "@soie/db";
import { requireAuth } from "@/server/auth";
import { ok, handle, Errors } from "@/server/http";
import { pushPieceEvent } from "@/server/production-flow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const input = z.object({
  body: z.string().min(1).max(4000),
  role: z.enum(["cs", "designer", "audiovisual"]).optional(),
});

/** GET: fio de comentários da peça (mais antigo primeiro). */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const { id } = await params;
    const items = await prisma.deliverableComment.findMany({
      where: { organizationId: org, deliverableId: id },
      orderBy: { createdAt: "asc" },
    });
    return ok({ items });
  });
}

/** POST: adiciona comentário (comunicação CS / Designer / Audiovisual). Fica
 * registrado para sempre e também entra no histórico da peça. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { org, sub } = requireAuth(req);
    const { id } = await params;
    const { body, role } = input.parse(await req.json());

    const piece = await prisma.deliverable.findFirst({
      where: { id, organizationId: org },
      select: { id: true, history: true },
    });
    if (!piece) throw Errors.notFound("Peça");
    const user = await prisma.user.findUnique({ where: { id: sub }, select: { name: true } });

    const [comment] = await prisma.$transaction([
      prisma.deliverableComment.create({
        data: {
          organizationId: org,
          deliverableId: id,
          authorId: sub,
          authorName: user?.name ?? null,
          role: role ?? null,
          body,
        },
      }),
      prisma.deliverable.update({
        where: { id },
        data: {
          history: pushPieceEvent(piece.history, {
            type: "comment",
            byId: sub,
            byName: user?.name ?? null,
            note: body.slice(0, 160),
          }),
        },
      }),
    ]);
    return ok({ comment }, 201);
  });
}
