import type { Settlement } from "@/lib/settlement"
import { normalizeName } from "@/lib/settlement"

/**
 * Cuenta corriente por jugador (ver CONTEXT.md): saldo consolidado de una
 * persona across eventos. Solo entra lo que falta mover de plata — eventos
 * ya pagados y gastos ya devueltos (settled) no suman.
 *
 * Función pura: recibe las liquidaciones por evento (output de settleEvent)
 * y las consolida por Persona cuando el asistente tiene una, o por nombre
 * (normalizeName) cuando no: historial, eventos que no piden celular y
 * quienes adelantaron gastos sin ser asistentes.
 *
 * Un nombre sin Persona se suma a la cuenta de la Persona cuyo nombre real
 * (cargado por un admin) coincide con él — el 3T sin celular precarga el
 * plantel como "Apellido, Nombre", igual que el nombre real. Si dos Personas
 * comparten nombre real, no se sabe de cuál es y queda como cuenta por nombre.
 */

export type AccountEvent = {
  id: string
  title: string
  date: Date | null
  slug: string
}

export type AccountEventDetail = {
  event: AccountEvent
  /** Nombre con el que figura en este evento (o con el que cargó el gasto, si no fue asistente). */
  name: string
  /** net > 0 debe plata por este evento, net < 0 se le debe. */
  net: number
  owed: number
  expPaid: number
  paidViaExpenses: boolean
  /** Adelantó gastos sin ser asistente del evento. */
  external: boolean
}

export type PersonAccount = {
  /** Clave de consolidación: personKey(id) si es una Persona, normalizeName si no. */
  key: string
  /** La Persona de la cuenta, o null si se consolidó por nombre. */
  personId: string | null
  /** Con Persona: el nombre con el que figura en su evento más reciente. Sin Persona: tal como apareció por primera vez. */
  displayName: string
  /** Suma de los net por evento. > 0 debe, < 0 se le debe. */
  total: number
  events: AccountEventDetail[]
}

/** Clave de cuenta de una Persona. El prefijo evita que choque con un nombre normalizado. */
export function personKey(personId: string): string {
  return `persona:${personId}`
}

/** Nombre real normalizado → Persona, solo para los nombres reales que no se repiten. */
function personByRealName(people: { id: string; real_name: string | null }[]): Map<string, string | null> {
  const byName = new Map<string, string | null>()
  for (const p of people) {
    if (!p.real_name?.trim()) continue
    const name = normalizeName(p.real_name)
    // null = ambiguo: dos Personas con el mismo nombre real
    byName.set(name, byName.has(name) ? null : p.id)
  }
  return byName
}

export function consolidateAccounts(
  items: { event: AccountEvent; settlement: Settlement }[],
  people: { id: string; real_name: string | null }[] = [],
): PersonAccount[] {
  const accounts = new Map<string, PersonAccount>()
  const realNames = personByRealName(people)

  const add = (nameKey: string, attendeePersonId: string | null, displayName: string, detail: AccountEventDetail) => {
    const personId = attendeePersonId ?? realNames.get(nameKey) ?? null
    const key = personId ? personKey(personId) : nameKey
    const account = accounts.get(key) || { key, personId, displayName, total: 0, events: [] }
    account.total += detail.net
    account.events.push(detail)
    accounts.set(key, account)
  }

  for (const { event, settlement } of items) {
    for (const b of settlement.balances) {
      if (b.net === 0) continue
      // Dentro del evento, gastos y asistentes se cruzan por nombre (lib/settlement.ts)
      const nameKey = normalizeName(b.attendee.full_name)
      // Acreedor con todos sus gastos ya devueltos: no hay plata por mover.
      if (b.net < 0 && settlement.settledByPerson.get(nameKey) === true) continue
      add(nameKey, b.attendee.person_id ?? null, b.attendee.full_name, {
        event,
        name: b.attendee.full_name,
        net: b.net,
        owed: b.owed,
        expPaid: b.expPaid,
        paidViaExpenses: b.paidViaExpenses,
        external: false,
      })
    }

    for (const c of settlement.externalCreditors) {
      if (c.expPaid === 0) continue
      if (settlement.settledByPerson.get(c.key) === true) continue
      add(c.key, null, c.name, {
        event,
        name: c.name,
        net: -c.expPaid,
        owed: 0,
        expPaid: c.expPaid,
        paidViaExpenses: false,
        external: true,
      })
    }
  }

  // Una Persona cambia de nombre de un evento a otro: se la muestra con el del más reciente
  const time = (date: Date | null) => (date ? new Date(date).getTime() : 0)
  accounts.forEach((account) => {
    if (!account.personId) return
    const latest = account.events.reduce((a, b) => (time(b.event.date) >= time(a.event.date) ? b : a))
    account.displayName = latest.name
  })

  // Deudores primero (mayor deuda arriba), después acreedores (mayor crédito arriba)
  return Array.from(accounts.values())
    .filter((a) => a.total !== 0)
    .sort((a, b) => {
      if (a.total > 0 && b.total <= 0) return -1
      if (a.total <= 0 && b.total > 0) return 1
      return Math.abs(b.total) - Math.abs(a.total)
    })
}
