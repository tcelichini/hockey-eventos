import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { combos } from "@/db/schema"
import { COOKIE_NAME, verifySession } from "@/lib/auth"
import { nanoid } from "nanoid"

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

  return NextResponse.json(combo, { status: 201 })
}
