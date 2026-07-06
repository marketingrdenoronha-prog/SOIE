-- V3: cada tema da Linha Editorial sai pronto para produção. Campos padrão de
-- saída (Gancho, CTA, Observações de produção, Objetivo estratégico) além da
-- copy completa estruturada (armazenada em themes.copy como JSON por formato).
ALTER TABLE "themes" ADD COLUMN IF NOT EXISTS "strategicObjective" TEXT;
ALTER TABLE "themes" ADD COLUMN IF NOT EXISTS "hook" TEXT;
ALTER TABLE "themes" ADD COLUMN IF NOT EXISTS "cta" TEXT;
ALTER TABLE "themes" ADD COLUMN IF NOT EXISTS "productionNotes" TEXT;
