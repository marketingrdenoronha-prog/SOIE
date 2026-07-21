import { prisma } from "@soie/db";
import { requireAuth } from "@/server/auth";
import { ok, handle } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /adjustments — a central de AJUSTES pedidos pelo cliente, separada em
 * dois tipos (nunca misturados):
 *
 *  - editorial:  ajustes da LINHA EDITORIAL, AGRUPADOS POR CLIENTE. Cada cliente
 *    com alguma versão em "changes_requested" vira UM card acionável (a versão
 *    mais recente rejeitada) + o HISTÓRICO COMPLETO de todos os pedidos de
 *    ajuste, em todas as versões — nenhum pedido some quando uma nova versão é
 *    gerada (antes, o filtro por versão máxima escondia pedidos de versões
 *    anteriores; por isso "só o primeiro" aparecia).
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
        take: 300,
        include: {
          reviewComments: { where: { decision: "request_changes" }, orderBy: { createdAt: "desc" }, take: 50 },
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
          comments: { where: { decision: "request_changes" }, orderBy: { createdAt: "desc" }, take: 20 },
          project: { select: { brand: { select: { name: true, client: { select: { id: true, name: true } } } } } },
        },
      }),
    ]);

    // Clientes com ajuste editorial em aberto.
    const clientIds = Array.from(
      new Set(strategies.map((s) => s.clientId).filter((x): x is string => Boolean(x))),
    );

    // HISTÓRICO COMPLETO: todos os pedidos de ajuste do cliente, em TODAS as
    // versões (não só na versão viva). É o que garante que nada suma — cada
    // pedido, mesmo de uma versão antiga já reajustada, fica visível.
    const historyRows = clientIds.length
      ? await prisma.editorialReviewComment.findMany({
          where: { organizationId: org, decision: "request_changes", strategy: { clientId: { in: clientIds } } },
          orderBy: { createdAt: "desc" },
          take: 1000,
          include: { strategy: { select: { clientId: true, version: true } } },
        })
      : [];
    const historyByClient = new Map<string, { version: number; comment: string | null; authorName: string | null; createdAt: Date }[]>();
    for (const r of historyRows) {
      const cid = r.strategy.clientId;
      if (!cid) continue;
      const list = historyByClient.get(cid) ?? [];
      list.push({ version: r.strategy.version, comment: r.comment, authorName: r.authorName, createdAt: r.createdAt });
      historyByClient.set(cid, list);
    }

    // Versão máxima já existente por cliente — para sinalizar quando o ajuste
    // JÁ foi atendido (uma versão mais nova foi gerada) sem esconder o card.
    const maxRows = clientIds.length
      ? await prisma.editorialStrategy.groupBy({
          by: ["clientId"],
          where: { organizationId: org, clientId: { in: clientIds } },
          _max: { version: true },
        })
      : [];
    const maxByClient = new Map(maxRows.map((r) => [r.clientId ?? "", r._max.version ?? 0]));

    // Agrupa por cliente: card acionável = a versão MAIS RECENTE em
    // changes_requested (é nela que o operador aplica o reajuste).
    const liveByClient = new Map<string, (typeof strategies)[number]>();
    for (const s of strategies) {
      if (!s.clientId) continue;
      const cur = liveByClient.get(s.clientId);
      if (!cur || s.version > cur.version) liveByClient.set(s.clientId, s);
    }

    const editorial = Array.from(liveByClient.values()).map((s) => ({
      strategyId: s.id,
      version: s.version,
      // Maior versão já existente do cliente: se > version, já foi reajustada.
      latestVersion: maxByClient.get(s.clientId!) ?? s.version,
      positioning: s.positioning,
      clientId: s.clientId,
      clientName: s.project.brand.client?.name ?? s.project.brand.name,
      changesRequestedAt: s.changesRequestedAt,
      // Pedidos na versão viva (o que o operador vai reajustar agora).
      comments: s.reviewComments.map((c) => ({
        comment: c.comment,
        authorName: c.authorName,
        createdAt: c.createdAt,
      })),
      // Histórico completo de ajustes deste cliente, em todas as versões.
      history: (historyByClient.get(s.clientId!) ?? []).map((h) => ({
        version: h.version,
        comment: h.comment,
        authorName: h.authorName,
        createdAt: h.createdAt,
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
