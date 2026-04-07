import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { combos } from "@/db/schema"
import { eq } from "drizzle-orm"
import { COOKIE_NAME, verifySession } from "@/lib/auth"

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const cookie = request.cookies.get(COOKIE_NAME)?.value
  if (!cookie || !(await verifySession(cookie))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [combo] = await db.select({ is_open: combos.is_open }).from(combos).where(eq(combos.id, params.id)).limit(1)
  if (!combo) {
    return NextResponse.json({ error: "Combo no encontrado" }, { status: 404 })
  }

  const [updated] = await db
    .update(combos)
    .set({ is_open: !combo.is_open })
    .where(eq(combos.id, params.id))
    .returning()

  return NextResponse.json(updated)
}
