import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { events, attendees, people } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { isAdminRequest } from "@/lib/auth"
import { normalizeName, isGuest } from "@/lib/settlement"
import { latestNamesByPerson } from "@/lib/people-db"
import { priceForNewAttendee, newAttendeePayload } from "@/lib/attendee-registration"

/**
 * Admin: agregar un asistente a un evento que pide celular (alguien que fue sin anotarse).
 * Con person_id se anota a esa Persona; sin él se crea una Persona nueva, sin celular.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { person_id, full_name } = await request.json()

  const [event] = await db.select().from(events).where(eq(events.id, params.id)).limit(1)
  if (!event) {
    return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 })
  }

  const confirmedAttendees = await db
    .select()
    .from(attendees)
    .where(and(eq(attendees.event_id, event.id), eq(attendees.status, "confirmed")))

  let name = typeof full_name === "string" ? full_name.trim() : ""

  if (person_id) {
    const [person] = await db.select().from(people).where(eq(people.id, person_id)).limit(1)
    if (!person) {
      return NextResponse.json({ error: "Persona no encontrada" }, { status: 404 })
    }
    if (confirmedAttendees.some((a) => a.person_id === person.id)) {
      return NextResponse.json({ error: "Esa Persona ya está anotada en este evento" }, { status: 409 })
    }
    if (!name) {
      name = person.real_name ?? (await latestNamesByPerson([person.id])).get(person.id) ?? ""
    }
  }

  if (!name) {
    return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 })
  }
  if (confirmedAttendees.some((a) => normalizeName(a.full_name) === normalizeName(name))) {
    return NextResponse.json({ error: `Ya hay un «${name}» anotado. Agregale algo para distinguirlo.` }, { status: 409 })
  }

  const payingCount = confirmedAttendees.filter((a) => !isGuest(a)).length
  const price = priceForNewAttendee(event, payingCount, false)

  const attendee = await db.transaction(async (tx) => {
    let finalPersonId: string = person_id
    if (!finalPersonId) {
      const [created] = await tx.insert(people).values({ real_name: null }).returning()
      finalPersonId = created.id
    }
    const [created] = await tx
      .insert(attendees)
      .values({
        event_id: event.id,
        person_id: finalPersonId,
        full_name: name,
        status: "confirmed",
        payment_status: "pending",
        price_paid: String(price),
      })
      .returning()
    return created
  })

  // Puede haber gastos cargados a su nombre antes de que lo agreguen: los descuenta y sincroniza el pago
  await newAttendeePayload(event, attendee, price)

  return NextResponse.json(attendee, { status: 201 })
}
