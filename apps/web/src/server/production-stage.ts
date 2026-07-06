/**
 * Esteira de Produção (V3) — o ciclo de vida operacional de uma Linha Editorial.
 *
 * Cada Linha Editorial (EditorialStrategy) é UM card no Kanban de Produção. As
 * peças (Deliverables) são subordinadas à linha e aparecem dentro do card, nunca
 * como cards próprios. `productionStage` é a coluna; `status` continua sendo o
 * estado de aprovação do cliente.
 */

export const PRODUCTION_STAGES = [
  "client_review",
  "approved",
  "design",
  "final_review",
  "to_post",
] as const;

export type ProductionStage = (typeof PRODUCTION_STAGES)[number];

export const STAGE_LABELS: Record<ProductionStage, string> = {
  client_review: "Em Revisão do Cliente",
  approved: "Aprovada",
  design: "Designer / Audiovisual",
  final_review: "Em Aprovação Final",
  to_post: "A Postar",
};

/**
 * Transições permitidas pela ação MANUAL do operador (endpoint /stage).
 * A entrada em `client_review` acontece via "Enviar para Cliente" (submit) e a
 * ida para `approved`/saída da esteira acontece via decisão do cliente — essas
 * não passam por aqui.
 */
export const MANUAL_TRANSITIONS: Record<string, ProductionStage[]> = {
  approved: ["design"],
  design: ["final_review"],
  final_review: ["to_post", "design"],
};

export function canMove(from: string | null, to: string): to is ProductionStage {
  if (!from) return false;
  return (MANUAL_TRANSITIONS[from] ?? []).includes(to as ProductionStage);
}

import type { Prisma } from "@soie/db";

export interface StageEvent {
  from: string | null;
  to: string;
  at: string;
  byId: string | null;
  byName: string | null;
  note?: string | null;
}

/** Adiciona um evento à timeline append-only (nunca remove nada). Retorna um
 * valor JSON compatível com o campo Json do Prisma. */
export function appendHistory(existing: unknown, event: StageEvent): Prisma.InputJsonValue {
  const list = Array.isArray(existing) ? (existing as StageEvent[]) : [];
  return [...list, event] as unknown as Prisma.InputJsonValue;
}
