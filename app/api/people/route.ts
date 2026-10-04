import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { people, personPhones } from "@/db/schema"
import { isAdminRequest } from "@/lib/auth"
import { normalizePhone } from "@/lib/people"

// Admin: crear una Persona a mano (el celular es opcional)
export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { real_name, team, phone } = await request.json()

  const realName = typeof real_name === "string" ? real_name.trim() : ""
  if (!realName) {
    return NextResponse.json({ error: "El nombre es requerido" }, { status: 400 })
  }
  if (team != null && team !== "A" && team !== "B") {
    return NextResponse.json({ error: "Plantel inválido" }, { status: 400 })
  }
  const normalized = phone ? normalizePhone(phone) : null
  if (phone && !normalized) {
    return NextResponse.json({ error: "Ese celular no parece válido" }, { status: 400 })
  }

  const person = await db.transaction(async (tx) => {
    const [created] = await tx.insert(people).values({ real_name: realName, team: team ?? null }).returning()
    if (normalized) await tx.insert(personPhones).values({ person_id: created.id, phone: normalized })
    return created
  })

  return NextResponse.json(person, { status: 201 })
}
