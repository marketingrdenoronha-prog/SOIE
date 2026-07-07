import { z } from "zod";
import { prisma } from "@soie/db";
import { requireAuth } from "@/server/auth";
import { ok, handle, Errors } from "@/server/http";
import { pushPieceEvent } from "@/server/production-flow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const input = z.object({
  url: z.string().url().max(2000),
  name: z.string().max(300).optional(),
  kind: z.enum(["link", "image", "video", "file"]).optional(),
  note: z.string().max(1000).optional(),
});

/** GET: arquivos enviados da peça, versão mais recente primeiro. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { org } = requireAuth(req);
    const { id } = await params;
    const items = await prisma.deliverableAsset.findMany({
      where: { organizationId: org, deliverableId: id },
      orderBy: { version: "desc" },
    });
    return ok({ items });
  });
}

/** POST: anexa um arquivo por link. Cada envio cria uma NOVA versão,
 * preservando o histórico das anteriores. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { org, sub } = requireAuth(req);
    const { id } = await params;
    const data = input.parse(await req.json());

    const piece = await prisma.deliverable.findFirst({
      where: { id, organizationId: org },
      select: { id: true, history: true },
    });
    if (!piece) throw Errors.notFound("Peça");

    const last = await prisma.deliverableAsset.findFirst({
      where: { organizationId: org, deliverableId: id },
      orderBy: { version: "desc" },
      select: { version: true },
    });
    const version = (last?.version ?? 0) + 1;
    const user = await prisma.user.findUnique({ where: { id: sub }, select: { name: true } });

    const [asset] = await prisma.$transaction([
      prisma.deliverableAsset.create({
        data: {
          organizationId: org,
          deliverableId: id,
          version,
          kind: data.kind ?? "link",
          url: data.url,
          name: data.name ?? null,
          note: data.note ?? null,
          uploadedById: sub,
        },
      }),
      prisma.deliverable.update({
        where: { id },
        data: {
          history: pushPieceEvent(piece.history, {
            type: "asset",
            byId: sub,
            byName: user?.name ?? null,
            note: `Arquivo v${version}: ${data.name || data.url}`,
          }),
        },
      }),
    ]);
    return ok({ asset }, 201);
  });
}
