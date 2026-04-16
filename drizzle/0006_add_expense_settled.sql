ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "settled" boolean NOT NULL DEFAULT false;
