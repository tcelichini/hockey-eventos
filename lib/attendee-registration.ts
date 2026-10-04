import { db } from "@/db"
import { attendees, expenses, type Event, type Attendee } from "@/db/schema"
import { eq } from "drizzle-orm"
import { calculatePrice, calculateDatePrice } from "@/lib/pricing"
import { syncExpensePayment } from "@/lib/sync-expense-payment"
import { normalizeName, isGuest } from "@/lib/settlement"

/**
 * Piezas compartidas por las rutas que anotan asistentes (por nombre, por celular
 * y desde admin): precio de un anotado nuevo y datos de pago que ve cada uno.
 */

/**
 * Total de gastos adelantados por una persona en un evento (misma normalización
 * que lib/settlement.ts).
 */
export async function getExpensesTotal(eventId: string, fullName: string): Promise<number> {
  const key = normalizeName(fullName)
  const rows = await db
    .select({ responsible: expenses.responsible, amount: expenses.amount })
    .from(expenses)
    .where(eq(expenses.event_id, eventId))
  return rows
    .filter((e) => normalizeName(e.responsible) === key)
    .reduce((sum, e) => sum + Number(e.amount), 0)
}

/** El asistente tal como sale en una respuesta pública: sin el celular desde el que se subió el comprobante. */
export function publicAttendee(attendee: Attendee) {
  return { ...attendee, proof_uploaded_from: undefined }
}

/**
 * Precio de quien se anota ahora: inferiores (solo fuera de 3T), tramo por fecha,
 * o tramo por cantidad según cuántos de los que pagan ya están anotados.
 */
export function priceForNewAttendee(event: Event, payingCount: number, isInferiores: boolean): number {
  const useInferioresPrice = isInferiores && !event.is_3t && event.inferiores_price
  return useInferioresPrice
    ? Number(event.inferiores_price)
    : event.date_tiers && event.date_tiers.length > 0
      ? calculateDatePrice(event.date_tiers, event.payment_amount)
      : calculatePrice(event.pricing_tiers, event.payment_amount, payingCount)
}

/**
 * Datos de pago de alguien que ya estaba anotado. Si sigue pendiente en un evento
 * por fecha, recalcula el precio al tramo de hoy y lo guarda.
 */
export async function existingAttendeePayload(event: Event, existing: Attendee) {
  let currentPaymentAmount = existing.price_paid || event.payment_amount
  if (existing.is_inferiores && event.inferiores_price) {
    currentPaymentAmount = event.inferiores_price
  } else if (event.date_tiers && event.date_tiers.length > 0 && existing.payment_status === "pending") {
    const recalculated = calculateDatePrice(event.date_tiers, event.payment_amount)
    currentPaymentAmount = String(recalculated)
    await db.update(attendees)
      .set({ price_paid: String(recalculated) })
      .where(eq(attendees.id, existing.id))
  }

  // Gastos adelantados: si aún no pagó, solo debe la diferencia (precio − gastos).
  // Si los gastos cubren el precio, el sync lo marca como pagado.
  const expensesTotal = await getExpensesTotal(event.id, existing.full_name)
  let attendeeRow = existing
  if (expensesTotal > 0 && existing.payment_status === "pending") {
    await syncExpensePayment(event.id, existing.full_name)
    const [refreshed] = await db.select().from(attendees).where(eq(attendees.id, existing.id)).limit(1)
    if (refreshed) attendeeRow = refreshed
  }
  const amountDue = isGuest(existing) ? 0 : Math.max(Number(currentPaymentAmount) - expensesTotal, 0)

  return {
    attendee: publicAttendee(attendeeRow),
    payment_account: event.payment_account,
    payment_amount: currentPaymentAmount,
    expenses_total: String(expensesTotal),
    amount_due: String(amountDue),
    whatsapp_number: event.whatsapp_number,
    event_title: event.title,
    existing: true,
  }
}

/**
 * Datos de pago de alguien recién anotado. Puede haber gastos cargados a su nombre
 * antes de anotarse: se descuentan del monto a pagar.
 */
export async function newAttendeePayload(event: Event, attendee: Attendee, price: number) {
  let attendeeRow = attendee
  const expensesTotal = await getExpensesTotal(event.id, attendee.full_name)
  if (expensesTotal > 0) {
    await syncExpensePayment(event.id, attendee.full_name)
    const [refreshed] = await db.select().from(attendees).where(eq(attendees.id, attendee.id)).limit(1)
    if (refreshed) attendeeRow = refreshed
  }
  const amountDue = Math.max(price - expensesTotal, 0)

  return {
    attendee: publicAttendee(attendeeRow),
    payment_account: event.payment_account,
    payment_amount: String(price),
    expenses_total: String(expensesTotal),
    amount_due: String(amountDue),
    whatsapp_number: event.whatsapp_number,
    event_title: event.title,
  }
}
