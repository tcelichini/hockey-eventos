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

  const { is_open } = await request.json()

  const [updated] = await db
    .update(events)
    .set({ is_open: Boolean(is_open) })
    .where(eq(events.id, params.id))
    .returning()

  if (!updated) {
    return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 })
  }

  return NextResponse.json(updated)
}
