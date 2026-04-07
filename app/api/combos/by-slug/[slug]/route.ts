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

  return NextResponse.json({ ...combo, events: eventsWithCounts })
}
