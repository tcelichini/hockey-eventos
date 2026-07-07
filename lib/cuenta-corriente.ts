import type { Settlement } from "@/lib/settlement"
import { normalizeName } from "@/lib/settlement"

/**
 * Cuenta corriente por jugador (ver CONTEXT.md): saldo consolidado de una
 * persona across eventos. Solo entra lo que falta mover de plata — eventos
 * ya pagados y gastos ya devueltos (settled) no suman.
 *
 * Función pura: recibe las liquidaciones por evento (output de settleEvent)
 * y las consolida por persona vía normalizeName.
 */

export type AccountEvent = {
  id: string
  title: string
  date: Date | null
  slug: string
}

export type AccountEventDetail = {
  event: AccountEvent
  /** net > 0 debe plata por este evento, net < 0 se le debe. */
  net: number
  owed: number
  expPaid: number
  paidViaExpenses: boolean
  /** Adelantó gastos sin ser asistente del evento. */
  external: boolean
}

export type PersonAccount = {
  /** normalizeName — clave de consolidación. */
  key: string
  /** Nombre tal como apareció por primera vez. */
  displayName: string
  /** Suma de los net por evento. > 0 debe, < 0 se le debe. */
  total: number
  events: AccountEventDetail[]
}

export function consolidateAccounts(
  items: { event: AccountEvent; settlement: Settlement }[],
): PersonAccount[] {
  const accounts = new Map<string, PersonAccount>()

  const add = (key: string, displayName: string, detail: AccountEventDetail) => {
    const account = accounts.get(key) || { key, displayName, total: 0, events: [] }
    account.total += detail.net
    account.events.push(detail)
    accounts.set(key, account)
  }

  for (const { event, settlement } of items) {
    for (const b of settlement.balances) {
      if (b.net === 0) continue
      const key = normalizeName(b.attendee.full_name)
      // Acreedor con todos sus gastos ya devueltos: no hay plata por mover.
      if (b.net < 0 && settlement.settledByPerson.get(key) === true) continue
      add(key, b.attendee.full_name, {
        event,
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
      add(c.key, c.name, {
        event,
        net: -c.expPaid,
        owed: 0,
        expPaid: c.expPaid,
        paidViaExpenses: false,
        external: true,
      })
    }
  }

  // Deudores primero (mayor deuda arriba), después acreedores (mayor crédito arriba)
  return Array.from(accounts.values())
    .filter((a) => a.total !== 0)
    .sort((a, b) => {
      if (a.total > 0 && b.total <= 0) return -1
      if (a.total <= 0 && b.total > 0) return 1
      return Math.abs(b.total) - Math.abs(a.total)
    })
}
