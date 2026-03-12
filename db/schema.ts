import { pgTable, uuid, text, timestamp, numeric, integer, boolean, pgEnum, jsonb } from "drizzle-orm/pg-core"

export type PricingTier = {
  upTo: number | null
  price: number
}

export const statusEnum = pgEnum("rsvp_status", ["confirmed", "declined"])
export const paymentStatusEnum = pgEnum("payment_status", ["pending", "paid"])

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
  pricing_tiers: jsonb("pricing_tiers").$type<PricingTier[]>(),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

export const attendees = pgTable("attendees", {
  id: uuid("id").defaultRandom().primaryKey(),
  event_id: uuid("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  full_name: text("full_name").notNull(),
  status: statusEnum("status").notNull(),
  payment_status: paymentStatusEnum("payment_status").notNull().default("pending"),
  payment_proof_url: text("payment_proof_url"),
  price_paid: numeric("price_paid", { precision: 10, scale: 2 }),
  created_at: timestamp("created_at", { withTimezone: true }).defaultNow(),
})

export type Event = typeof events.$inferSelect
export type NewEvent = typeof events.$inferInsert
export type Attendee = typeof attendees.$inferSelect
export type NewAttendee = typeof attendees.$inferInsert
