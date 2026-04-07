import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { attendees, events } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { notifyAdminWhatsApp } from "@/lib/whatsapp-notify"
import { calculatePrice, calculateDatePrice } from "@/lib/pricing"

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

  // Fetch confirmed attendees (used for dedup, capacity check, and pricing tiers)
  const confirmedAttendees = await db
    .select()
    .from(attendees)
    .where(and(eq(attendees.event_id, event_id), eq(attendees.status, "confirmed")))

  const confirmedCount = confirmedAttendees.length

  // Check for existing registration with same name (dedup, accent-insensitive)
  if (status === "confirmed") {
    const normalize = (s: string) =>
      s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")

    const existing = confirmedAttendees.find(
      (a) => normalize(a.full_name) === normalize(full_name)
    )

    if (existing) {
      // Para eventos con precio por fecha y asistente aún no pagado,
      // recalcular el precio según la fecha actual (puede haber vencido un tramo)
      let currentPaymentAmount = existing.price_paid || event.payment_amount
      if (event.date_tiers && event.date_tiers.length > 0 && existing.payment_status !== "paid") {
        const recalculated = calculateDatePrice(event.date_tiers, event.payment_amount)
        currentPaymentAmount = String(recalculated)
        // Actualizar price_paid en la DB con el precio vigente
        await db.update(attendees)
          .set({ price_paid: String(recalculated) })
          .where(eq(attendees.id, existing.id))
      }

      return NextResponse.json({
        attendee: existing,
        payment_account: event.payment_account,
        payment_amount: currentPaymentAmount,
        whatsapp_number: event.whatsapp_number,
        event_title: event.title,
        existing: true,
      }, { status: 200 })
    }
  }

  // Check capacity
  if (status === "confirmed" && event.max_capacity) {
    if (confirmedCount >= event.max_capacity) {
      return NextResponse.json({ error: "El evento está completo, no hay más lugares disponibles" }, { status: 409 })
    }
  }

  // Calculate price based on tiers (by quantity or by date)
  const price = status === "confirmed"
    ? event.date_tiers && event.date_tiers.length > 0
      ? calculateDatePrice(event.date_tiers, event.payment_amount)
      : calculatePrice(event.pricing_tiers, event.payment_amount, confirmedCount)
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
