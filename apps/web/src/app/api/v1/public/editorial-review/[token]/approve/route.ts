import { prisma } from "@soie/db";
import { approveInput } from "@soie/contracts";
import { ok, handle, Errors } from "@/server/http";
import { appendHistory } from "@/server/production-stage";
import { materializeProductionPieces } from "@/server/production-flow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  return handle(async () => {
    const { token } = await params;
    const input = approveInput.parse(await req.json().catch(() => ({})));
    const link = await prisma.editorialReviewLink.findUnique({
      where: { token },
      include: { strategy: true },
    });
    if (!link || link.status === "revoked") throw Errors.notFound("Link");
    const s = link.strategy;
    const now = new Date();
    const authorName = input.authorName ?? "Cliente";
    // Aprovou → entra direto na Produção (Designer/Audiovisual), não numa
    // coluna "Aprovada" parada. O SOIE assume o fluxo daqui em diante.
    const history = appendHistory(s.stageHistory, {
      from: s.productionStage,
      to: "design",
      at: now.toISOString(),
      byId: null,
      byName: authorName,
      note: `Cliente aprovou a linha editorial V${s.version} — produção iniciada`,
    });

    await prisma.$transaction([
      prisma.editorialReviewComment.create({
        data: {
          organizationId: s.organizationId,
          strategyId: s.id,
          decision: "approve",
          authorName,
        },
      }),
      prisma.editorialStrategy.update({
        where: { id: s.id },
        data: {
          status: "approved",
          approvedAt: now,
          changesRequestedAt: null,
          productionStage: "design",
          stageHistory: history,
        },
      }),
      ...(s.clientId
        ? [prisma.client.update({ where: { id: s.clientId }, data: { activeStrategyId: s.id } })]
        : []),
      prisma.editorialReviewLink.update({ where: { id: link.id }, data: { status: "decided" } }),
      prisma.notification.create({
        data: {
          organizationId: s.organizationId,
          userId: link.createdBy ?? s.organizationId,
          type: "editorial_strategy_approved",
          title: `Cliente aprovou a linha editorial V${s.version} — produção iniciada`,
          data: { strategyId: s.id },
        },
      }),
    ]);

    // Cria automaticamente as peças de produção (uma por conteúdo da linha),
    // já com tema, objetivo, formato, copy, briefing e observações. Idempotente.
    await materializeProductionPieces(s.organizationId, s.id, { id: null, name: authorName }).catch(() => {});

    return ok({ status: "approved", productionStage: "design" });
  });
}
