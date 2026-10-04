# Migraciones SQL — hockey-eventos

Migraciones a ejecutar en Supabase SQL Editor. Las versiones de Drizzle están en `drizzle/` dentro del repo.

## Migraciones aplicadas

```sql
-- Migración 1: precios por fecha en eventos
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "date_tiers" json;

-- Migración 2: fecha de carga de comprobante
ALTER TABLE "attendees" ADD COLUMN IF NOT EXISTS "proof_uploaded_at" timestamp with time zone;

-- Migración 3: campo is_3t para eventos de Tercer Tiempo
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "is_3t" boolean NOT NULL DEFAULT false;

-- Migración 4: alias/CBU en gastos (para que el admin sepa a dónde transferir al que adelantó el gasto)
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "payment_alias" text;

-- Migración 5: comprobante (recibo/ticket) del gasto
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "receipt_url" text;
-- + crear bucket público "expense-receipts" en Supabase Storage

-- Migración 6: marca de gasto saldado (devolución hecha al acreedor)
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "settled" boolean NOT NULL DEFAULT false;

-- Migración 7: precio reducido para jugadores de inferiores
ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "inferiores_price" numeric(10,2);
ALTER TABLE "attendees" ADD COLUMN IF NOT EXISTS "is_inferiores" boolean NOT NULL DEFAULT false;

-- Migración 8: estado de pago "invitado" (entrenadores, etc.) — aplicada 2026-09-26
-- Nota: Postgres no permite quitar valores de un enum; si se deja de usar, queda inerte.
ALTER TYPE payment_status ADD VALUE IF NOT EXISTS 'guest';

-- Migración 9: Personas (identidad por celular) — aplicada 2026-10-03 (ver "Personas" en docs/ARQUITECTURA.md)
-- Solo agrega tablas y columnas. Tiene que estar aplicada ANTES de deployar el código que la usa.
CREATE TABLE IF NOT EXISTS "people" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "real_name" text,                 -- lo carga un admin; null = sin nombre real
  "team" text,                      -- 'A' | 'B' (plantel); null = externo
  "created_at" timestamp with time zone DEFAULT now()
);

-- Una Persona puede tener varios números (fusiones) y un número varias Personas.
CREATE TABLE IF NOT EXISTS "person_phones" (
  "person_id" uuid NOT NULL REFERENCES "people"("id") ON DELETE CASCADE,
  "phone" text NOT NULL,            -- 10 dígitos: código de área + número
  "created_at" timestamp with time zone DEFAULT now(),
  PRIMARY KEY ("person_id", "phone")
);
CREATE INDEX IF NOT EXISTS "person_phones_phone_idx" ON "person_phones" ("phone");

-- Los celulares son datos personales: sin políticas, la API pública de Supabase no puede leer estas tablas.
-- La app entra por DATABASE_URL (rol dueño de las tablas), que no pasa por RLS.
ALTER TABLE "people" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "person_phones" ENABLE ROW LEVEL SECURITY;

ALTER TABLE "attendees" ADD COLUMN IF NOT EXISTS "person_id" uuid REFERENCES "people"("id") ON DELETE SET NULL;
ALTER TABLE "attendees" ADD COLUMN IF NOT EXISTS "proof_uploaded_from" text;  -- celular desde el que se subió el comprobante
CREATE UNIQUE INDEX IF NOT EXISTS "attendees_event_person_unique"
  ON "attendees" ("event_id", "person_id")
  WHERE "person_id" IS NOT NULL AND "status" = 'confirmed';

ALTER TABLE "events" ADD COLUMN IF NOT EXISTS "requires_phone" boolean NOT NULL DEFAULT false;  -- interruptor "pide celular"
```

## Buckets de Storage

| Bucket | Uso |
|---|---|
| `event-banners` | Imágenes de portada de eventos **y** comprobantes de pago de asistentes (ingresos) |
| `expense-receipts` | Comprobantes/recibos de gastos (egresos) — separado a propósito de los anteriores |

## Cómo verificar que las migraciones están aplicadas

Antes de tocar features que dependan de columnas nuevas, correr:

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'events'
ORDER BY ordinal_position;
```

(Ajustar `'events'` por la tabla relevante.)
