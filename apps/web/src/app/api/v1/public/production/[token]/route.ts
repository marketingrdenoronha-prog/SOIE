import { prisma } from "@soie/db";
import { ok, handle, Errors } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /public/production/:token
 * Portal público (sem login) de aprovação da produção pelo cliente: lista cada
 * peça com o conteúdo, os arquivos enviados e o estado da aprovação. */
export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  return handle(async () => {
    const { token } = await params;
    const strategy = await prisma.editorialStrategy.findFirst({
      where: { productionPortalToken: token },
      include: {
        project: { select: { brand: { select: { name: true, client: { select: { name: true } } } } } },
        editorialLines: {
          include: {
            categories: {
              include: {
                themes: {
                  orderBy: { priority: "asc" },
                  include: {
                    deliverable: {
                      include: { assets: { orderBy: { version: "desc" } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!strategy) throw Errors.notFound("Portal");

    const allThemes = strategy.editorialLines.flatMap((l) => l.categories.flatMap((c) => c.themes));

    // Só as peças PRONTAS para o cliente aparecem para aprovação. As demais
    // (ainda em produção) não são mostradas — só contadas no aviso.
    const READY = new Set(["produzida", "aprovada_interna", "aprovacao_cliente", "aprovada"]);
    const pieces = allThemes
      .filter((t) => t.deliverable && READY.has(t.deliverable.productionStatus))
      .map((t) => {
        const d = t.deliverable!;
        return {
          id: d.id,
          title: d.title,
          type: d.type,
          channel: d.channel,
          spec: d.spec,
          productionStatus: d.productionStatus,
          assets: d.assets.map((a) => ({ id: a.id, version: a.version, kind: a.kind, url: a.url, name: a.name })),
        };
      });

    return ok({
      client: strategy.project.brand.client?.name ?? strategy.project.brand.name,
      version: strategy.version,
      productionStage: strategy.productionStage,
      pieces,
      totalPieces: allThemes.length,
      readyPieces: pieces.length,
      pendingPieces: Math.max(0, allThemes.length - pieces.length),
    });
  });
}
