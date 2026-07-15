import { z } from "zod";
import { prisma } from "@soie/db";
import { requireAuth } from "@/server/auth";
import { ok, handle, Errors } from "@/server/http";
import {
  PIECE_LABELS,
  pushPieceEvent,
  syncStrategyStage,
  openClientPortalIfReady,
  ensureProductionPortalToken,
  type PieceStatus,
} from "@/server/production-flow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const input = z.object({
  action: z.enum(["start", "produced", "approve_internal", "reject_internal", "reopen"]),
  note: z.string().max(1000).optional(),
});

/** Transições permitidas por ação (status atual → novo). */
const TRANSITIONS: Record<string, { from: string[]; to: PieceStatus }> = {
  start: { from: ["aguardando", "em_producao"], to: "em_producao" },
  // Pode marcar produzida direto de "Aguardando" (anexou a arte e concluiu num
  // passo só) ou de "Em Produção".
  produced: { from: ["aguardando", "em_producao"], to: "produzida" },
  approve_internal: { from: ["produzida"], to: "aprovada_interna" },
  reject_internal: { from: ["produzida", "aprovada_interna"], to: "em_producao" },
  reopen: { from: ["produzida", "aprovada_interna"], to: "em_producao" },
};

async function strategyIdOf(deliverableId: string): Promise<string | null> {
  const t = await prisma.theme.findFirst({
    where: { deliverableId },
    select: { category: { select: { editorialLine: { select: { strategyId: true } } } } },
  });
  return t?.category?.editorialLine?.strategyId ?? null;
}

/**
 * POST /deliverables/:id/production-status
 * Move UMA peça no fluxo de produção (Aguardando → Em Produção → Produzida →
 * Aprovada internamente). Reprovar devolve só esta peça para Em Produção. Cada
 * transição registra no histórico e recomputa a coluna da linha na esteira.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { org, sub } = requireAuth(req);
    const { id } = await params;
    const { action, note } = input.parse(await req.json().catch(() => ({})));

    const piece = await prisma.deliverable.findFirst({
      where: { id, organizationId: org },
      select: { id: true, productionStatus: true, history: true },
    });
    if (!piece) throw Errors.notFound("Peça");

    const rule = TRANSITIONS[action]!;
    if (!rule.from.includes(piece.productionStatus)) {
      throw Errors.badRequest(
        `Ação "${action}" indisponível a partir de "${PIECE_LABELS[piece.productionStatus as PieceStatus] ?? piece.productionStatus}".`,
      );
    }
    if ((action === "reject_internal") && !note?.trim()) {
      throw Errors.badRequest("Descreva o ajuste ao reprovar internamente.");
    }

    const user = await prisma.user.findUnique({ where: { id: sub }, select: { name: true } });
    const isReject = action === "reject_internal";
    await prisma.deliverable.update({
      where: { id: piece.id },
      data: {
        productionStatus: rule.to,
        assignedToId: sub,
        history: pushPieceEvent(piece.history, {
          type: isReject ? "approval" : "status",
          from: piece.productionStatus,
          to: rule.to,
          byId: sub,
          byName: user?.name ?? null,
          note: note ?? (action === "approve_internal" ? "Aprovada na revisão interna" : `→ ${PIECE_LABELS[rule.to]}`),
        }),
      },
    });

    const strategyId = await strategyIdOf(piece.id);
    let portalToken: string | null = null;
    if (strategyId) {
      // Assim que a PRIMEIRA peça fica pronta (produzida), o link do cliente já
      // é solto — ele começa a aprovar enquanto as demais são produzidas.
      if (action === "produced") {
        portalToken = await ensureProductionPortalToken(org, strategyId);
      }
      if (action === "approve_internal") {
        portalToken = await openClientPortalIfReady(org, strategyId, { id: sub, name: user?.name });
      }
      await syncStrategyStage(org, strategyId, { id: sub, name: user?.name });
    }

    return ok({ productionStatus: rule.to, portalToken });
  });
}
