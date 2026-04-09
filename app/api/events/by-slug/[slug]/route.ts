import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { events, attendees } from "@/db/schema"
import { eq, and } from "drizzle-orm"

export async function GET(_request: NextRequest, { params }: { params: { slug: string } }) {
  const [event] = await db
    .select({
      id: events.id,
      title: events.title,
      payment_amount: events.payment_amount,
      payment_account: events.payment_account,
      whatsapp_number: events.whatsapp_number,
      whatsapp_confirmation: events.whatsapp_confirmation,
      pricing_tiers: events.pricing_tiers,
      date_tiers: events.date_tiers,
      is_3t: events.is_3t,
    })
    .from(events)
    .where(eq(events.slug, params.slug))
    .limit(1)

  if (!event) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const confirmedAttendeeRows = await db
    .select({ full_name: attendees.full_name })
    .from(attendees)
    .where(and(eq(attendees.event_id, event.id), eq(attendees.status, "confirmed")))

  const confirmedCount = confirmedAttendeeRows.length
  const attendeeNames = confirmedAttendeeRows.map((a) => a.full_name)

  return NextResponse.json({ ...event, confirmedCount, attendeeNames })
}
