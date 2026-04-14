-- Migración 4: alias/CBU opcional en gastos para que el admin sepa a dónde transferir al que adelantó el gasto
ALTER TABLE "expenses" ADD COLUMN IF NOT EXISTS "payment_alias" text;
