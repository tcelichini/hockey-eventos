import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { expenses, events } from "@/db/schema"
import { eq } from "drizzle-orm"

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { event_id, description, responsible, amount, notes } = body

  if (!event_id || !description?.trim() || !responsible?.trim() || !amount) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 })
  }

  const [event] = await db.select({ id: events.id }).from(events).where(eq(events.id, event_id)).limit(1)
  if (!event) {
    return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 })
  }

  const [expense] = await db
    .insert(expenses)
    .values({
      event_id,
      description: description.trim(),
      responsible: responsible.trim(),
      amount: String(amount),
      notes: notes?.trim() || null,
    })
    .returning()

  return NextResponse.json(expense, { status: 201 })
}
