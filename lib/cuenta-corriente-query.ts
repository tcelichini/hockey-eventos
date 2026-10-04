import { db } from "@/db"
import { events, attendees, expenses, people } from "@/db/schema"
import { eq, isNotNull } from "drizzle-orm"
import { settleEvent } from "@/lib/settlement"
import { consolidateAccounts, type PersonAccount } from "@/lib/cuenta-corriente"

/**
 * Fetch + consolidación de la cuenta corriente. Única implementación,
 * compartida por la página admin (/admin/cuentas) y la API pública
 * (/api/cuenta). También devuelve el alias de pago por evento para
 * que el jugador sepa a dónde transferir, y el nombre real de cada
 * Persona (solo para admin: nunca sale por la API pública).
 */
export async function getCuentasCorrientes(): Promise<{
  accounts: PersonAccount[]
  paymentAccountByEvent: Map<string, string>
  realNameByPerson: Map<string, string>
}> {
  const [eventRows, confirmedRows, expenseRows, peopleRows] = await Promise.all([
    db.select().from(events),
    db.select().from(attendees).where(eq(attendees.status, "confirmed")),
    db.select().from(expenses),
    db.select({ id: people.id, real_name: people.real_name }).from(people).where(isNotNull(people.real_name)),
  ])

  const paymentAccountByEvent = new Map<string, string>()
  const items = eventRows.map((ev) => {
    paymentAccountByEvent.set(ev.id, ev.payment_account)
    return {
      event: { id: ev.id, title: ev.title, date: ev.date, slug: ev.slug },
      settlement: settleEvent({
        event: ev,
        attendees: confirmedRows.filter((a) => a.event_id === ev.id),
        expenses: expenseRows.filter((e) => e.event_id === ev.id),
      }),
    }
  })

  const realNameByPerson = new Map<string, string>()
  for (const p of peopleRows) {
    if (p.real_name) realNameByPerson.set(p.id, p.real_name)
  }

  return { accounts: consolidateAccounts(items), paymentAccountByEvent, realNameByPerson }
}
