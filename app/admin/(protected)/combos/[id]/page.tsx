import { db } from "@/db"
import { combos, events, attendees } from "@/db/schema"
import { eq, and, inArray } from "drizzle-orm"
import { notFound } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeftIcon, PencilIcon } from "lucide-react"
import CopyLinkButton from "@/components/copy-link-button"
import ToggleComboButton from "@/components/toggle-combo-button"
import DeleteComboButton from "@/components/delete-combo-button"
import MarkComboPaidButton from "@/components/mark-combo-paid-button"
import RefreshButton from "@/components/refresh-button"
import { getDateTierLabel } from "@/lib/pricing"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(value)
}

function formatDate(date: Date | null) {
  if (!date) return ""
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(date))
}

export default async function ComboDetailPage({ params }: { params: { id: string } }) {
  const [combo] = await db.select().from(combos).where(eq(combos.id, params.id)).limit(1)
  if (!combo) notFound()

  // Fetch linked events
  const linkedEvents = combo.event_ids.length > 0
    ? await db.select().from(events).where(inArray(events.id, combo.event_ids))
    : []

  // Fetch combo attendees (grouped by person)
  const comboAttendees = await db
    .select()
    .from(attendees)
    .where(and(eq(attendees.combo_id, combo.id), eq(attendees.status, "confirmed")))
    .orderBy(attendees.created_at)

  // Group by person (take unique names)
  const personMap = new Map<string, typeof comboAttendees>()
  for (const a of comboAttendees) {
    const key = a.full_name.trim().toLowerCase()
    const list = personMap.get(key) || []
    list.push(a)
    personMap.set(key, list)
  }

  const persons = Array.from(personMap.entries()).map(([, attendeeList]) => {
    const totalPaid = attendeeList.reduce((sum, a) => sum + Number(a.price_paid || 0), 0)
    const allPaid = attendeeList.every((a) => a.payment_status === "paid")
    const proofUrl = attendeeList.find((a) => a.payment_proof_url)?.payment_proof_url
    const proofUploadedAt = attendeeList.find((a) => a.proof_uploaded_at)?.proof_uploaded_at
    return {
      name: attendeeList[0].full_name,
      attendees: attendeeList,
      totalPaid,
      allPaid,
      proofUrl,
      proofUploadedAt,
    }
  })

  const totalPersons = persons.length
  const paidPersons = persons.filter((p) => p.allPaid).length
  const totalCollected = persons.filter((p) => p.allPaid).reduce((sum, p) => sum + p.totalPaid, 0)
  const totalPending = persons.filter((p) => !p.allPaid).reduce((sum, p) => sum + p.totalPaid, 0)

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").trim()
  const publicLink = `${appUrl}/combo/${combo.slug}`

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
          <RefreshButton />
          <ToggleComboButton comboId={params.id} isOpen={combo.is_open} />
          <Link href={`/admin/combos/${params.id}/edit`}>
            <Button variant="outline" size="sm">
              <PencilIcon className="w-4 h-4 mr-1" />
              Editar
            </Button>
          </Link>
          <DeleteComboButton comboId={params.id} />
        </div>
      </div>

      {/* Combo Info */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-xl font-bold text-gray-900">{combo.title}</h2>
            <Badge className={combo.is_open ? "bg-green-100 text-green-700 hover:bg-green-100 shrink-0" : "bg-gray-100 text-gray-500 hover:bg-gray-100 shrink-0"}>
              {combo.is_open ? "Abierto" : "Cerrado"}
            </Badge>
          </div>
          {combo.description && (
            <p className="text-gray-600 mt-2 text-sm">{combo.description}</p>
          )}

          <div className="mt-3 space-y-1">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Eventos incluidos</p>
            {linkedEvents.map((event) => (
              <Link key={event.id} href={`/admin/events/${event.id}`}>
                <p className="text-sm text-blue-600 hover:underline">
                  {event.title} — <span className="text-gray-500 capitalize">{formatDate(event.date)}</span>
                </p>
              </Link>
            ))}
          </div>

          {combo.date_tiers && combo.date_tiers.length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Precios combo por fecha</p>
              {(() => {
                const today = new Date().toISOString().slice(0, 10)
                const sorted = [...combo.date_tiers!].sort((a, b) => {
                  if (a.until === null) return 1
                  if (b.until === null) return -1
                  return a.until.localeCompare(b.until)
                })
                return sorted.map((tier, i) => {
                  const isPast = tier.until !== null && today > tier.until
                  return (
                    <p key={i} className={`text-sm ${isPast ? "text-gray-400 line-through" : "text-gray-700"}`}>
                      {getDateTierLabel(tier, i, sorted)}: {formatCurrency(tier.price)}
                    </p>
                  )
                })
              })()}
            </div>
          )}

          <div className="mt-3 flex items-center gap-2">
            <code className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600 break-all">{publicLink}</code>
            <CopyLinkButton link={publicLink} />
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <div className="text-3xl font-bold text-green-600">{totalPersons}</div>
            <div className="text-xs text-gray-500 mt-1">Inscriptos</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <div className="text-3xl font-bold text-blue-600">{paidPersons}</div>
            <div className="text-xs text-gray-500 mt-1">Pagaron</div>
          </CardContent>
        </Card>
      </div>

      {totalPersons > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-xs text-gray-500 mb-1">Recaudado</div>
              <div className="text-xl font-bold text-green-600">{formatCurrency(totalCollected)}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-xs text-gray-500 mb-1">Falta cobrar</div>
              <div className="text-xl font-bold text-orange-500">{formatCurrency(totalPending)}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Attendees */}
      <Card>
        <CardContent className="pt-5">
          <h3 className="font-semibold text-gray-900 mb-3">Inscriptos al combo ({totalPersons})</h3>
          {persons.length === 0 ? (
            <p className="text-gray-400 text-sm text-center py-4">Nadie se anoto aun</p>
          ) : (
            <div className="divide-y">
              {persons.map((person) => (
                <div key={person.name} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">{person.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      Combo: {formatCurrency(person.totalPaid)}
                      {person.proofUploadedAt && (
                        <> · <span className="text-green-600">Pagó {new Intl.DateTimeFormat("es-AR", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                          timeZone: "America/Argentina/Buenos_Aires",
                        }).format(new Date(person.proofUploadedAt))}</span></>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {person.proofUrl && (
                      <a href={person.proofUrl} target="_blank" rel="noopener noreferrer">
                        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 cursor-pointer">
                          Comprobante
                        </Badge>
                      </a>
                    )}
                    {person.allPaid ? (
                      <>
                        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Pagó</Badge>
                        <MarkComboPaidButton attendeeIds={person.attendees.map((a) => a.id)} isPaid={true} />
                      </>
                    ) : (
                      <>
                        <Badge variant="secondary">Pendiente</Badge>
                        <MarkComboPaidButton attendeeIds={person.attendees.filter((a) => a.payment_status !== "paid").map((a) => a.id)} isPaid={false} />
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
