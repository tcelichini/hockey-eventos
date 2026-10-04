import { db } from "@/db"
import { people, personPhones, attendees } from "@/db/schema"
import { eq, and, inArray, desc, isNotNull } from "drizzle-orm"
import type { PersonRef } from "@/lib/people"

/** Una Persona como la ve el admin. */
export type DirectoryPerson = {
  id: string
  realName: string | null
  team: string | null
  phones: string[]
  /** Nombres con los que figuró en eventos, del más viejo al más nuevo, sin repetir. */
  names: string[]
  eventCount: number
}

/** Todas las Personas con sus celulares y los nombres que usaron (solo para pantallas de admin). */
export async function getPeopleDirectory(): Promise<DirectoryPerson[]> {
  const [peopleRows, phoneRows, attendeeRows] = await Promise.all([
    db.select().from(people).orderBy(people.created_at),
    db.select().from(personPhones).orderBy(personPhones.created_at),
    db
      .select({ person_id: attendees.person_id, full_name: attendees.full_name })
      .from(attendees)
      .where(and(isNotNull(attendees.person_id), eq(attendees.status, "confirmed")))
      .orderBy(attendees.created_at),
  ])

  const directory = new Map<string, DirectoryPerson>(
    peopleRows.map((p) => [p.id, { id: p.id, realName: p.real_name, team: p.team, phones: [], names: [], eventCount: 0 }])
  )
  for (const ph of phoneRows) directory.get(ph.person_id)?.phones.push(ph.phone)
  for (const a of attendeeRows) {
    const person = a.person_id ? directory.get(a.person_id) : undefined
    if (!person) continue
    person.eventCount++
    if (!person.names.includes(a.full_name)) person.names.push(a.full_name)
  }
  return Array.from(directory.values())
}

/** Último nombre con el que figuró cada Persona: el de su anotación más reciente. */
export async function latestNamesByPerson(personIds: string[]): Promise<Map<string, string>> {
  const names = new Map<string, string>()
  if (personIds.length === 0) return names
  const rows = await db
    .select({ person_id: attendees.person_id, full_name: attendees.full_name })
    .from(attendees)
    .where(inArray(attendees.person_id, personIds))
    .orderBy(desc(attendees.created_at))
  for (const r of rows) {
    if (r.person_id && !names.has(r.person_id)) names.set(r.person_id, r.full_name)
  }
  return names
}

/** Personas que tienen ese celular (ya normalizado), con el nombre con el que se las reconoce. */
export async function findPeopleByPhone(phone: string): Promise<PersonRef[]> {
  const rows = await db
    .select({ id: people.id, real_name: people.real_name })
    .from(personPhones)
    .innerJoin(people, eq(personPhones.person_id, people.id))
    .where(eq(personPhones.phone, phone))
    .orderBy(people.created_at)
  const names = await latestNamesByPerson(rows.map((r) => r.id))
  return rows.map((r) => ({ id: r.id, name: names.get(r.id) ?? r.real_name ?? "sin nombre" }))
}
