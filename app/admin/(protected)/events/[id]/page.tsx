import { db } from "@/db"
import { events, attendees } from "@/db/schema"
import { eq } from "drizzle-orm"
import { notFound } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeftIcon, PencilIcon } from "lucide-react"
import MarkPaidButton from "@/components/mark-paid-button"
import CopyLinkButton from "@/components/copy-link-button"
import DeleteEventButton from "@/components/delete-event-button"
import ToggleEventButton from "@/components/toggle-event-button"

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


export default async function EventDetailPage({ params }: { params: { id: string } }) {
  const [event] = await db.select().from(events).where(eq(events.id, params.id)).limit(1)
  if (!event) notFound()

  const attendeeList = await db
    .select()
    .from(attendees)
    .where(eq(attendees.event_id, event.id))
    .orderBy(attendees.created_at)

  const confirmed = attendeeList.filter((a) => a.status === "confirmed")
  const declined = attendeeList.filter((a) => a.status === "declined")
  const paid = confirmed.filter((a) => a.payment_status === "paid")

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").trim()
  const publicLink = `${appUrl}/e/${event.slug}`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/admin">
          <Button variant="ghost" size="sm">
            <ArrowLeftIcon className="w-4 h-4 mr-1" />
            Volver
          </Button>
        </Link>
        <div className="flex items-center gap-2">
          <ToggleEventButton eventId={params.id} isOpen={event.is_open} />
          <Link href={`/admin/events/${params.id}/edit`}>
            <Button variant="outline" size="sm">
              <PencilIcon className="w-4 h-4 mr-1" />
              Editar
            </Button>
          </Link>
          <DeleteEventButton eventId={params.id} />
        </div>
      </div>

      {/* Event Info */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-xl font-bold text-gray-900">{event.title}</h2>
            <Badge className={event.is_open ? "bg-green-100 text-green-700 hover:bg-green-100 shrink-0" : "bg-gray-100 text-gray-500 hover:bg-gray-100 shrink-0"}>
              {event.is_open ? "Abierto" : "Cerrado"}
            </Badge>
          </div>
          <p className="text-gray-500 mt-1 capitalize">{formatDate(event.date)}</p>
          {event.description && (
            <p className="text-gray-600 mt-2 text-sm">{event.description}</p>
          )}
          {event.max_capacity && (
            <p className="text-sm mt-2">
              <span className="font-medium text-gray-700">{confirmed.length}</span>
              <span className="text-gray-400"> / {event.max_capacity} cupos</span>
              {confirmed.length >= event.max_capacity && (
                <span className="ml-2 text-red-500 font-medium text-xs">COMPLETO</span>
              )}
            </p>
          )}
          <div className="mt-3 flex items-center gap-2">
            <code className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600 break-all">{publicLink}</code>
            <CopyLinkButton link={publicLink} />
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <div className="text-3xl font-bold text-green-600">{confirmed.length}</div>
            <div className="text-xs text-gray-500 mt-1">Confirmaron</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <div className="text-3xl font-bold text-blue-600">{paid.length}</div>
            <div className="text-xs text-gray-500 mt-1">Pagaron</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <div className="text-3xl font-bold text-gray-400">{declined.length}</div>
            <div className="text-xs text-gray-500 mt-1">No van</div>
          </CardContent>
        </Card>
      </div>

      {/* Attendees */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Asistentes ({confirmed.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {confirmed.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">Nadie confirmó aún</p>
          ) : (
            <div className="divide-y">
              {confirmed.map((attendee) => (
                <div key={attendee.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{attendee.full_name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Intl.DateTimeFormat("es-AR", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(attendee.created_at!))}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {attendee.payment_status === "paid" ? (
                      <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Pagó</Badge>
                    ) : (
                      <>
                        <Badge variant="secondary">Pendiente</Badge>
                        <MarkPaidButton attendeeId={attendee.id} />
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {declined.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base text-gray-500">No van ({declined.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="divide-y">
              {declined.map((attendee) => (
                <div key={attendee.id} className="py-2">
                  <p className="text-gray-500 text-sm">{attendee.full_name}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
