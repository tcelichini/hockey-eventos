import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { attendees, combos, events } from "@/db/schema"
import { eq, and, inArray } from "drizzle-orm"
import { notifyAdminWhatsApp } from "@/lib/whatsapp-notify"
import { calculateDatePrice } from "@/lib/pricing"

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { combo_id, full_name, status } = body

  if (!combo_id || !status || !["confirmed", "declined"].includes(status)) {
    return NextResponse.json({ error: "Datos invalidos" }, { status: 400 })
  }

  if (status === "confirmed" && !full_name?.trim()) {
    return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 })
  }

  // Fetch combo
  const [combo] = await db.select().from(combos).where(eq(combos.id, combo_id)).limit(1)
  if (!combo) {
    return NextResponse.json({ error: "Combo no encontrado" }, { status: 404 })
  }

  if (status === "confirmed" && !combo.is_open) {
    return NextResponse.json({ error: "Las inscripciones para este combo estan cerradas" }, { status: 409 })
  }

  // Fetch linked events
  const linkedEvents = await db
    .select()
    .from(events)
    .where(inArray(events.id, combo.event_ids))

  if (linkedEvents.length !== combo.event_ids.length) {
    return NextResponse.json({ error: "Algunos eventos del combo ya no existen" }, { status: 400 })
  }

  // Check all events are open and have capacity
  if (status === "confirmed") {
    for (const event of linkedEvents) {
      if (!event.is_open) {
        return NextResponse.json(
          { error: `El evento "${event.title}" tiene las inscripciones cerradas` },
          { status: 409 }
        )
      }

      if (event.max_capacity) {
        const confirmedList = await db
          .select()
          .from(attendees)
          .where(and(eq(attendees.event_id, event.id), eq(attendees.status, "confirmed")))
        if (confirmedList.length >= event.max_capacity) {
          return NextResponse.json(
            { error: `El evento "${event.title}" esta completo` },
            { status: 409 }
          )
        }
      }
    }
  }

  const normalize = (s: string) =>
    s.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")

  // Check for existing combo registration (dedup)
  if (status === "confirmed") {
    const existingAttendees = await db
      .select()
      .from(attendees)
      .where(and(eq(attendees.combo_id, combo_id), eq(attendees.status, "confirmed")))

    const existingForUser = existingAttendees.filter(
      (a) => normalize(a.full_name) === normalize(full_name)
    )

    if (existingForUser.length > 0) {
      // Already registered via this combo — recalculate price if unpaid
      const anyUnpaid = existingForUser.some((a) => a.payment_status !== "paid")
      let currentComboPrice = existingForUser.reduce((sum, a) => sum + Number(a.price_paid || 0), 0)

      if (anyUnpaid && combo.date_tiers && combo.date_tiers.length > 0) {
        const recalculated = calculateDatePrice(combo.date_tiers, combo.payment_amount)
        currentComboPrice = recalculated
        const pricePerEvent = Math.round((recalculated / linkedEvents.length) * 100) / 100
        // Update all attendee records with new price
        for (const a of existingForUser) {
          if (a.payment_status !== "paid") {
            await db.update(attendees).set({ price_paid: String(pricePerEvent) }).where(eq(attendees.id, a.id))
          }
        }
      }

      return NextResponse.json({
        attendees: existingForUser,
        combo_price: currentComboPrice,
        payment_account: combo.payment_account,
        payment_amount: String(currentComboPrice),
        whatsapp_number: combo.whatsapp_number,
        combo_title: combo.title,
        existing: true,
        already_paid: existingForUser.every((a) => a.payment_status === "paid"),
      })
    }

    // Check if already registered individually for any event
    for (const event of linkedEvents) {
      const existing = await db
        .select()
        .from(attendees)
        .where(and(eq(attendees.event_id, event.id), eq(attendees.status, "confirmed")))

      const match = existing.find((a) => normalize(a.full_name) === normalize(full_name))
      if (match) {
        return NextResponse.json(
          { error: `Ya estas anotado para "${event.title}" por separado. Contacta al admin para gestionar el combo.` },
          { status: 409 }
        )
      }
    }
  }

  // Calculate combo price
  const comboPrice = status === "confirmed"
    ? calculateDatePrice(combo.date_tiers, combo.payment_amount)
    : 0
  const pricePerEvent = status === "confirmed"
    ? Math.round((comboPrice / linkedEvents.length) * 100) / 100
    : 0

  // Create one attendee per event in a batch
  const createdAttendees = []
  for (const event of linkedEvents) {
    const [attendee] = await db
      .insert(attendees)
      .values({
        event_id: event.id,
        combo_id: combo.id,
        full_name: full_name?.trim() || "Anonimo",
        status,
        payment_status: "pending",
        price_paid: status === "confirmed" ? String(pricePerEvent) : null,
      })
      .returning()
    createdAttendees.push(attendee)
  }

  if (status === "confirmed") {
    const eventNames = linkedEvents.map((e) => e.title).join(" + ")
    await notifyAdminWhatsApp(
      `Nuevo combo! ${full_name.trim()} se anoto al combo "${combo.title}" (${eventNames})`
    )
  }

  return NextResponse.json({
    attendees: createdAttendees,
    combo_price: comboPrice,
    payment_account: combo.payment_account,
    payment_amount: String(comboPrice),
    whatsapp_number: combo.whatsapp_number,
    combo_title: combo.title,
  }, { status: 201 })
}
