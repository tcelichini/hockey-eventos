import Link from "next/link"
import { db } from "@/db"
import { events, attendees } from "@/db/schema"
import { eq, and, sql } from "drizzle-orm"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PlusIcon, CalendarIcon, UsersIcon } from "lucide-react"

function formatDate(date: Date | null) {
  if (!date) return ""
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date))
}

export default async function AdminPage() {
  const eventList = await db.select().from(events).orderBy(sql`${events.date} DESC`)

  const stats = await Promise.all(
    eventList.map(async (event) => {
      const confirmed = await db
        .select({ count: sql<number>`count(*)` })
        .from(attendees)
        .where(and(eq(attendees.event_id, event.id), eq(attendees.status, "confirmed")))
      const paid = await db
        .select({ count: sql<number>`count(*)` })
        .from(attendees)
        .where(and(eq(attendees.event_id, event.id), eq(attendees.payment_status, "paid")))
      return {
        confirmed: Number(confirmed[0].count),
        paid: Number(paid[0].count),
      }
    })
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Eventos</h2>
        <Link href="/admin/events/new">
          <Button size="sm">
            <PlusIcon className="w-4 h-4 mr-2" />
            Nuevo evento
          </Button>
        </Link>
      </div>

      {eventList.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <CalendarIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No hay eventos aún</p>
          <Link href="/admin/events/new">
            <Button variant="outline" className="mt-4">
              Crear primer evento
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {eventList.map((event, i) => (
            <Link key={event.id} href={`/admin/events/${event.id}`}>
              <div className="bg-white rounded-xl border border-gray-200 p-4 hover:border-gray-300 hover:shadow-sm transition-all cursor-pointer">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{event.title}</h3>
                    <p className="text-sm text-gray-500 mt-0.5 capitalize">
                      {formatDate(event.date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <UsersIcon className="w-4 h-4" />
                      <span>{stats[i].confirmed}</span>
                    </div>
                    <Badge variant={stats[i].paid > 0 ? "default" : "secondary"}>
                      {stats[i].paid} pagaron
                    </Badge>
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Link: /e/{event.slug}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
