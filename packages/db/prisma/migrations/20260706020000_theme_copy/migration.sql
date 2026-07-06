-- V2: editorial-line themes carry ready-to-review copy so the strategy the
-- client approves already reads like a finished document (tema + formato + copy;
-- carousel = one screen per array item).
ALTER TABLE "themes" ADD COLUMN "copy" JSONB;
