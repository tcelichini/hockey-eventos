import Link from "next/link"
import { db } from "@/db"
import { events, attendees, combos, expenses } from "@/db/schema"
import type { DateTier } from "@/db/schema"
import { eq, and, sql, inArray } from "drizzle-orm"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeftIcon } from "lucide-react"
import { calculateDatePrice } from "@/lib/pricing"

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function formatDate(date: Date | null) {
  if (!date) return ""
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(date))
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("")
}

export default async function PendientesPage() {
  const now = new Date()

  const unpaidAttendees = await db
    .select({
      id: attendees.id,
      full_name: attendees.full_name,
      price_paid: attendees.price_paid,
      combo_id: attendees.combo_id,
      event_id: attendees.event_id,
      event_title: events.title,
      event_date: events.date,
      event_is_open: events.is_open,
      event_slug: events.slug,
      event_payment_amount: events.payment_amount,
      event_date_tiers: events.date_tiers,
    })
    .from(attendees)
    .innerJoin(events, eq(attendees.event_id, events.id))
    .where(and(eq(attendees.status, "confirmed"), eq(attendees.payment_status, "pending")))
    .orderBy(sql`${events.date} DESC, ${attendees.full_name} ASC`)

  // Fetch combo data for attendees registered via combo
  const comboIds = Array.from(new Set(unpaidAttendees.map((a) => a.combo_id).filter((id): id is string => id !== null)))
  const comboMap = new Map<string, { date_tiers: DateTier[] | null; payment_amount: string; eventCount: number }>()
  if (comboIds.length > 0) {
    const comboRows = await db
      .select({
        id: combos.id,
        date_tiers: combos.date_tiers,
        payment_amount: combos.payment_amount,
        event_ids: combos.event_ids,
      })
      .from(combos)
      .where(inArray(combos.id, comboIds))
    for (const c of comboRows) {
      comboMap.set(c.id, {
        date_tiers: c.date_tiers,
        payment_amount: c.payment_amount,
        eventCount: c.event_ids.length,
      })
    }
  }

  // Group by event
  const eventMap = new Map<
    string,
    {
      event_id: string
      title: string
      date: Date | null
      is_open: boolean
      slug: string
      payment_amount: string
      date_tiers: DateTier[] | null
      people: { id: string; name: string; amount: number; grossAmount: number; expPaid: number }[]
    }
  >()

  for (const row of unpaidAttendees) {
    if (!eventMap.has(row.event_id)) {
      eventMap.set(row.event_id, {
        event_id: row.event_id,
        title: row.event_title,
        date: row.event_date,
        is_open: row.event_is_open,
        slug: row.event_slug,
        payment_amount: row.event_payment_amount,
        date_tiers: row.event_date_tiers,
        people: [],
      })
    }

    let amount: number
    if (row.combo_id && comboMap.has(row.combo_id)) {
      const combo = comboMap.get(row.combo_id)!
      const comboPrice = combo.date_tiers && combo.date_tiers.length > 0
        ? calculateDatePrice(combo.date_tiers, combo.payment_amount)
        : Number(combo.payment_amount)
      amount = Math.round((comboPrice / combo.eventCount) * 100) / 100
    } else {
      const currentTierPrice = row.event_date_tiers && row.event_date_tiers.length > 0
        ? calculateDatePrice(row.event_date_tiers, row.event_payment_amount)
        : null
      amount = currentTierPrice ?? (Number(row.price_paid) || Number(row.event_payment_amount) || 0)
    }

    eventMap.get(row.event_id)!.people.push({
      id: row.id,
      name: row.full_name,
      amount,
      grossAmount: amount,
      expPaid: 0,
    })
  }

  // Fetch expenses for events with pending payments and discount from each person's amount
  const eventIdsWithPending = Array.from(eventMap.keys())
  if (eventIdsWithPending.length > 0) {
    const expenseList = await db
      .select()
      .from(expenses)
      .where(inArray(expenses.event_id, eventIdsWithPending))

    const expenseByEventPerson = new Map<string, number>()
    for (const e of expenseList) {
      const key = `${e.event_id}::${e.responsible.trim().toLowerCase()}`
      expenseByEventPerson.set(key, (expenseByEventPerson.get(key) || 0) + Number(e.amount))
    }

    for (const group of eventMap.values()) {
      for (const person of group.people) {
        const key = `${group.event_id}::${person.name.trim().toLowerCase()}`
        const exp = expenseByEventPerson.get(key) || 0
        if (exp > 0) {
          person.expPaid = exp
          person.amount = Math.max(0, person.grossAmount - exp)
        }
      }
      group.people = group.people.filter((p) => p.amount > 0)
    }
  }

  const grouped = Array.from(eventMap.values())
    .filter((g) => g.people.length > 0)
    .sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime())

  // Confirmed counts per event (for "X pendientes de Y confirmados")
  const confirmedCounts = new Map<string, number>()
  if (grouped.length > 0) {
    const eventIds = grouped.map((g) => g.event_id)
    const counts = await db
      .select({
        event_id: attendees.event_id,
        count: sql<number>`count(*)`,
      })
      .from(attendees)
      .where(and(eq(attendees.status, "confirmed"), inArray(attendees.event_id, eventIds)))
      .groupBy(attendees.event_id)
    for (const c of counts) {
      confirmedCounts.set(c.event_id, Number(c.count))
    }
  }

  // Split into upcoming vs past, with explicit sort to guarantee order
  const upcoming = grouped
    .filter((g) => g.date && new Date(g.date) >= now)
    .sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime())
  const past = grouped
    .filter((g) => g.date && new Date(g.date) < now)
    .sort((a, b) => new Date(b.date!).getTime() - new Date(a.date!).getTime())

  // Summary stats (only events with pending payments)
  const totalPending = grouped.reduce(
    (sum, g) => sum + g.people.reduce((s, p) => s + p.amount, 0),
    0
  )
  const totalPeopleCount = unpaidAttendees.length

  // Collected amount for events that have pending payments
  let totalCollected = 0
  if (grouped.length > 0) {
    const eventIds = grouped.map((g) => g.event_id)
    const [result] = await db
      .select({
        sum: sql<number>`coalesce(sum(coalesce(${attendees.price_paid}, ${events.payment_amount})), 0)`,
      })
      .from(attendees)
      .innerJoin(events, eq(attendees.event_id, events.id))
      .where(
        and(
          eq(attendees.status, "confirmed"),
          eq(attendees.payment_status, "paid"),
          inArray(attendees.event_id, eventIds)
        )
      )
    totalCollected = Number(result.sum)
  }

  const totalConfirmedInEvents = Array.from(confirmedCounts.values()).reduce((a, b) => a + b, 0)
  const totalPaidInEvents = totalConfirmedInEvents - totalPeopleCount

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin" className="text-gray-400 hover:text-gray-600 transition">
          <ArrowLeftIcon className="w-5 h-5" />
        </Link>
        <h2 className="text-xl font-semibold text-gray-900">Pendientes de pago</h2>
      </div>

      {/* Empty state */}
      {grouped.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="font-medium text-lg">Todos al día</p>
          <p className="text-sm mt-1">No hay pagos pendientes</p>
        </div>
      )}

      {grouped.length > 0 && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-gray-500 mb-1">Total pendiente</div>
                <div className="text-2xl font-bold text-orange-500">
                  {formatCurrency(totalPending)}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {totalPeopleCount} persona{totalPeopleCount !== 1 ? "s" : ""} en{" "}
                  {grouped.length} evento{grouped.length !== 1 ? "s" : ""}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-gray-500 mb-1">Cobrado</div>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(totalCollected)}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {totalPaidInEvents} de {totalConfirmedInEvents} pagaron
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Upcoming events with pending */}
          {upcoming.map((group) => (
            <EventPendingGroup
              key={group.event_id}
              group={group}
              confirmedCount={confirmedCounts.get(group.event_id) || 0}
              isPast={false}
            />
          ))}

          {/* Past events with pending */}
          {past.map((group) => (
            <EventPendingGroup
              key={group.event_id}
              group={group}
              confirmedCount={confirmedCounts.get(group.event_id) || 0}
              isPast={true}
            />
          ))}
        </>
      )}
    </div>
  )
}

