import { NextRequest, NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { db } from "@/db"
import { expenses } from "@/db/schema"
import { eq } from "drizzle-orm"
import { COOKIE_NAME, verifySession } from "@/lib/auth"
import { syncExpensePayment } from "@/lib/sync-expense-payment"

async function authCheck(request: NextRequest) {
  const cookie = request.cookies.get(COOKIE_NAME)?.value
  return cookie ? await verifySession(cookie) : false
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await authCheck(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { description, responsible, amount, notes, payment_alias, receipt_url, settled } = body

  // Guardar el responsable anterior para sincronizar si cambia
  const [existing] = await db.select({ responsible: expenses.responsible, event_id: expenses.event_id })
    .from(expenses).where(eq(expenses.id, params.id)).limit(1)
  const prevResponsible = existing?.responsible

  const [updated] = await db
    .update(expenses)
    .set({
      ...(description !== undefined && { description: description.trim() }),
      ...(responsible !== undefined && { responsible: responsible.trim() }),
      ...(amount !== undefined && { amount: String(amount) }),
      ...(notes !== undefined && { notes: notes?.trim() || null }),
      ...(payment_alias !== undefined && { payment_alias: payment_alias?.trim() || null }),
      ...(receipt_url !== undefined && { receipt_url: receipt_url || null }),
      ...(settled !== undefined && { settled }),
    })
    .where(eq(expenses.id, params.id))
    .returning()

  if (!updated) {
    return NextResponse.json({ error: "Gasto no encontrado" }, { status: 404 })
  }

  await syncExpensePayment(updated.event_id, updated.responsible)
  if (prevResponsible && prevResponsible.trim().toLowerCase() !== updated.responsible.trim().toLowerCase()) {
    await syncExpensePayment(updated.event_id, prevResponsible)
  }

  revalidatePath(`/admin/events/${updated.event_id}`)
  revalidatePath(`/e`)

  return NextResponse.json(updated)
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await authCheck(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [deleted] = await db
    .delete(expenses)
    .where(eq(expenses.id, params.id))
    .returning()

  if (!deleted) {
    return NextResponse.json({ error: "Gasto no encontrado" }, { status: 404 })
  }

  await syncExpensePayment(deleted.event_id, deleted.responsible)

  revalidatePath(`/admin/events/${deleted.event_id}`)
  revalidatePath(`/e`)

  return NextResponse.json({ ok: true })
}
