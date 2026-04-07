-- Agrega la columna date_tiers a la tabla events
-- Ejecutar en el SQL Editor de Supabase

ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "date_tiers" jsonb;
