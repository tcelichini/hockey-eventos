-- Agrega la columna proof_uploaded_at a la tabla attendees
-- Ejecutar en el SQL Editor de Supabase

ALTER TABLE "attendees" ADD COLUMN IF NOT EXISTS "proof_uploaded_at" timestamp with time zone;
