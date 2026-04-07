-- Tabla de combos (descuento por pago conjunto de eventos)
CREATE TABLE IF NOT EXISTS combos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  event_ids JSONB NOT NULL DEFAULT '[]',
  date_tiers JSONB,
  payment_amount NUMERIC(10, 2) NOT NULL,
  payment_account TEXT NOT NULL,
  whatsapp_number TEXT NOT NULL,
  whatsapp_confirmation BOOLEAN NOT NULL DEFAULT false,
  is_open BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Agregar combo_id a attendees
ALTER TABLE attendees ADD COLUMN IF NOT EXISTS combo_id UUID REFERENCES combos(id) ON DELETE SET NULL;
