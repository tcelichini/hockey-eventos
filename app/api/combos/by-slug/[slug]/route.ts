import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { combos, events, attendees } from "@/db/schema"
import { eq, and, inArray, count } from "drizzle-orm"

export async function GET(_request: NextRequest, { params }: { params: { slug: string } }) {
  const [combo] = await db
    .select()
    .from(combos)
    .where(eq(combos.slug, params.slug))
    .limit(1)

  if (!combo) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  // Fetch linked events
  const linkedEvents = combo.event_ids.length > 0
    ? await db
        .select({
          id: events.id,
          title: events.title,
          date: events.date,
          is_open: events.is_open,
          max_capacity: events.max_capacity,
          is_3t: events.is_3t,
        })
        .from(events)
        .where(inArray(events.id, combo.event_ids))
    : []

  // Get confirmed count per event
  const eventsWithCounts = await Promise.all(
    linkedEvents.map(async (event) => {
      const [{ value: confirmedCount }] = await db
        .select({ value: count() })
        .from(attendees)
        .where(and(eq(attendees.event_id, event.id), eq(attendees.status, "confirmed")))
      return { ...event, confirmedCount: Number(confirmedCount) }
    })
  )

  // Detectar si es un combo 3T (todos los eventos son 3T)
  const is_3t = linkedEvents.length > 0 && linkedEvents.every((e) => e.is_3t)

  // Si es 3T, obtener la lista de jugadores pre-inscriptos al combo (únicos, ordenados)
  let players: string[] = []
  if (is_3t) {
    const comboAttendees = await db
      .select({ full_name: attendees.full_name })
      .from(attendees)
      .where(and(eq(attendees.combo_id, combo.id), eq(attendees.status, "confirmed")))

    const seen = new Set<string>()
    const uniqueNames: string[] = []
    for (const a of comboAttendees) {
      if (!seen.has(a.full_name)) {
        seen.add(a.full_name)
        uniqueNames.push(a.full_name)
      }
    }
    players = uniqueNames.sort((a, b) => a.localeCompare(b, "es"))
  }

  return NextResponse.json({ ...combo, events: eventsWithCounts, is_3t, players })
}
