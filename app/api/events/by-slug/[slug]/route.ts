import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { events } from "@/db/schema"
import { eq } from "drizzle-orm"

export async function GET(_request: NextRequest, { params }: { params: { slug: string } }) {
  const [event] = await db
    .select({
      id: events.id,
      title: events.title,
      payment_amount: events.payment_amount,
      payment_account: events.payment_account,
      whatsapp_number: events.whatsapp_number,
    })
    .from(events)
    .where(eq(events.slug, params.slug))
    .limit(1)

  if (!event) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json(event)
}
