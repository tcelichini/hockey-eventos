import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { people, personPhones, attendees } from "@/db/schema"
import { eq } from "drizzle-orm"
import { isAdminRequest } from "@/lib/auth"
import { normalizePhone } from "@/lib/people"

// Admin: editar nombre real, plantel y celulares de una Persona
export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { real_name, team, phones } = body

  if (team !== undefined && team !== null && team !== "A" && team !== "B") {
    return NextResponse.json({ error: "Plantel inválido" }, { status: 400 })
  }

  // phones reemplaza el conjunto completo de celulares de la Persona
  let normalizedPhones: string[] | undefined
  if (phones !== undefined) {
    if (!Array.isArray(phones)) {
      return NextResponse.json({ error: "Celulares inválidos" }, { status: 400 })
    }
    normalizedPhones = []
    for (const p of phones) {
      const normalized = normalizePhone(typeof p === "string" ? p : null)
      if (!normalized) {
        return NextResponse.json({ error: `El celular "${p}" no parece válido` }, { status: 400 })
      }
      if (!normalizedPhones.includes(normalized)) normalizedPhones.push(normalized)
    }
  }

  const updated = await db.transaction(async (tx) => {
    const [person] = await tx
      .update(people)
      .set({
        real_name: real_name !== undefined ? (String(real_name ?? "").trim() || null) : undefined,
        team: team !== undefined ? team : undefined,
      })
      .where(eq(people.id, params.id))
      .returning()
    if (!person) return null

    if (normalizedPhones) {
      await tx.delete(personPhones).where(eq(personPhones.person_id, params.id))
      if (normalizedPhones.length > 0) {
        await tx.insert(personPhones).values(normalizedPhones.map((phone) => ({ person_id: params.id, phone })))
      }
    }
    return person
  })

  if (!updated) {
    return NextResponse.json({ error: "Persona no encontrada" }, { status: 404 })
  }

  return NextResponse.json(updated)
}

// Admin: borrar una Persona que no está anotada a nada (por ejemplo, una importada por error)
export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [registered] = await db
    .select({ id: attendees.id })
    .from(attendees)
    .where(eq(attendees.person_id, params.id))
    .limit(1)
  if (registered) {
    return NextResponse.json(
      { error: "Esta Persona está anotada en eventos. Fusionala con otra en vez de borrarla." },
      { status: 409 }
    )
  }

  const [deleted] = await db.delete(people).where(eq(people.id, params.id)).returning()
  if (!deleted) {
    return NextResponse.json({ error: "Persona no encontrada" }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
