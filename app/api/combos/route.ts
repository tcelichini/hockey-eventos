import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { combos, events, attendees } from "@/db/schema"
import { COOKIE_NAME, verifySession } from "@/lib/auth"
import { nanoid } from "nanoid"
import { inArray, eq, and, isNull } from "drizzle-orm"
import { calculateDatePrice } from "@/lib/pricing"

export async function POST(request: NextRequest) {
  const cookie = request.cookies.get(COOKIE_NAME)?.value
  if (!cookie || !(await verifySession(cookie))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { title, description, event_ids, date_tiers, payment_amount, payment_account, whatsapp_number, whatsapp_confirmation } = body

  if (!title || !event_ids?.length || !payment_account || !payment_amount || !whatsapp_number) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 })
  }

  const slug = nanoid(8)

  const [combo] = await db
    .insert(combos)
    .values({
      slug,
      title,
      description: description || null,
      event_ids,
      date_tiers: date_tiers || null,
      payment_amount: String(payment_amount),
      payment_account,
      whatsapp_number,
      whatsapp_confirmation: whatsapp_confirmation ?? false,
    })
    .returning()

  // Si todos los eventos del combo son 3T, pre-asignar combo_id a sus attendees existentes
  if (event_ids.length > 0) {
    const linkedEvents = await db
      .select()
      .from(events)
      .where(inArray(events.id, event_ids))

    const allAre3t = linkedEvents.length > 0 && linkedEvents.every((e) => e.is_3t)

    if (allAre3t) {
      const comboPrice = calculateDatePrice(date_tiers || null, payment_amount)
      const pricePerEvent = Math.round((comboPrice / linkedEvents.length) * 100) / 100

      // Actualizar attendees confirmados de esos eventos que todavía no tienen combo_id
      await db
        .update(attendees)
        .set({ combo_id: combo.id, price_paid: String(pricePerEvent) })
        .where(
          and(
            inArray(attendees.event_id, event_ids),
            eq(attendees.status, "confirmed"),
            isNull(attendees.combo_id)
          )
        )
    }
  }

  return NextResponse.json(combo, { status: 201 })
}
