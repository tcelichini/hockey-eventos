import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { attendees, combos, events, people, personPhones, type Attendee, type Combo, type Event } from "@/db/schema"
import { eq, and, inArray } from "drizzle-orm"
import { notifyAdminWhatsApp } from "@/lib/whatsapp-notify"
import { calculateDatePrice } from "@/lib/pricing"
import { normalizeName } from "@/lib/settlement"
import { normalizePhone, decideComboRegistration } from "@/lib/people"
import { findPeopleByPhone } from "@/lib/people-db"
import { publicAttendee } from "@/lib/attendee-registration"

/**
 * Datos de pago de alguien que ya está anotado al combo. Si sigue pendiente y el combo
 * tiene precio por fecha, recalcula al tramo de hoy y lo guarda.
 */
async function existingComboPayload(combo: Combo, linkedEvents: Event[], existingForUser: Attendee[]) {
  const anyUnpaid = existingForUser.some((a) => a.payment_status === "pending")
  let currentComboPrice = existingForUser.reduce((sum, a) => sum + Number(a.price_paid || 0), 0)

  if (anyUnpaid && combo.date_tiers && combo.date_tiers.length > 0) {
    const recalculated = calculateDatePrice(combo.date_tiers, combo.payment_amount)
    currentComboPrice = recalculated
    const pricePerEvent = Math.round((recalculated / linkedEvents.length) * 100) / 100
    for (const a of existingForUser) {
      if (a.payment_status === "pending") {
        await db.update(attendees).set({ price_paid: String(pricePerEvent) }).where(eq(attendees.id, a.id))
      }
    }
  }

  return {
    attendees: existingForUser.map(publicAttendee),
    combo_price: currentComboPrice,
    payment_account: combo.payment_account,
    payment_amount: String(currentComboPrice),
    whatsapp_number: combo.whatsapp_number,
    combo_title: combo.title,
    existing: true,
    already_paid: existingForUser.every((a) => a.payment_status !== "pending"),
  }
}

/** Error si algún evento del combo está cerrado o lleno (solo para anotaciones nuevas). */
function closedOrFullError(linkedEvents: Event[], confirmedByEvent: Map<string, Attendee[]>): string | null {
  for (const event of linkedEvents) {
    if (!event.is_open) return `El evento "${event.title}" tiene las inscripciones cerradas`
    if (event.max_capacity && (confirmedByEvent.get(event.id)?.length ?? 0) >= event.max_capacity) {
      return `El evento "${event.title}" esta completo`
    }
  }
  return null
}

function comboPricing(combo: Combo, linkedEvents: Event[]) {
  const comboPrice = calculateDatePrice(combo.date_tiers, combo.payment_amount)
  const pricePerEvent = Math.round((comboPrice / linkedEvents.length) * 100) / 100
  return { comboPrice, pricePerEvent }
}

function newComboPayload(combo: Combo, created: Attendee[], comboPrice: number) {
  return {
    attendees: created.map(publicAttendee),
    combo_price: comboPrice,
    payment_account: combo.payment_account,
    payment_amount: String(comboPrice),
    whatsapp_number: combo.whatsapp_number,
    combo_title: combo.title,
  }
}

/**
 * Anotarse a un combo que tiene eventos que piden celular (ver "Personas" en CONTEXT.md):
 * una anotación por evento, todas ligadas a la misma Persona.
 * Qué hacer lo decide lib/people.ts (decideComboRegistration); acá solo se lee y se aplica.
 */
