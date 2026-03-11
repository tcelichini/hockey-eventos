import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { attendees } from "@/db/schema"
import { eq } from "drizzle-orm"
import { COOKIE_NAME, verifySession } from "@/lib/auth"

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const cookie = request.cookies.get(COOKIE_NAME)?.value
  if (!cookie || !(await verifySession(cookie))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { payment_status } = await request.json()
  if (!payment_status || !["pending", "paid"].includes(payment_status)) {
    return NextResponse.json({ error: "Estado de pago inválido" }, { status: 400 })
  }

  const [updated] = await db
    .update(attendees)
    .set({ payment_status })
    .where(eq(attendees.id, params.id))
    .returning()

  if (!updated) {
    return NextResponse.json({ error: "Asistente no encontrado" }, { status: 404 })
  }

  return NextResponse.json(updated)
}
