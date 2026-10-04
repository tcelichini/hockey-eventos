import { pgTable, uuid, text, timestamp, numeric, integer, boolean, pgEnum, jsonb, primaryKey } from "drizzle-orm/pg-core"

export type PricingTier = {
  upTo: number | null
  price: number
}

export type DateTier = {
  until: string | null  // "YYYY-MM-DD", null = catch-all (después de todas las fechas)
  price: number
}

export const statusEnum = pgEnum("rsvp_status", ["confirmed", "declined"])
// "guest" = invitado (ej: entrenadores): cuenta como asistente pero no paga ni debe (ver CONTEXT.md)
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "paid", "guest"])

export const events = pgTable("events", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").unique().notNull(),
  title: text("title").notNull(),
  description: text("description"),
  date: timestamp("date", { withTimezone: true }).notNull(),
  flyer_url: text("flyer_url"),
  payment_account: text("payment_account").notNull(),
  payment_amount: numeric("payment_amount", { precision: 10, scale: 2 }).notNull(),
  whatsapp_number: text("whatsapp_number").notNull(),
  max_capacity: integer("max_capacity"),
  is_open: boolean("is_open").notNull().default(true),
  whatsapp_confirmation: boolean("whatsapp_confirmation").notNull().default(false),
  pricing_tiers: jsonb("pricing_tiers").$type<PricingTier[]>(),
  date_tiers: jsonb("date_tiers").$type<DateTier[]>(),
  is_3t: boolean("is_3t").notNull().default(false),
  teams: jsonb("teams").$type<string[]>(),
  inferiores_price: numeric("inferiores_price", { precision: 10, scale: 2 }),
  // Interruptor "pide celular": los asistentes se anotan como Persona (ver CONTEXT.md)
  requires_phone: boolean("requires_phone").notNull().default(false),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

// Persona (ver CONTEXT.md): identidad estable entre eventos, reconocida por su celular
export const people = pgTable("people", {
  id: uuid("id").defaultRandom().primaryKey(),
  real_name: text("real_name"),  // lo carga un admin; null = sin nombre real
  team: text("team"),            // "A" | "B" (plantel); null = externo
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

// Una Persona puede tener varios celulares (fusiones) y un celular varias Personas
export const personPhones = pgTable("person_phones", {
  person_id: uuid("person_id").notNull().references(() => people.id, { onDelete: "cascade" }),
  phone: text("phone").notNull(),  // 10 dígitos: código de área + número (lib/people.ts normalizePhone)
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.person_id, t.phone] }),
}))

export const attendees = pgTable("attendees", {
  id: uuid("id").defaultRandom().primaryKey(),
  event_id: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  combo_id: uuid("combo_id").references(() => combos.id, { onDelete: "set null" }),
  // null en el historial y en eventos que no piden celular
  person_id: uuid("person_id").references(() => people.id, { onDelete: "set null" }),
  // Nombre con el que figura en ESTE evento (libre; único dentro del evento)
  full_name: text("full_name").notNull(),
  status: statusEnum("status").notNull(),
  payment_status: paymentStatusEnum("payment_status").notNull().default("pending"),
  payment_proof_url: text("payment_proof_url"),
  proof_uploaded_at: timestamp("proof_uploaded_at", { withTimezone: true }),
  // Celular del teléfono desde el que se subió el comprobante (null = sin identificar). Nunca se expone en APIs públicas.
  proof_uploaded_from: text("proof_uploaded_from"),
  price_paid: numeric("price_paid", { precision: 10, scale: 2 }),
  is_inferiores: boolean("is_inferiores").notNull().default(false),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

export const combos = pgTable("combos", {
  id: uuid("id").defaultRandom().primaryKey(),
  slug: text("slug").unique().notNull(),
  title: text("title").notNull(),
  description: text("description"),
  event_ids: jsonb("event_ids").$type<string[]>().notNull(),
  date_tiers: jsonb("date_tiers").$type<DateTier[]>(),
  payment_amount: numeric("payment_amount", { precision: 10, scale: 2 }).notNull(),
  payment_account: text("payment_account").notNull(),
  whatsapp_number: text("whatsapp_number").notNull(),
  whatsapp_confirmation: boolean("whatsapp_confirmation").notNull().default(false),
  is_open: boolean("is_open").notNull().default(true),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

export const expenses = pgTable("expenses", {
  id: uuid("id").defaultRandom().primaryKey(),
  event_id: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  responsible: text("responsible").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  notes: text("notes"),
  payment_alias: text("payment_alias"),
  receipt_url: text("receipt_url"),
  settled: boolean("settled").notNull().default(false),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

export type Event = typeof events.$inferSelect
export type NewEvent = typeof events.$inferInsert
export type Attendee = typeof attendees.$inferSelect
export type NewAttendee = typeof attendees.$inferInsert
export type Expense = typeof expenses.$inferSelect
export type NewExpense = typeof expenses.$inferInsert
export type Combo = typeof combos.$inferSelect
export type NewCombo = typeof combos.$inferInsert
export type Person = typeof people.$inferSelect
export type NewPerson = typeof people.$inferInsert