async function registerComboWithPhone({
  combo,
  linkedEvents,
  confirmedByEvent,
  fullName,
  phone,
  personId,
}: {
  combo: Combo
  linkedEvents: Event[]
  confirmedByEvent: Map<string, Attendee[]>
  fullName: string
  phone: unknown
  personId: unknown
}) {
  const normalized = normalizePhone(typeof phone === "string" ? phone : null)
  const peopleForPhone = normalized ? await findPeopleByPhone(normalized) : []
  const decision = decideComboRegistration({
    name: fullName,
    phone: normalized,
    personId: typeof personId === "string" ? personId : undefined,
    peopleForPhone,
    comboId: combo.id,
    events: linkedEvents.map((ev) => ({ id: ev.id, title: ev.title, attendees: confirmedByEvent.get(ev.id) ?? [] })),
  })

  switch (decision.kind) {
    case "invalid":
      return NextResponse.json({ error: decision.error }, { status: 400 })
    case "name-taken":
    case "separate":
      return NextResponse.json({ error: decision.error }, { status: 409 })
    case "choose":
      return NextResponse.json({ choose: decision.options, phone: normalized }, { status: 200 })
    case "already": {
      const ids = new Set(decision.attendeeIds)
      const existing = Array.from(confirmedByEvent.values()).flat().filter((a) => ids.has(a.id))
      return NextResponse.json({ ...(await existingComboPayload(combo, linkedEvents, existing)), phone: normalized }, { status: 200 })
    }
  }

  const blocked = closedOrFullError(linkedEvents, confirmedByEvent)
  if (blocked) return NextResponse.json({ error: blocked }, { status: 409 })

  const { comboPrice, pricePerEvent } = comboPricing(combo, linkedEvents)
  const name = fullName.trim()

  // Persona nueva + anotaciones en una sola transacción: si falla una, no queda nada a medias
  const created = await db.transaction(async (tx) => {
    let finalPersonId = decision.personId
    if (!finalPersonId) {
      const [person] = await tx.insert(people).values({ real_name: null }).returning()
      await tx.insert(personPhones).values({ person_id: person.id, phone: normalized! })
      finalPersonId = person.id
    }
    return tx
      .insert(attendees)
      .values(
        linkedEvents.map((event) => ({
          event_id: event.id,
          combo_id: combo.id,
          person_id: finalPersonId,
          full_name: name,
          status: "confirmed" as const,
          payment_status: "pending" as const,
          price_paid: String(pricePerEvent),
        }))
      )
      .returning()
  })

  const eventNames = linkedEvents.map((e) => e.title).join(" + ")
  await notifyAdminWhatsApp(`Nuevo combo! ${name} se anoto al combo "${combo.title}" (${eventNames})`)

  return NextResponse.json({ ...newComboPayload(combo, created, comboPrice), phone: normalized }, { status: 201 })
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { combo_id, full_name, status, phone, person_id } = body

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

  const confirmedRows = await db
    .select()
    .from(attendees)
    .where(and(inArray(attendees.event_id, combo.event_ids), eq(attendees.status, "confirmed")))
  const confirmedByEvent = new Map<string, Attendee[]>(linkedEvents.map((ev) => [ev.id, []]))
  for (const a of confirmedRows) confirmedByEvent.get(a.event_id)?.push(a)

  // Combo con eventos que piden celular (salvo 3T: ahí el plantel ya está cargado y se elige el nombre de la lista)
  const asksPhone = linkedEvents.some((e) => e.requires_phone) && !linkedEvents.every((e) => e.is_3t)
  if (status === "confirmed" && asksPhone && phone) {
    return registerComboWithPhone({ combo, linkedEvents, confirmedByEvent, fullName: full_name, phone, personId: person_id })
  }

  // Check for existing combo registration FIRST — existing users can always
  // access their payment data / upload proof even if an event closed
  if (status === "confirmed") {
    const existingForUser = confirmedRows.filter(
      (a) => a.combo_id === combo_id && normalizeName(a.full_name) === normalizeName(full_name)
    )
    if (existingForUser.length > 0) {
      return NextResponse.json(await existingComboPayload(combo, linkedEvents, existingForUser))
    }
  }

  // Sin celular solo se llega hasta acá: ver los datos de pago de alguien ya anotado
  if (status === "confirmed" && asksPhone) {
    return NextResponse.json({ error: "Para anotarte hace falta tu celular" }, { status: 400 })
  }

  if (status === "confirmed") {
    // Check all events are open and have capacity (only for NEW registrations)
    const blocked = closedOrFullError(linkedEvents, confirmedByEvent)
    if (blocked) return NextResponse.json({ error: blocked }, { status: 409 })

    // Check if already registered individually for any event
    for (const event of linkedEvents) {
      const match = confirmedByEvent.get(event.id)?.find((a) => normalizeName(a.full_name) === normalizeName(full_name))
      if (match) {
        return NextResponse.json(
          { error: `Ya estas anotado para "${event.title}" por separado. Contacta al admin para gestionar el combo.` },
          { status: 409 }
        )
      }
    }
  }

  const { comboPrice, pricePerEvent } = status === "confirmed" ? comboPricing(combo, linkedEvents) : { comboPrice: 0, pricePerEvent: 0 }

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

  return NextResponse.json(newComboPayload(combo, createdAttendees, comboPrice), { status: 201 })
}
