-- Migración 5: comprobante (recibo/ticket) del gasto, visible solo en admin
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "receipt_url" text;
