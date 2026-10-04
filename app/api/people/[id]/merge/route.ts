import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { people, personPhones, attendees, events } from "@/db/schema"
import { eq, and, inArray } from "drizzle-orm"
import { isAdminRequest } from "@/lib/auth"
import { mergeConflicts } from "@/lib/people"

/**
 * Admin: fusionar esta Persona dentro de otra ({ into }). La otra se queda con los
 * celulares y las anotaciones de las dos; esta desaparece.
 */
export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { into } = await request.json()
  if (typeof into !== "string" || !into || into === params.id) {
    return NextResponse.json({ error: "Elegí con qué otra Persona fusionarla" }, { status: 400 })
  }

  const [source] = await db.select().from(people).where(eq(people.id, params.id)).limit(1)
  const [target] = await db.select().from(people).where(eq(people.id, into)).limit(1)
  if (!source || !target) {
    return NextResponse.json({ error: "Persona no encontrada" }, { status: 404 })
  }

  const confirmed = await db
    .select({ person_id: attendees.person_id, event_id: attendees.event_id })
    .from(attendees)
    .where(and(inArray(attendees.person_id, [source.id, target.id]), eq(attendees.status, "confirmed")))

  // Si las dos están anotadas en un mismo evento no se fusiona: cada anotación puede tener su pago y sus gastos.
  const conflicts = mergeConflicts(
    confirmed.filter((a) => a.person_id === source.id),
    confirmed.filter((a) => a.person_id === target.id),
  )
  if (conflicts.length > 0) {
    const titles = await db.select({ title: events.title }).from(events).where(inArray(events.id, conflicts))
    return NextResponse.json(
      {
        error: `Las dos están anotadas en ${titles.map((t) => `"${t.title}"`).join(", ")}. Quitá una de las dos anotaciones en ese evento y volvé a fusionar.`,
      },
      { status: 409 }
    )
  }

  await db.transaction(async (tx) => {
    await tx.update(attendees).set({ person_id: target.id }).where(eq(attendees.person_id, source.id))

    const sourcePhones = await tx.select().from(personPhones).where(eq(personPhones.person_id, source.id))
    if (sourcePhones.length > 0) {
      await tx
        .insert(personPhones)
        .values(sourcePhones.map((p) => ({ person_id: target.id, phone: p.phone })))
        .onConflictDoNothing()
    }

    // La que queda completa lo que le falte con los datos de la que desaparece
    if ((!target.real_name && source.real_name) || (!target.team && source.team)) {
      await tx
        .update(people)
        .set({ real_name: target.real_name ?? source.real_name, team: target.team ?? source.team })
        .where(eq(people.id, target.id))
    }

    await tx.delete(people).where(eq(people.id, source.id))
  })

  return NextResponse.json({ ok: true, id: target.id })
}
