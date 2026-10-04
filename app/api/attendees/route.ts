import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { attendees, events, combos, people, personPhones, type Event, type Attendee } from "@/db/schema"
import { eq, and, inArray } from "drizzle-orm"
import { notifyAdminWhatsApp } from "@/lib/whatsapp-notify"
import { normalizeName, isGuest } from "@/lib/settlement"
import { normalizePhone, decideRegistration } from "@/lib/people"
import { findPeopleByPhone } from "@/lib/people-db"
import {
  existingAttendeePayload,
  newAttendeePayload,
  priceForNewAttendee,
  publicAttendee,
} from "@/lib/attendee-registration"

const CLOSED_ERROR = "Las inscripciones para este evento están cerradas"
const FULL_ERROR = "El evento está completo, no hay más lugares disponibles"

/**
 * Anotarse a un evento que pide celular (ver "Personas" en CONTEXT.md).
 * Qué hacer lo decide lib/people.ts (decideRegistration); acá solo se lee y se aplica.
 */
async function registerWithPhone({
  event,
  confirmedAttendees,
  fullName,
  phone,
  personId,
  isInferiores,
}: {
  event: Event
  confirmedAttendees: Attendee[]
  fullName: string
  phone: unknown
  personId: unknown
  isInferiores: boolean
}) {
  const normalized = normalizePhone(typeof phone === "string" ? phone : null)
  const peopleForPhone = normalized ? await findPeopleByPhone(normalized) : []
  const decision = decideRegistration({
    name: fullName,
    phone: normalized,
    personId: typeof personId === "string" ? personId : undefined,
    peopleForPhone,
    eventAttendees: confirmedAttendees,
  })

  switch (decision.kind) {
    case "invalid":
      return NextResponse.json({ error: decision.error }, { status: 400 })
    case "name-taken":
      return NextResponse.json({ error: decision.error }, { status: 409 })
    case "choose":
      return NextResponse.json({ choose: decision.options, phone: normalized }, { status: 200 })
    case "already": {
      const existing = confirmedAttendees.find((a) => a.id === decision.attendeeId)!
      return NextResponse.json({ ...(await existingAttendeePayload(event, existing)), phone: normalized }, { status: 200 })
    }
  }

  // Anotación nueva: mismas reglas de cierre y cupo que el resto de los eventos
  if (!event.is_open) {
    return NextResponse.json({ error: CLOSED_ERROR }, { status: 409 })
  }
  if (event.max_capacity && confirmedAttendees.length >= event.max_capacity) {
    return NextResponse.json({ error: FULL_ERROR }, { status: 409 })
  }

  const payingCount = confirmedAttendees.filter((a) => !isGuest(a)).length
  const price = priceForNewAttendee(event, payingCount, isInferiores)
  const name = fullName.trim()

  // Persona nueva + anotación en una sola transacción: si falla la anotación no queda una Persona suelta
  const attendee = await db.transaction(async (tx) => {
    let finalPersonId = decision.personId
    if (!finalPersonId) {
      const [person] = await tx.insert(people).values({ real_name: null }).returning()
      await tx.insert(personPhones).values({ person_id: person.id, phone: normalized! })
      finalPersonId = person.id
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
        is_inferiores: isInferiores,
      })
      .returning()
    return created
  })

  await notifyAdminWhatsApp(`Nueva confirmacion! ${name} se anoto para "${event.title}"`)

  return NextResponse.json({ ...(await newAttendeePayload(event, attendee, price)), phone: normalized }, { status: 201 })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { event_id, full_name, status, is_inferiores, phone, person_id } = body

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

  // Fetch confirmed attendees (used for dedup, capacity check, and pricing tiers)
  const confirmedAttendees = await db
    .select()
    .from(attendees)
    .where(and(eq(attendees.event_id, event_id), eq(attendees.status, "confirmed")))

  const confirmedCount = confirmedAttendees.length
  // Precio por cantidad: los invitados no pagan, así que no bajan el precio del resto
  const payingCount = confirmedAttendees.filter((a) => !isGuest(a)).length

  // Evento que pide celular (no 3T: ahí el plantel ya está cargado y se elige el nombre de la lista)
  const asksPhone = event.requires_phone && !event.is_3t
  if (status === "confirmed" && asksPhone && phone) {
    return registerWithPhone({
      event,
      confirmedAttendees,
      fullName: full_name,
      phone,
      personId: person_id,
      isInferiores: !!is_inferiores,
    })
  }

  // Check for existing registration BEFORE is_open check,
  // so already-confirmed attendees can still access payment info and upload receipts
  if (status === "confirmed") {
    const existing = confirmedAttendees.find(
      (a) => normalizeName(a.full_name) === normalizeName(full_name)
    )

    if (existing) {
      return NextResponse.json(await existingAttendeePayload(event, existing), { status: 200 })
    }
  }

  // Sin celular solo se llega hasta acá: elegir un nombre de la lista para ver sus datos de pago
  if (status === "confirmed" && asksPhone) {
    return NextResponse.json({ error: "Para anotarte hace falta tu celular" }, { status: 400 })
  }

  // Block new registrations if event is closed
  if (status === "confirmed" && !event.is_open) {
    return NextResponse.json({ error: CLOSED_ERROR }, { status: 409 })
  }

  // Check capacity
  if (status === "confirmed" && event.max_capacity) {
    if (confirmedCount >= event.max_capacity) {
      return NextResponse.json({ error: FULL_ERROR }, { status: 409 })
    }
  }

  // Calculate price based on tiers (by quantity or by date)
  // Inferiores always pay the flat inferiores_price (only for non-3T events)
  const price = status === "confirmed" ? priceForNewAttendee(event, payingCount, !!is_inferiores) : 0

  const [attendee] = await db
    .insert(attendees)
    .values({
      event_id,
      full_name: full_name?.trim() || "Anónimo",
      status,
      payment_status: "pending",
      price_paid: status === "confirmed" ? String(price) : null,
      is_inferiores: !!is_inferiores,
    })
    .returning()

  if (status === "confirmed") {
    await notifyAdminWhatsApp(
      `Nueva confirmacion! ${full_name.trim()} se anoto para "${event.title}"`
    )

    // Auto-vincular al combo: si este evento pertenece a un combo y la persona
    // ya está inscripta en TODOS los otros eventos del combo, setear combo_id en todos sus registros.
    const allCombos = await db.select().from(combos)
    const relevantCombos = allCombos.filter(c => c.event_ids.includes(event_id))

    for (const combo of relevantCombos) {
      const otherEventIds = combo.event_ids.filter(eid => eid !== event_id)
      if (otherEventIds.length === 0) continue

      const otherAttendees = await db
        .select()
        .from(attendees)
        .where(and(
          inArray(attendees.event_id, otherEventIds),
          eq(attendees.status, "confirmed"),
        ))

      const personOtherRecords = otherAttendees.filter(
        a => normalizeName(a.full_name) === normalizeName(full_name)
      )

      const coveredEventIds = new Set(personOtherRecords.map(a => a.event_id))
      const allCovered = otherEventIds.every(eid => coveredEventIds.has(eid))

      if (allCovered) {
        const idsToUpdate = [attendee.id, ...personOtherRecords.map(a => a.id)]
        await db
          .update(attendees)
          .set({ combo_id: combo.id })
          .where(inArray(attendees.id, idsToUpdate))
      }
    }

    return NextResponse.json(await newAttendeePayload(event, attendee, price), { status: 201 })
  }

  return NextResponse.json({
    attendee: publicAttendee(attendee),
    payment_account: event.payment_account,
    payment_amount: String(price),
    expenses_total: "0",
    amount_due: "0",
    whatsapp_number: event.whatsapp_number,
    event_title: event.title,
  }, { status: 201 })
}
