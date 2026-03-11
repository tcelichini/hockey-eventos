import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { events } from "@/db/schema"
import { COOKIE_NAME, verifySession } from "@/lib/auth"
import { nanoid } from "nanoid"

export async function POST(request: NextRequest) {
  const cookie = request.cookies.get(COOKIE_NAME)?.value
  if (!cookie || !(await verifySession(cookie))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { title, description, date, payment_account, payment_amount, whatsapp_number, flyer_url } = body

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
    })
    .returning()

  return NextResponse.json(event, { status: 201 })
}
