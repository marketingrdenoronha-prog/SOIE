-- Add a human-readable title to calendar entries so the calendar shows what
-- each scheduled post is about (derived from the editorial line's theme).
ALTER TABLE "calendar_entries" ADD COLUMN "title" TEXT;
