-- Migración 7: equipos para eventos 3T
-- Permite asignar uno o más equipos (A, B, o ambos) a un evento 3T para
-- definir qué planteles se cargan automáticamente como asistentes confirmados.
-- Solo aplica cuando is_3t = true. Valores válidos: ["A"], ["B"], ["A","B"].

ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "teams" jsonb;

-- Backfill: todos los eventos 3T existentes son del Equipo A (era el único equipo
-- usando la app antes de este cambio).
-- Excepciones (se dejan con teams = NULL):
--   - "3T MASTER + 3T FERRO" (05bd5a32-...): lo creó el Equipo B antes de tener su
--     lista de jugadores. El admin decidirá más adelante qué teams asignarle.
--   - Evento de gasto compartido (5dd8e676-...): incluye jugadores de ambos equipos
--     más invitados no-jugadores, todos cargados manualmente. Si se asignara
--     teams=["A","B"] el dropdown público mostraría duplicados (los nombres manuales
--     no coinciden 1:1 con PLAYERS_A/PLAYERS_B). Se deja sin teams para que el
--     dropdown solo muestre los attendees ya en DB.
UPDATE "events"
SET "teams" = '["A"]'::jsonb
WHERE is_3t = true
  AND teams IS NULL
  AND id NOT IN (
    '05bd5a32-753b-469d-8117-963f3c1c9d2d',
    '5dd8e676-f2df-446e-877d-4977ba55ff7c'
  );
