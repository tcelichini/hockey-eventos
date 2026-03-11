import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { events } from "@/db/schema"
import { eq } from "drizzle-orm"
import { COOKIE_NAME, verifySession } from "@/lib/auth"

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const cookie = request.cookies.get(COOKIE_NAME)?.value
  if (!cookie || !(await verifySession(cookie))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { title, description, date, flyer_url, payment_account, payment_amount, whatsapp_number } = body

  if (!title || !date || !payment_account || !payment_amount || !whatsapp_number) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 })
  }

  const [updated] = await db
    .update(events)
    .set({
      title,
      description: description || null,
      date: new Date(date),
      flyer_url: flyer_url !== undefined ? (flyer_url || null) : undefined,
      payment_account,
      payment_amount: String(payment_amount),
      whatsapp_number,
    })
    .where(eq(events.id, params.id))
    .returning()

  if (!updated) {
    return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 })
  }

  return NextResponse.json(updated)
}
