import { db } from "@/db"
import { events } from "@/db/schema"
import { and, eq, inArray } from "drizzle-orm"

/**
 * Los combos anotan por nombre, así que un evento que pide celular todavía no puede
 * ir en un combo (primera versión de Personas, ver docs/PENDIENTES.md).
 */
export async function eventsRequiringPhone(eventIds: string[]): Promise<string[]> {
  if (!Array.isArray(eventIds) || eventIds.length === 0) return []
  const rows = await db
    .select({ title: events.title })
    .from(events)
    .where(and(inArray(events.id, eventIds), eq(events.requires_phone, true)))
  return rows.map((r) => r.title)
}

export function phoneEventsError(titles: string[]): string {
  return `${titles.map((t) => `"${t}"`).join(", ")} pide${titles.length > 1 ? "n" : ""} celular al anotarse y todavía no puede${titles.length > 1 ? "n" : ""} ir en un combo.`
}
