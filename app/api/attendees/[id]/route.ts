import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { attendees, events } from "@/db/schema"
import { eq } from "drizzle-orm"
import { COOKIE_NAME, verifySession } from "@/lib/auth"
import { calculateDatePrice } from "@/lib/pricing"

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const cookie = request.cookies.get(COOKIE_NAME)?.value
  if (!cookie || !(await verifySession(cookie))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [deleted] = await db
    .delete(attendees)
    .where(eq(attendees.id, params.id))
    .returning()

  if (!deleted) {
    return NextResponse.json({ error: "Asistente no encontrado" }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const cookie = request.cookies.get(COOKIE_NAME)?.value
  if (!cookie || !(await verifySession(cookie))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { payment_status, is_inferiores } = body

  if (is_inferiores !== undefined) {
    const [attendee] = await db.select().from(attendees).where(eq(attendees.id, params.id)).limit(1)
    if (!attendee) {
      return NextResponse.json({ error: "Asistente no encontrado" }, { status: 404 })
    }
    const [event] = await db.select().from(events).where(eq(events.id, attendee.event_id)).limit(1)
    let newPrice: string | null = attendee.price_paid
    if (is_inferiores && event?.inferiores_price) {
      newPrice = event.inferiores_price
    } else if (!is_inferiores && event) {
      const regularPrice = event.date_tiers && event.date_tiers.length > 0
        ? calculateDatePrice(event.date_tiers, event.payment_amount)
        : event.pricing_tiers && event.pricing_tiers.length > 0
          ? Number(event.payment_amount)
          : Number(event.payment_amount)
      newPrice = String(regularPrice)
    }
    const [updated] = await db
      .update(attendees)
      .set({ is_inferiores: Boolean(is_inferiores), price_paid: newPrice })
      .where(eq(attendees.id, params.id))
      .returning()
    return NextResponse.json(updated)
  }

  if (!payment_status || !["pending", "paid"].includes(payment_status)) {
    return NextResponse.json({ error: "Estado de pago inválido" }, { status: 400 })
  }

  const [updated] = await db
    .update(attendees)
    .set({ payment_status })
    .where(eq(attendees.id, params.id))
    .returning()

  if (!updated) {
    return NextResponse.json({ error: "Asistente no encontrado" }, { status: 404 })
  }

  return NextResponse.json(updated)
}
