import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { attendees } from "@/db/schema"
import { eq, and, inArray } from "drizzle-orm"
import { normalizePhone } from "@/lib/people"
import { findPeopleByPhone } from "@/lib/people-db"

/**
 * API pública: quién se anotó antes con este celular y, si se pasa un evento,
 * si ya está anotado ahí. La usa el teléfono que recuerda su número.
 * Solo devuelve el nombre con el que cada Persona figuró: nunca nombres reales ni otros celulares.
 */
export async function POST(request: NextRequest) {
  const { event_id, phone } = await request.json()

  const normalized = normalizePhone(typeof phone === "string" ? phone : null)
  if (!normalized) {
    return NextResponse.json(
      { error: "Ese celular no parece válido. Escribilo con código de área, por ejemplo 11 5555-1234." },
      { status: 400 }
    )
  }

  const found = await findPeopleByPhone(normalized)

  const attendeeByPerson = new Map<string, { id: string; full_name: string; payment_status: string }>()
  if (event_id && found.length > 0) {
    const rows = await db
      .select({
        id: attendees.id,
        person_id: attendees.person_id,
        full_name: attendees.full_name,
        payment_status: attendees.payment_status,
      })
      .from(attendees)
      .where(and(
        eq(attendees.event_id, event_id),
        eq(attendees.status, "confirmed"),
        inArray(attendees.person_id, found.map((p) => p.id)),
      ))
    for (const r of rows) {
      if (r.person_id) attendeeByPerson.set(r.person_id, { id: r.id, full_name: r.full_name, payment_status: r.payment_status })
    }
  }

  return NextResponse.json({
    phone: normalized,
    people: found.map((p) => ({ ...p, attendee: attendeeByPerson.get(p.id) ?? null })),
  })
}
