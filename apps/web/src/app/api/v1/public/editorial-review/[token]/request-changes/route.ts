import { prisma } from "@soie/db";
import { requestChangesInput } from "@soie/contracts";
import { ok, handle, Errors } from "@/server/http";
import { appendHistory } from "@/server/production-stage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  return handle(async () => {
    const { token } = await params;
    const input = requestChangesInput.parse(await req.json());
    const link = await prisma.editorialReviewLink.findUnique({
      where: { token },
      include: { strategy: true },
    });
    if (!link || link.status === "revoked") throw Errors.notFound("Link");
    const s = link.strategy;
    const authorName = input.authorName ?? "Cliente";
    // Ajuste solicitado → a Linha Editorial SAI da esteira e retorna ao módulo
    // Editorial (mesma linha, nunca outra). Ao reenviar, volta a "client_review".
    const history = appendHistory(s.stageHistory, {
      from: s.productionStage,
      to: "editorial",
      at: new Date().toISOString(),
      byId: null,
      byName: authorName,
      note: `Cliente pediu ajuste: ${input.comment}`,
    });

    await prisma.$transaction([
      prisma.editorialReviewComment.create({
        data: {
          organizationId: s.organizationId,
          strategyId: s.id,
          decision: "request_changes",
          comment: input.comment,
          authorName,
        },
      }),
      prisma.editorialStrategy.update({
        where: { id: s.id },
        data: {
          status: "changes_requested",
          changesRequestedAt: new Date(),
          productionStage: null,
          stageHistory: history,
        },
      }),
      prisma.notification.create({
        data: {
          organizationId: s.organizationId,
          userId: link.createdBy ?? s.organizationId,
          type: "editorial_strategy_changes_requested",
          title: `Cliente pediu ajuste na linha editorial V${s.version}`,
          body: input.comment.slice(0, 160),
          data: { strategyId: s.id },
        },
      }),
      // Aprendizado persistente: direção editorial rejeitada vira memória de
      // escopo do cliente — as próximas versões (e produções) nunca perdem
      // este sinal, mesmo fora da janela do editorialHistory.
      ...(s.clientId && input.comment.trim().length >= 10
        ? [prisma.memory.create({
            data: {
              organizationId: s.organizationId,
              scope: "client",
              scopeId: s.clientId,
              kind: "feedback_cliente",
              content: `Ajuste pedido pelo cliente na linha editorial V${s.version}: ${input.comment.slice(0, 500)}`,
              sourceRef: s.id,
            },
          })]
        : []),
    ]);
    return ok({ status: "changes_requested" });
  });
}
