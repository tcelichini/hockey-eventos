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
