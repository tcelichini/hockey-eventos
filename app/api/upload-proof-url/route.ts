import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { attendees } from "@/db/schema"
import { eq } from "drizzle-orm"

// Simple endpoint to copy an existing proof URL to another attendee
// Used when a combo payment proof needs to be applied to all linked attendees
export async function POST(request: NextRequest) {
  const { attendee_id, proof_url } = await request.json()

  if (!attendee_id || !proof_url) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 })
  }

  await db
    .update(attendees)
    .set({ payment_proof_url: proof_url, payment_status: "paid" })
    .where(eq(attendees.id, attendee_id))

  return NextResponse.json({ ok: true })
}
