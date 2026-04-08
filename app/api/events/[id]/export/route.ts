import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { events, attendees } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { COOKIE_NAME, verifySession } from "@/lib/auth"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const cookie = request.cookies.get(COOKIE_NAME)?.value
  if (!cookie || !(await verifySession(cookie))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [event] = await db.select().from(events).where(eq(events.id, params.id)).limit(1)
  if (!event) {
    return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 })
  }

  const attendeeList = await db
    .select()
    .from(attendees)
    .where(and(eq(attendees.event_id, params.id), eq(attendees.status, "confirmed")))
    .orderBy(attendees.created_at)

  const amount = Number(event.payment_amount) || 0
  const BOM = "\uFEFF"
  const header = "Nombre,Monto,Estado de pago,Fecha de confirmación"
  const rows = attendeeList.map((a) => {
    const name = `"${a.full_name.replace(/"/g, '""')}"`
    const price = Number(a.price_paid) || amount
    const payment = a.payment_status === "paid" ? "Pagó" : "Pendiente"
    const date = new Intl.DateTimeFormat("es-AR", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Argentina/Buenos_Aires",
    }).format(new Date(a.created_at!))
    return `${name},${price},${payment},${date}`
  })

  const csv = BOM + [header, ...rows].join("\n")

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="asistentes-${event.slug}.csv"`,
    },
  })
}
