-- Migración 3: campo is_3t para eventos de Tercer Tiempo
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "is_3t" boolean NOT NULL DEFAULT false;
