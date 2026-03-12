import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { attendees, events } from "@/db/schema"
import { eq, and, count } from "drizzle-orm"
import { notifyAdminWhatsApp } from "@/lib/whatsapp-notify"
import { calculatePrice } from "@/lib/pricing"

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { event_id, full_name, status } = body

  if (!event_id || !status || !["confirmed", "declined"].includes(status)) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })
  }

  if (status === "confirmed" && !full_name?.trim()) {
    return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 })
  }

  // Fetch event for payment info and status checks
  const [event] = await db.select().from(events).where(eq(events.id, event_id)).limit(1)
  if (!event) {
    return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 })
  }

  // Check if event is open
  if (status === "confirmed" && !event.is_open) {
    return NextResponse.json({ error: "Las inscripciones para este evento están cerradas" }, { status: 409 })
  }

  // Get confirmed count (needed for capacity check and pricing tiers)
  const [{ value: confirmedCount }] = await db
    .select({ value: count() })
    .from(attendees)
    .where(and(eq(attendees.event_id, event_id), eq(attendees.status, "confirmed")))

  // Check capacity
  if (status === "confirmed" && event.max_capacity) {
    if (Number(confirmedCount) >= event.max_capacity) {
      return NextResponse.json({ error: "El evento está completo, no hay más lugares disponibles" }, { status: 409 })
    }
  }

  // Calculate price based on tiers
  const price = status === "confirmed"
    ? calculatePrice(event.pricing_tiers, event.payment_amount, Number(confirmedCount))
    : 0

  const [attendee] = await db
    .insert(attendees)
    .values({
      event_id,
      full_name: full_name?.trim() || "Anónimo",
      status,
      payment_status: "pending",
      price_paid: status === "confirmed" ? String(price) : null,
    })
    .returning()

  if (status === "confirmed") {
    await notifyAdminWhatsApp(
      `Nueva confirmacion! ${full_name.trim()} se anoto para "${event.title}"`
    )
  }

  return NextResponse.json({
    attendee,
    payment_account: event.payment_account,
    payment_amount: String(price),
    whatsapp_number: event.whatsapp_number,
    event_title: event.title,
  }, { status: 201 })
}
