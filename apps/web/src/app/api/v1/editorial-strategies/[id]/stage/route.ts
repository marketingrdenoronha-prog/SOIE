import { prisma } from "@soie/db";
import { z } from "zod";
import { requireAuth } from "@/server/auth";
import { ok, handle, Errors } from "@/server/http";
import { PRODUCTION_STAGES, canMove, appendHistory, STAGE_LABELS } from "@/server/production-stage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const input = z.object({
  stage: z.enum(PRODUCTION_STAGES),
  note: z.string().max(1000).optional(),
});

/** POST /editorial-strategies/:id/stage
 * Move a Linha Editorial entre as colunas OPERACIONAIS da esteira de Produção
 * (Aprovada → Designer/Audiovisual → Em Aprovação Final → A Postar, com retorno
 * de Aprovação Final para Designer). As entradas do cliente (client_review /
 * approved / devolução por ajuste) não passam por aqui — têm rotas próprias.
 * Toda movimentação registra usuário, data/hora, origem, destino e observação. */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { org, sub } = requireAuth(req);
    const { id } = await params;
    const { stage, note } = input.parse(await req.json());

    const strategy = await prisma.editorialStrategy.findFirst({
      where: { id, organizationId: org },
      select: { id: true, productionStage: true, stageHistory: true, version: true },
    });
    if (!strategy) throw Errors.notFound("Linha editorial");

    if (!canMove(strategy.productionStage, stage)) {
      throw Errors.badRequest(
        `Transição inválida: ${strategy.productionStage ?? "fora da esteira"} → ${stage}.`,
      );
    }

    const user = await prisma.user.findUnique({ where: { id: sub }, select: { name: true } });
    const defaultNote =
      strategy.productionStage === "final_review" && stage === "design"
        ? "Retornada para Designer / Audiovisual (ajuste na produção)"
        : `Movida para ${STAGE_LABELS[stage]}`;

    const history = appendHistory(strategy.stageHistory, {
      from: strategy.productionStage,
      to: stage,
      at: new Date().toISOString(),
      byId: sub,
      byName: user?.name ?? null,
      note: note || defaultNote,
    });

    await prisma.editorialStrategy.update({
      where: { id: strategy.id },
      data: { productionStage: stage, responsibleUserId: sub, stageHistory: history },
    });

    return ok({ productionStage: stage });
  });
}
