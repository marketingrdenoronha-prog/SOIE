import { prisma } from "@soie/db";
import { requireAuth } from "@/server/auth";
import { ok, handle } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /adjustments — a central de AJUSTES pedidos pelo cliente, separada em
 * dois tipos (nunca misturados):
 *
 *  - editorial:  ajustes da LINHA EDITORIAL (o cliente pediu mudança na
 *    estratégia/temas). Só entra a versão mais recente por cliente que ficou em
 *    "changes_requested" — quando uma nova versão é gerada, o ajuste sai daqui.
 *  - materials:  ajustes de MATERIAL PRONTO (o cliente pediu mudança numa peça
 *    já produzida). Entra toda peça com pedido de ajuste do cliente que ainda
 *    não foi reaprovada por ele.
 */
export async function GET(req: Request) {
  return handle(async () => {
    const { org } = requireAuth(req);

    const [strategies, pieces] = await Promise.all([
      prisma.editorialStrategy.findMany({
        where: { organizationId: org, status: "changes_requested" },
        orderBy: { changesRequestedAt: "desc" },
        take: 200,
        include: {
          reviewComments: { where: { decision: "request_changes" }, orderBy: { createdAt: "desc" }, take: 5 },
          project: { select: { brand: { select: { name: true, client: { select: { id: true, name: true } } } } } },
        },
      }),
      prisma.deliverable.findMany({
        where: {
          organizationId: org,
          // Só a janela acionável: peça que o cliente pediu ajuste e voltou para
          // produção. Quando o Designer reproduz (produzida+), sai daqui — o
          // ajuste foi atendido e a peça segue o fluxo normal de aprovação.
          productionStatus: "em_producao",
          comments: { some: { decision: "request_changes" } },
        },
        orderBy: { updatedAt: "desc" },
        take: 300,
        include: {
          comments: { where: { decision: "request_changes" }, orderBy: { createdAt: "desc" }, take: 3 },
          project: { select: { brand: { select: { name: true, client: { select: { id: true, name: true } } } } } },
        },
      }),
    ]);

    // Só o ajuste editorial "vivo": a versão changes_requested que ainda é a
    // mais recente do cliente (se já geraram outra versão, foi resolvido).
    const clientIds = Array.from(
      new Set(strategies.map((s) => s.clientId).filter((x): x is string => Boolean(x))),
    );
    const allVersions = clientIds.length
      ? await prisma.editorialStrategy.groupBy({
          by: ["clientId"],
          where: { organizationId: org, clientId: { in: clientIds } },
          _max: { version: true },
        })
      : [];
    const clientMax = new Map(allVersions.map((v) => [v.clientId ?? "", v._max.version ?? 0]));

    const editorial = strategies
      .filter((s) => s.clientId && s.version >= (clientMax.get(s.clientId) ?? 0))
      .map((s) => ({
        strategyId: s.id,
        version: s.version,
        positioning: s.positioning,
        clientId: s.project.brand.client?.id ?? null,
        clientName: s.project.brand.client?.name ?? s.project.brand.name,
        changesRequestedAt: s.changesRequestedAt,
        comments: s.reviewComments.map((c) => ({
          comment: c.comment,
          authorName: c.authorName,
          createdAt: c.createdAt,
        })),
      }));

    const materials = pieces.map((d) => ({
      deliverableId: d.id,
      title: d.title,
      channel: d.channel,
      type: d.type,
      productionStatus: d.productionStatus,
      clientId: d.project.brand.client?.id ?? null,
      clientName: d.project.brand.client?.name ?? d.project.brand.name,
      comments: d.comments.map((c) => ({
        comment: c.comment,
        authorName: c.authorName,
        createdAt: c.createdAt,
      })),
    }));

    return ok({ editorial, materials });
  });
}
