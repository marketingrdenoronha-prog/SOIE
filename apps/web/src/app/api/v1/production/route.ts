import { prisma } from "@soie/db";
import { requireAuth } from "@/server/auth";
import { ok, handle } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** GET /production — a Esteira de Produção da agência.
 *
 * Cada card é UMA Linha Editorial (EditorialStrategy) que já entrou na esteira
 * (productionStage != null), através de TODOS os clientes. As peças
 * (Deliverables) são subordinadas à linha e vêm embutidas para o painel lateral
 * — nunca como cards próprios. */
export async function GET(req: Request) {
  return handle(async () => {
    const { org } = requireAuth(req);

    const strategies = await prisma.editorialStrategy.findMany({
      where: { organizationId: org, productionStage: { not: null } },
      orderBy: [{ submittedAt: "desc" }, { createdAt: "desc" }],
      take: 300,
      include: {
        project: { select: { name: true, brand: { select: { name: true, client: { select: { id: true, name: true } } } } } },
        reviewLinks: { where: { status: "open" }, orderBy: { createdAt: "desc" }, take: 1 },
        reviewComments: { orderBy: { createdAt: "asc" } },
        editorialLines: {
          include: {
            categories: {
              include: {
                themes: {
                  orderBy: { priority: "asc" },
                  include: {
                    deliverable: {
                      include: {
                        reviewLinks: { orderBy: { createdAt: "desc" }, take: 1 },
                        assets: { orderBy: { version: "desc" } },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    // Resolve nomes dos responsáveis num único query.
    const userIds = Array.from(
      new Set(strategies.map((s) => s.responsibleUserId).filter((x): x is string => Boolean(x))),
    );
    const users = userIds.length
      ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } })
      : [];
    const userName = new Map(users.map((u) => [u.id, u.name]));

    const items = strategies.map((s) => {
      const themes = s.editorialLines.flatMap((l) =>
        l.categories.flatMap((c) =>
          c.themes.map((t) => ({
            id: t.id,
            title: t.title,
            channel: t.channel,
            format: t.format,
            copy: t.copy,
            microthemes: t.microthemes,
            strategicObjective: t.strategicObjective,
            hook: t.hook,
            cta: t.cta,
            productionNotes: t.productionNotes,
            deliverable: t.deliverable
              ? {
                  id: t.deliverable.id,
                  title: t.deliverable.title,
                  type: t.deliverable.type,
                  channel: t.deliverable.channel,
                  status: t.deliverable.status,
                  productionStatus: t.deliverable.productionStatus,
                  brief: t.deliverable.brief,
                  spec: t.deliverable.spec,
                  assets: t.deliverable.assets.map((a) => ({
                    id: a.id,
                    version: a.version,
                    kind: a.kind,
                    url: a.url,
                    name: a.name,
                    note: a.note,
                    createdAt: a.createdAt,
                  })),
                }
              : null,
          })),
        ),
      );
      const producedCount = themes.filter((t) => t.deliverable && t.deliverable.status !== "generating").length;

      return {
        id: s.id,
        version: s.version,
        status: s.status,
        productionStage: s.productionStage,
        positioning: s.positioning,
        clientId: s.project.brand.client?.id ?? null,
        clientName: s.project.brand.client?.name ?? s.project.brand.name,
        lineName: s.editorialLines[0]?.name ?? s.project.name,
        responsibleId: s.responsibleUserId,
        responsibleName: s.responsibleUserId ? userName.get(s.responsibleUserId) ?? null : null,
        submittedAt: s.submittedAt,
        approvedAt: s.approvedAt,
        createdAt: s.createdAt,
        token: s.reviewLinks[0]?.token ?? null,
        productionPortalToken: s.productionPortalToken ?? null,
        stageHistory: (s.stageHistory as any) ?? [],
        reviewComments: s.reviewComments.map((c) => ({
          decision: c.decision,
          comment: c.comment,
          authorName: c.authorName,
          createdAt: c.createdAt,
        })),
        piecesCount: themes.length,
        producedCount,
        pieces: themes,
      };
    });

    return ok(items);
  });
}
