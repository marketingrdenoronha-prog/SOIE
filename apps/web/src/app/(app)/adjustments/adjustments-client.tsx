"use client";

import { AdjustmentsBoard } from "@/components/adjustments-board";

/** Ajustes — dois tipos SEPARADOS: da Linha Editorial (com ajuste manual/IA) e
 * de Materiais prontos (o designer refaz na esteira). Também aparece embutido
 * dentro da aba Produção. */
export function AdjustmentsClient() {
  return (
    <div className="mx-auto max-w-[1200px] space-y-6">
      <div>
        <h1 className="text-[32px] font-bold leading-tight tracking-[-0.03em]">Ajustes</h1>
        <p className="text-sm text-muted">
          Tudo que o cliente pediu para mudar, separado por tipo. Ajuste da linha editorial tem modo manual e automático (IA);
          ajuste de material pronto volta para o Designer refazer.
        </p>
      </div>
      <AdjustmentsBoard />
    </div>
  );
}
