import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { attendees, events } from "@/db/schema"
import { eq } from "drizzle-orm"

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { event_id, full_name, status } = body

  if (!event_id || !status || !["confirmed", "declined"].includes(status)) {
    return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })
  }

  if (status === "confirmed" && !full_name?.trim()) {
    return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 })
  }

  // Fetch event for payment info
  const [event] = await db.select().from(events).where(eq(events.id, event_id)).limit(1)
  if (!event) {
    return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 })
  }

  const [attendee] = await db
    .insert(attendees)
    .values({
      event_id,
      full_name: full_name?.trim() || "Anónimo",
      status,
      payment_status: "pending",
    })
    .returning()

  return NextResponse.json({
    attendee,
    payment_account: event.payment_account,
    payment_amount: event.payment_amount,
    whatsapp_number: event.whatsapp_number,
    event_title: event.title,
  }, { status: 201 })
}
