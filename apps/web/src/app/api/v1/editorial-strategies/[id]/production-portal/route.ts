import { randomBytes } from "node:crypto";
import { prisma } from "@soie/db";
import { requireAuth } from "@/server/auth";
import { ok, handle, Errors } from "@/server/http";
import { collectPieces } from "@/server/production-flow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /editorial-strategies/:id/production-portal
 * Gera (ou reusa) o link público das peças produzidas para o cliente aprovar.
 *
 * Diferente do fluxo automático (openClientPortalIfReady), que só abre o portal
 * quando TODAS as peças passam na revisão interna, este endpoint é disparado
 * pelo Designer/CS quando quiser enviar o que já está produzido. Qualquer peça
 * já aprovada internamente é movida para "aprovacao_cliente" e o token é
 * garantido. Idempotente: chamar de novo devolve o mesmo token.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { org, sub } = requireAuth(req);
    const { id } = await params;

    const strategy = await prisma.editorialStrategy.findFirst({
      where: { id, organizationId: org },
      select: { id: true, version: true, productionPortalToken: true },
    });
    if (!strategy) throw Errors.notFound("Linha editorial");

    const pieces = await collectPieces(org, id);
    if (pieces.length === 0) {
      throw Errors.badRequest("Esta linha ainda não tem peças. Inicie a produção antes de gerar o link.");
    }

    // Exige ao menos uma peça já produzida (com arte/roteiro pronto) para o
    // cliente ter o que aprovar — link vazio não faz sentido.
    const readyStatuses = new Set(["produzida", "aprovada_interna", "aprovacao_cliente", "aprovada"]);
    const readyCount = pieces.filter((p) => readyStatuses.has(p.productionStatus)).length;
    if (readyCount === 0) {
      throw Errors.badRequest(
        "Nenhuma peça produzida ainda. Marque as peças como produzidas (e aprovadas internamente) antes de gerar o link.",
      );
    }

    const token = strategy.productionPortalToken ?? randomBytes(24).toString("base64url");
    const user = await prisma.user.findUnique({ where: { id: sub }, select: { name: true } });

    await prisma.$transaction([
      prisma.editorialStrategy.update({
        where: { id: strategy.id },
        data: { productionPortalToken: token },
      }),
      // Peças aprovadas internamente vão para a fila de aprovação do cliente.
      prisma.deliverable.updateMany({
        where: {
          id: { in: pieces.map((p) => p.id) },
          productionStatus: "aprovada_interna",
        },
        data: { productionStatus: "aprovacao_cliente" },
      }),
      prisma.notification.create({
        data: {
          organizationId: org,
          userId: sub,
          type: "production_client_portal_ready",
          title: `Link de produção gerado — linha editorial V${strategy.version}`,
          body: `${readyCount} peça(s) prontas para aprovação do cliente.`,
          data: { strategyId: strategy.id, token, by: user?.name ?? null },
        },
      }),
    ]);

    return ok({ token, readyCount, totalPieces: pieces.length }, 201);
  });
}
