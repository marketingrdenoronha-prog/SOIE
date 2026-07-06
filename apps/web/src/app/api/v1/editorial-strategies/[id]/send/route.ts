import { z } from "zod";
import { prisma } from "@soie/db";
import { requireAuth } from "@/server/auth";
import { ok, handle, Errors } from "@/server/http";
import { appendHistory } from "@/server/production-stage";
import { buildContentSnapshot, countContents } from "@/server/editorial-stock";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const sendInput = z.object({
  // Forma de envio — não altera o funcionamento do estoque, só é registrada.
  method: z.enum(["message", "document"]),
  // Competência que a linha cobre (ex.: "2026-07"). Default: mês corrente.
  competencia: z.string().max(40).optional(),
});

/** Competência padrão: mês corrente no formato AAAA-MM. */
function currentCompetencia(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * POST /editorial-strategies/:id/send — envia a Linha Editorial ao cliente
 * (mensagem ou documento) e a registra AUTOMATICAMENTE no Estoque Editorial.
 *
 * Regra de entrada no estoque: a linha precisa estar Finalizada + Aprovada.
 * Rascunho / cancelada / reprovada NUNCA entram. O documento exato enviado é
 * congelado em contentSnapshot e preservado para sempre.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { org, sub } = requireAuth(req);
    const { id } = await params;
    const input = sendInput.parse(await req.json().catch(() => ({})));

    const strategy = await prisma.editorialStrategy.findFirst({
      where: { id, organizationId: org },
      include: {
        editorialLines: { include: { categories: { include: { themes: true } } } },
      },
    });
    if (!strategy) throw Errors.notFound("Linha editorial");
    if (strategy.status !== "approved") {
      throw Errors.badRequest(
        "Só é possível enviar (e arquivar no Estoque Editorial) uma linha Finalizada e Aprovada pelo cliente.",
      );
    }

    const now = new Date();
    const competencia = input.competencia?.trim() || strategy.competencia || currentCompetencia(now);
    // Congela o documento apenas no primeiro envio — reenvios preservam o
    // acervo original (o que o cliente recebeu não muda), só atualizam a forma.
    const snapshot = strategy.contentSnapshot ?? buildContentSnapshot(strategy, now);
    const contentCount = strategy.contentCount || countContents(strategy);

    const user = await prisma.user.findUnique({ where: { id: sub }, select: { name: true } });
    const history = appendHistory(strategy.stageHistory, {
      from: strategy.productionStage,
      to: strategy.productionStage ?? "approved",
      at: now.toISOString(),
      byId: sub,
      byName: user?.name ?? null,
      note: `Enviada ao cliente por ${input.method === "message" ? "mensagem" : "documento"} e arquivada no Estoque Editorial`,
    });

    const updated = await prisma.editorialStrategy.update({
      where: { id: strategy.id },
      data: {
        inStock: true,
        deliveryMethod: input.method,
        sentAt: now,
        competencia,
        contentSnapshot: snapshot as object,
        contentCount,
        stageHistory: history,
      },
      select: {
        id: true, version: true, competencia: true, inStock: true,
        deliveryMethod: true, sentAt: true, approvedAt: true, contentCount: true, status: true,
      },
    });

    return ok({ stock: updated }, 201);
  });
}
