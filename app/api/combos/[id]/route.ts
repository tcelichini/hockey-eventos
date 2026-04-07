import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { combos } from "@/db/schema"
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
  const { title, description, event_ids, date_tiers, payment_amount, payment_account, whatsapp_number, whatsapp_confirmation, is_open } = body

  if (!title || !event_ids?.length || !payment_account || !payment_amount || !whatsapp_number) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 })
  }

  const [updated] = await db
    .update(combos)
    .set({
      title,
      description: description || null,
      event_ids,
      date_tiers: date_tiers !== undefined ? (date_tiers || null) : undefined,
      payment_amount: String(payment_amount),
      payment_account,
      whatsapp_number,
      whatsapp_confirmation: whatsapp_confirmation ?? false,
      is_open: is_open !== undefined ? Boolean(is_open) : undefined,
    })
    .where(eq(combos.id, params.id))
    .returning()

  if (!updated) {
    return NextResponse.json({ error: "Combo no encontrado" }, { status: 404 })
  }

  return NextResponse.json(updated)
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await authCheck(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [deleted] = await db
    .delete(combos)
    .where(eq(combos.id, params.id))
    .returning()

  if (!deleted) {
    return NextResponse.json({ error: "Combo no encontrado" }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
