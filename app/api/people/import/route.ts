import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { people, personPhones } from "@/db/schema"
import { eq } from "drizzle-orm"
import { isAdminRequest } from "@/lib/auth"
import { parseImportList, planImport } from "@/lib/people"
import { normalizeName } from "@/lib/settlement"

/**
 * Admin: importar una lista pegada de Personas (nombre real; plantel; celular).
 * Sin `apply` devuelve solo la vista previa de lo que haría cada fila.
 */
export async function POST(request: NextRequest) {
  if (!(await isAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { text, apply } = await request.json()
  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json({ error: "Pegá la lista a importar" }, { status: 400 })
  }

  const [peopleRows, phoneRows] = await Promise.all([db.select().from(people), db.select().from(personPhones)])
  const existing = peopleRows.map((p) => ({
    id: p.id,
    real_name: p.real_name,
    team: p.team,
    phones: phoneRows.filter((ph) => ph.person_id === p.id).map((ph) => ph.phone),
  }))

  const plan = planImport(parseImportList(text), existing)

  if (apply) {
    await db.transaction(async (tx) => {
      // Todas las altas en un solo INSERT, y todos los celulares en otro: de a una fila,
      // 74 personas son más de cien consultas y la importación tarda un minuto.
      const creates = plan.filter((row) => row.action === "create")
      const createdIds = new Map<string, string>()
      if (creates.length > 0) {
        const created = await tx
          .insert(people)
          .values(creates.map((row) => ({ real_name: row.realName, team: row.team })))
          .returning({ id: people.id, real_name: people.real_name })
        for (const person of created) {
          if (person.real_name) createdIds.set(normalizeName(person.real_name), person.id)
        }
      }

      const phoneRows: { person_id: string; phone: string }[] = []
      for (const row of plan) {
        if (row.action !== "create" && row.action !== "update") continue
        // Persona existente, o creada recién por esta misma lista
        const personId = row.personId ?? createdIds.get(normalizeName(row.realName))
        if (!personId) continue
        if (row.action === "update" && row.setTeam) {
          await tx.update(people).set({ team: row.team }).where(eq(people.id, personId))
        }
        if (row.phone && (row.action === "create" || row.addPhone)) {
          phoneRows.push({ person_id: personId, phone: row.phone })
        }
      }
      if (phoneRows.length > 0) {
        await tx.insert(personPhones).values(phoneRows).onConflictDoNothing()
      }
    })
  }

  return NextResponse.json({ applied: Boolean(apply), rows: plan })
}
