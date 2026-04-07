import Link from "next/link"
import { db } from "@/db"
import { events, attendees, expenses, combos } from "@/db/schema"
import { eq, and, sql } from "drizzle-orm"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  PlusIcon,
  CalendarIcon,
  UsersIcon,
  ClockIcon,
  TrendingUpIcon,
  PackageIcon,
} from "lucide-react"
import CopyLinkButton from "@/components/copy-link-button"

function formatDate(date: Date | null) {
  if (!date) return ""
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date))
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export default async function AdminPage() {
  const now = new Date()

  // Fetch all events
  const eventList = await db.select().from(events).orderBy(sql`${events.date} DESC`)

  // Global stats
  const [globalConfirmed] = await db
    .select({ count: sql<number>`count(*)` })
    .from(attendees)
    .where(eq(attendees.status, "confirmed"))

  const [globalRevenue] = await db
    .select({ sum: sql<number>`coalesce(sum(coalesce(${attendees.price_paid}, ${events.payment_amount})), 0)` })
    .from(attendees)
    .innerJoin(events, eq(attendees.event_id, events.id))
    .where(and(eq(attendees.status, "confirmed"), eq(attendees.payment_status, "paid")))

  const [globalPending] = await db
    .select({ sum: sql<number>`coalesce(sum(coalesce(${attendees.price_paid}, ${events.payment_amount})), 0)` })
    .from(attendees)
    .innerJoin(events, eq(attendees.event_id, events.id))
    .where(and(eq(attendees.status, "confirmed"), eq(attendees.payment_status, "pending")))

  const [globalExpenses] = await db
    .select({ sum: sql<number>`coalesce(sum(${expenses.amount}), 0)` })
    .from(expenses)

  // Per-event stats
  const stats = await Promise.all(
    eventList.map(async (event) => {
      const [confirmed] = await db
        .select({ count: sql<number>`count(*)` })
        .from(attendees)
        .where(and(eq(attendees.event_id, event.id), eq(attendees.status, "confirmed")))
      const [paid] = await db
        .select({ count: sql<number>`count(*)` })
        .from(attendees)
        .where(and(eq(attendees.event_id, event.id), eq(attendees.status, "confirmed"), eq(attendees.payment_status, "paid")))
      const [revenue] = await db
        .select({ sum: sql<number>`coalesce(sum(coalesce(${attendees.price_paid}, ${events.payment_amount})), 0)` })
        .from(attendees)
        .innerJoin(events, eq(attendees.event_id, events.id))
        .where(
          and(
            eq(attendees.event_id, event.id),
            eq(attendees.status, "confirmed"),
            eq(attendees.payment_status, "paid")
          )
        )
      return {
        confirmed: Number(confirmed.count),
        paid: Number(paid.count),
        revenue: Number(revenue.sum),
      }
    })
  )

  const activeEvents = eventList.filter((e) => e.is_open).length
  const totalConfirmed = Number(globalConfirmed.count)
  const totalRevenue = Number(globalRevenue.sum)
  const totalPending = Number(globalPending.sum)
  const totalExpenses = Number(globalExpenses.sum)
  const netRevenue = totalRevenue - totalExpenses

  // Fetch combos
  const comboList = await db.select().from(combos).orderBy(sql`${combos.created_at} DESC`)
  const activeCombos = comboList.filter((c) => c.is_open)

  // Combo attendee stats
  const comboStats = await Promise.all(
    comboList.map(async (combo) => {
      const comboAttendees = await db
        .select()
        .from(attendees)
        .where(and(eq(attendees.combo_id, combo.id), eq(attendees.status, "confirmed")))
      // Unique persons
      const personNames = Array.from(new Set(comboAttendees.map((a) => a.full_name.trim().toLowerCase())))
      let paidCount = 0
      for (let pi = 0; pi < personNames.length; pi++) {
        const personAttendees = comboAttendees.filter((a) => a.full_name.trim().toLowerCase() === personNames[pi])
        if (personAttendees.every((a) => a.payment_status === "paid")) paidCount++
      }
      return { total: personNames.length, paid: paidCount }
    })
  )

  // Split events
  const upcoming = eventList
    .map((e, i) => ({ event: e, stats: stats[i] }))
    .filter((item) => new Date(item.event.date!) >= now)
    .reverse() // closest first
  const past = eventList
    .map((e, i) => ({ event: e, stats: stats[i] }))
    .filter((item) => new Date(item.event.date!) < now)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Dashboard</h2>
        <div className="flex items-center gap-2">
          <Link href="/admin/combos/new">
            <Button size="sm" variant="outline">
              <PackageIcon className="w-4 h-4 mr-2" />
              Nuevo combo
            </Button>
          </Link>
          <Link href="/admin/events/new">
            <Button size="sm">
              <PlusIcon className="w-4 h-4 mr-2" />
              Nuevo evento
            </Button>
          </Link>
        </div>
      </div>

      {/* Global Stats */}
      {eventList.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                <CalendarIcon className="w-4 h-4" />
                Eventos activos
              </div>
              <p className="text-2xl font-bold text-gray-900">{activeEvents}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                <UsersIcon className="w-4 h-4" />
                Total inscriptos
              </div>
              <p className="text-2xl font-bold text-gray-900">{totalConfirmed}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                <TrendingUpIcon className="w-4 h-4" />
                Balance neto
              </div>
              <p className={`text-2xl font-bold ${netRevenue >= 0 ? "text-green-600" : "text-red-500"}`}>{formatCurrency(netRevenue)}</p>
              {totalExpenses > 0 && (
                <p className="text-xs text-gray-400 mt-0.5">{formatCurrency(totalRevenue)} cobrado - {formatCurrency(totalExpenses)} gastos</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                <ClockIcon className="w-4 h-4" />
                Pendiente
              </div>
              <p className="text-2xl font-bold text-orange-500">{formatCurrency(totalPending)}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Empty State */}
      {eventList.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <CalendarIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No hay eventos aún</p>
          <Link href="/admin/events/new">
            <Button variant="outline" className="mt-4">
              Crear primer evento
            </Button>
          </Link>
        </div>
      )}

      {/* Active Combos */}
      {activeCombos.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide flex items-center gap-2">
            <PackageIcon className="w-4 h-4" />
            Combos activos
          </h3>
          {activeCombos.map((combo) => {
            const stats = comboStats[comboList.indexOf(combo)]
            const publicUrl = `${(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").trim()}/combo/${combo.slug}`
            return (
              <Link key={combo.id} href={`/admin/combos/${combo.id}`}>
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200 p-4 hover:border-blue-300 hover:shadow-sm transition-all cursor-pointer mb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900 truncate">{combo.title}</h3>
                        <Badge className="bg-blue-100 text-blue-700 text-xs shrink-0">Combo</Badge>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{combo.event_ids.length} eventos</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <UsersIcon className="w-4 h-4" />
                        <span>{stats.total}</span>
                      </div>
                      <Badge variant={stats.paid > 0 ? "default" : "secondary"}>
                        {stats.paid} pagaron
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-2">
                    <span className="text-xs text-gray-400 truncate">/combo/{combo.slug}</span>
                    <CopyLinkButton link={publicUrl} />
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {/* Upcoming Events */}
      {upcoming.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wide">
            Próximos eventos
          </h3>
          {upcoming.map(({ event, stats: s }) => (
            <EventCard key={event.id} event={event} stats={s} isPast={false} />
          ))}
        </div>
      )}

      {/* Past Events */}
      {past.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide">
            Eventos pasados
          </h3>
          {past.map(({ event, stats: s }) => (
            <EventCard key={event.id} event={event} stats={s} isPast={true} />
          ))}
        </div>
      )}
    </div>
  )
}

function EventCard({
  event,
  stats,
  isPast,
}: {
  event: typeof events.$inferSelect
  stats: { confirmed: number; paid: number; revenue: number }
  isPast: boolean
}) {
  const paidPct = stats.confirmed > 0 ? Math.round((stats.paid / stats.confirmed) * 100) : 0
  const capacityPct =
    event.max_capacity && event.max_capacity > 0
      ? Math.round((stats.confirmed / event.max_capacity) * 100)
      : null
  const publicUrl = `${(process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").trim()}/e/${event.slug}`

  return (
    <Link href={`/admin/events/${event.id}`}>
      <div
        className={`bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer ${isPast ? "opacity-60" : ""}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-gray-900 truncate">{event.title}</h3>
              {isPast ? (
                <Badge variant="secondary" className="text-xs shrink-0">
                  Pasado
                </Badge>
              ) : event.is_open ? (
                <Badge className="bg-green-100 text-green-700 text-xs shrink-0">Abierto</Badge>
              ) : (
                <Badge variant="secondary" className="text-xs shrink-0">
                  Cerrado
                </Badge>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5 capitalize">{formatDate(event.date)}</p>

            {/* Capacity bar */}
            {capacityPct !== null && (
              <div className="mt-2 flex items-center gap-2">
                <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden max-w-[120px]">
                  <div
                    className={`h-full rounded-full transition-all ${capacityPct >= 90 ? "bg-red-400" : capacityPct >= 70 ? "bg-orange-400" : "bg-green-400"}`}
                    style={{ width: `${Math.min(capacityPct, 100)}%` }}
                  />
                </div>
                <span className="text-xs text-gray-400">
                  {stats.confirmed}/{event.max_capacity}
                </span>
              </div>
            )}
          </div>

          {/* Right side stats */}
          <div className="flex flex-col items-end gap-1 shrink-0">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-sm text-gray-600">
                <UsersIcon className="w-4 h-4" />
                <span>{stats.confirmed}</span>
              </div>
              <Badge variant={stats.paid > 0 ? "default" : "secondary"}>
                {stats.paid} pagaron{stats.confirmed > 0 ? ` (${paidPct}%)` : ""}
              </Badge>
            </div>
            {stats.revenue > 0 && (
              <span className="text-xs text-green-600 font-medium">
                {formatCurrency(stats.revenue)} recaudado
              </span>
            )}
          </div>
        </div>

        {/* Footer with copy link */}
        <div className="flex items-center gap-1 mt-2">
          <span className="text-xs text-gray-400 truncate">/e/{event.slug}</span>
          <CopyLinkButton link={publicUrl} />
        </div>
      </div>
    </Link>
  )
}
