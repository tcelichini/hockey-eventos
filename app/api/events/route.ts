import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { events, attendees } from "@/db/schema"
import { COOKIE_NAME, verifySession } from "@/lib/auth"
import { nanoid } from "nanoid"
import { sql } from "drizzle-orm"
import { PLAYERS } from "@/lib/players"
import { calculateDatePrice, calculatePrice } from "@/lib/pricing"

export async function GET() {
  const eventList = await db
    .select({ id: events.id, title: events.title, date: events.date, slug: events.slug })
    .from(events)
    .orderBy(sql`${events.date} ASC`)
  return NextResponse.json(eventList)
}

export async function POST(request: NextRequest) {
  const cookie = request.cookies.get(COOKIE_NAME)?.value
  if (!cookie || !(await verifySession(cookie))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { title, description, date, payment_account, payment_amount, whatsapp_number, flyer_url, max_capacity, pricing_tiers, date_tiers, whatsapp_confirmation, is_3t } = body

  if (!title || !date || !payment_account || !payment_amount || !whatsapp_number) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 })
  }

  const slug = nanoid(8)

  const [event] = await db
    .insert(events)
    .values({
      slug,
      title,
      description: description || null,
      date: new Date(date),
      flyer_url: flyer_url || null,
      payment_account,
      payment_amount: String(payment_amount),
      whatsapp_number,
      max_capacity: max_capacity ? Number(max_capacity) : null,
      pricing_tiers: pricing_tiers || null,
      date_tiers: date_tiers || null,
      whatsapp_confirmation: whatsapp_confirmation ?? false,
      is_3t: is_3t ?? false,
    })
    .returning()

  // Si es evento 3T, pre-cargar todos los jugadores del plantel como asistentes confirmados
  if (event.is_3t && PLAYERS.length > 0) {
    const price = event.date_tiers && event.date_tiers.length > 0
      ? calculateDatePrice(event.date_tiers, event.payment_amount)
      : calculatePrice(event.pricing_tiers, event.payment_amount, 0)

    await db.insert(attendees).values(
      PLAYERS.map((playerName) => ({
        event_id: event.id,
        full_name: playerName,
        status: "confirmed" as const,
        payment_status: "pending" as const,
        price_paid: String(price),
      }))
    )
  }

  return NextResponse.json(event, { status: 201 })
}
