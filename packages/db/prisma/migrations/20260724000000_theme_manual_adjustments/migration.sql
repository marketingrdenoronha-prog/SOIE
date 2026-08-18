-- AJUSTES MANUAIS por conteúdo: instruções manuais + status de revisão por tema.
ALTER TABLE "themes" ADD COLUMN IF NOT EXISTS "contentStatus" TEXT;
ALTER TABLE "themes" ADD COLUMN IF NOT EXISTS "adjustmentNote" TEXT;
