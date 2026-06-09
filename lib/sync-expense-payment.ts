import { db } from "@/db"
import { attendees, expenses, events } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { calculateDatePrice } from "@/lib/pricing"

export async function syncExpensePayment(eventId: string, responsibleName: string) {
  const normalize = (s: string) => s.trim().toLowerCase()
  const key = normalize(responsibleName)

  const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1)
  if (!event) return

  const attendeeList = await db
    .select()
    .from(attendees)
    .where(and(eq(attendees.event_id, eventId), eq(attendees.status, "confirmed")))

  const attendee = attendeeList.find(a => normalize(a.full_name) === key)
  if (!attendee) return

  const expenseList = await db
    .select()
    .from(expenses)
    .where(eq(expenses.event_id, eventId))

  const totalExpenses = expenseList
    .filter(e => normalize(e.responsible) === key)
    .reduce((sum, e) => sum + Number(e.amount), 0)

  const amount = Number(event.payment_amount) || 0
  const inferioresPrice = event.inferiores_price ? Number(event.inferiores_price) : null
  const currentTierPrice = event.date_tiers && event.date_tiers.length > 0
    ? calculateDatePrice(event.date_tiers, String(event.payment_amount))
    : null
  const maxPricingTierPrice = event.pricing_tiers && event.pricing_tiers.length > 0
    ? Math.max(...event.pricing_tiers.map(t => t.price))
    : null

  const owedPrice = attendee.is_inferiores && inferioresPrice !== null
    ? inferioresPrice
    : currentTierPrice !== null ? currentTierPrice
    : maxPricingTierPrice !== null ? maxPricingTierPrice
    : Number(attendee.price_paid) || amount

  const hasProof = !!attendee.payment_proof_url

  if (totalExpenses >= owedPrice && attendee.payment_status !== "paid") {
    await db.update(attendees)
      .set({ payment_status: "paid" })
      .where(eq(attendees.id, attendee.id))
  } else if (totalExpenses < owedPrice && attendee.payment_status === "paid" && !hasProof) {
    await db.update(attendees)
      .set({ payment_status: "pending" })
      .where(eq(attendees.id, attendee.id))
  }
}
