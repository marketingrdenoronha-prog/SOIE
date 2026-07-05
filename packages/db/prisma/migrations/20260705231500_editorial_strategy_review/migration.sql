-- Phase A: client approval flow for the editorial strategy. A tokenized public
-- link lets the client approve or request changes on the strategy before any
-- production starts.
ALTER TABLE "editorial_strategies" ADD COLUMN "reviewToken" TEXT;
ALTER TABLE "editorial_strategies" ADD COLUMN "approvedAt" TIMESTAMP(3);
ALTER TABLE "editorial_strategies" ADD COLUMN "clientComment" TEXT;
ALTER TABLE "editorial_strategies" ADD COLUMN "reviewedBy" TEXT;
CREATE UNIQUE INDEX "editorial_strategies_reviewToken_key" ON "editorial_strategies"("reviewToken");
