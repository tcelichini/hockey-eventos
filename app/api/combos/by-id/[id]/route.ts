import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { combos } from "@/db/schema"
import { eq } from "drizzle-orm"

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  const [combo] = await db
    .select()
    .from(combos)
    .where(eq(combos.id, params.id))
    .limit(1)

  if (!combo) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json(combo)
}
