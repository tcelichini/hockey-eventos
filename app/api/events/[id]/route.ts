import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { events } from "@/db/schema"
import { eq } from "drizzle-orm"
import { COOKIE_NAME, verifySession } from "@/lib/auth"

async function authCheck(request: NextRequest) {
  const cookie = request.cookies.get(COOKIE_NAME)?.value
  return cookie ? await verifySession(cookie) : false
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await authCheck(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { title, description, date, flyer_url, payment_account, payment_amount, whatsapp_number, max_capacity, is_open, pricing_tiers, whatsapp_confirmation } = body

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
      max_capacity: max_capacity ? Number(max_capacity) : null,
      is_open: is_open !== undefined ? Boolean(is_open) : undefined,
      pricing_tiers: pricing_tiers !== undefined ? (pricing_tiers || null) : undefined,
      whatsapp_confirmation: whatsapp_confirmation !== undefined ? Boolean(whatsapp_confirmation) : undefined,
    })
    .where(eq(events.id, params.id))
    .returning()

  if (!updated) {
    return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 })
  }

  return NextResponse.json(updated)
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await authCheck(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [deleted] = await db
    .delete(events)
    .where(eq(events.id, params.id))
    .returning()

  if (!deleted) {
    return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
