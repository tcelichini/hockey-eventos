import { db } from "@/db"
import { attendees, expenses, events } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { getOwedPrice, normalizeName } from "@/lib/settlement"

/**
 * Sincroniza payment_status de un asistente según sus gastos adelantados.
 * Se ejecuta desde las APIs de gastos (crear/editar/borrar).
 * El precio adeudado lo decide lib/settlement.ts (getOwedPrice).
 */
export async function syncExpensePayment(eventId: string, responsibleName: string) {
  const key = normalizeName(responsibleName)

  const [event] = await db.select().from(events).where(eq(events.id, eventId)).limit(1)
  if (!event) return

  const attendeeList = await db
    .select()
    .from(attendees)
    .where(and(eq(attendees.event_id, eventId), eq(attendees.status, "confirmed")))

  const attendee = attendeeList.find(a => normalizeName(a.full_name) === key)
  if (!attendee) return

  const expenseList = await db
    .select()
    .from(expenses)
    .where(eq(expenses.event_id, eventId))

  const totalExpenses = expenseList
    .filter(e => normalizeName(e.responsible) === key)
    .reduce((sum, e) => sum + Number(e.amount), 0)

  const owedPrice = getOwedPrice(event, attendee)
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