function EventPendingGroup({
  group,
  confirmedCount,
  isPast,
}: {
  group: {
    event_id: string
    title: string
    date: Date | null
    is_open: boolean
    slug: string
    people: { id: string; name: string; amount: number; grossAmount: number; expPaid: number }[]
  }
  confirmedCount: number
  isPast: boolean
}) {
  const subtotal = group.people.reduce((s, p) => s + p.amount, 0)

  return (
    <div className={`space-y-2 ${isPast ? "opacity-60" : ""}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide truncate">
            {group.title}
          </h3>
          {isPast ? (
            <Badge variant="secondary" className="text-xs shrink-0">
              Pasado
            </Badge>
          ) : group.is_open ? (
            <Badge className="bg-green-100 text-green-700 text-xs shrink-0">Abierto</Badge>
          ) : (
            <Badge variant="secondary" className="text-xs shrink-0">
              Cerrado
            </Badge>
          )}
        </div>
        <Link
          href={`/admin/events/${group.event_id}`}
          className="text-xs text-blue-500 hover:text-blue-700 shrink-0 ml-2"
        >
          Ver evento &rarr;
        </Link>
      </div>
      <p className="text-xs text-gray-400 capitalize">{formatDate(group.date)}</p>

      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {group.people.map((person) => (
          <div key={person.id} className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center text-orange-600 text-xs font-semibold shrink-0">
                {getInitials(person.name)}
              </div>
              <span className="text-sm text-gray-700">{person.name}</span>
            </div>
            <div className="text-right shrink-0 ml-2">
              <span className="text-sm font-medium text-orange-500">
                {formatCurrency(person.amount)}
              </span>
              {person.expPaid > 0 && (
                <p className="text-xs text-gray-400">
                  {formatCurrency(person.grossAmount)} − {formatCurrency(person.expPaid)} gastos
                </p>
              )}
            </div>
          </div>
        ))}

        {/* Subtotal */}
        <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50/50">
          <span className="text-xs text-gray-400">
            {group.people.length} pendiente{group.people.length !== 1 ? "s" : ""} de{" "}
            {confirmedCount} confirmado{confirmedCount !== 1 ? "s" : ""}
          </span>
          <span className="text-xs font-medium text-orange-500">{formatCurrency(subtotal)}</span>
        </div>
      </div>
    </div>
  )
}
