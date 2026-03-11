import { db } from "@/db"
import { events, attendees as attendeesTable } from "@/db/schema"
import { eq, and, count } from "drizzle-orm"
import { notFound } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { CalendarIcon } from "lucide-react"

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

function formatCurrency(amount: string | null) {
  if (!amount) return ""
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(Number(amount))
}

export default async function EventPage({ params }: { params: { slug: string } }) {
  const [event] = await db.select().from(events).where(eq(events.slug, params.slug)).limit(1)
  if (!event) notFound()

  const [{ value: confirmedCount }] = await db
    .select({ value: count() })
    .from(attendeesTable)
    .where(and(eq(attendeesTable.event_id, event.id), eq(attendeesTable.status, "confirmed")))

  const isFull = event.max_capacity ? Number(confirmedCount) >= event.max_capacity : false
  const canConfirm = event.is_open && !isFull

  return (
    <div className="min-h-screen bg-[#001435]">
      <div className="max-w-md mx-auto">

        {/* Banner */}
        {event.flyer_url ? (
          <div className="relative aspect-[4/3] w-full">
            <Image src={event.flyer_url} alt={event.title} fill className="object-cover" />
            {/* Overlay gradient at bottom */}
            <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-[#001435] to-transparent" />
          </div>
        ) : (
          /* Default banner with San Martín branding */
          <div className="relative aspect-[4/3] w-full bg-[#002060] overflow-hidden flex flex-col items-center justify-center p-8">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-[#00A651]/10 rounded-full -translate-y-1/2 translate-x-1/2" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#00A651]/10 rounded-full translate-y-1/2 -translate-x-1/2" />
            {/* Green top stripe */}
            <div className="absolute top-0 inset-x-0 h-1.5 bg-[#00A651]" />

            {/* Club badge */}
            <div className="w-16 h-16 bg-[#001435] border-3 border-[#00A651] rounded-full flex items-center justify-center mb-4 shadow-lg ring-4 ring-[#00A651]/20">
              <span className="text-white font-black text-xl">SM</span>
            </div>
            <p className="text-[#00A651] text-xs font-bold uppercase tracking-[0.25em] mb-3">San Martín · Hockey</p>
            <h1 className="text-white font-black text-2xl text-center leading-tight uppercase">{event.title}</h1>
          </div>
        )}

        {/* Event Info card */}
        <div className="bg-white mx-3 -mt-4 rounded-t-2xl relative z-10 px-5 pt-5 pb-2">
          <h2 className="text-xl font-bold text-[#002060]">{event.title}</h2>
          <div className="flex items-center gap-2 mt-1.5 text-gray-500">
            <CalendarIcon className="w-3.5 h-3.5 shrink-0" />
            <span className="text-sm capitalize">{formatDate(event.date)}</span>
          </div>
        </div>

        <div className="bg-white mx-3 px-5 pb-6 space-y-4">
          {event.description && (
            <p className="text-gray-500 text-sm leading-relaxed">{event.description}</p>
          )}

          {/* Cost badge */}
          <div className="flex items-center gap-3 bg-[#002060]/5 border border-[#002060]/10 rounded-xl px-4 py-3">
            <div className="w-8 h-8 bg-[#00A651] rounded-lg flex items-center justify-center shrink-0">
              <span className="text-white text-sm font-bold">$</span>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Costo por persona</p>
              <p className="font-bold text-[#002060] text-lg">{formatCurrency(event.payment_amount)}</p>
            </div>
          </div>

          {/* Capacity indicator */}
          {event.max_capacity && (
            <div className="flex items-center gap-2 bg-gray-50 rounded-xl px-4 py-2.5">
              <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                <div
                  className="bg-[#00A651] h-1.5 rounded-full transition-all"
                  style={{ width: `${Math.min(100, (Number(confirmedCount) / event.max_capacity) * 100)}%` }}
                />
              </div>
              <span className="text-xs text-gray-500 shrink-0">
                {isFull ? "Sin lugares" : `${event.max_capacity - Number(confirmedCount)} lugares`}
              </span>
            </div>
          )}

          {/* CTA Buttons */}
          <div className="space-y-3 pt-1">
            {canConfirm ? (
              <Link href={`/e/${event.slug}/confirm`} className="block">
                <button className="w-full h-14 bg-[#00A651] hover:bg-[#009045] active:bg-[#00803e] text-white font-bold text-base rounded-xl transition-colors uppercase tracking-wide shadow-md shadow-[#00A651]/20">
                  ✅ Confirmar asistencia
                </button>
              </Link>
            ) : (
              <div className="w-full h-14 bg-gray-100 text-gray-400 font-bold text-base rounded-xl flex items-center justify-center uppercase tracking-wide cursor-not-allowed">
                {!event.is_open ? "🔒 Inscripciones cerradas" : "❌ Sin lugares disponibles"}
              </div>
            )}
            <Link href={`/e/${event.slug}/decline`} className="block">
              <button className="w-full h-11 bg-white border-2 border-gray-200 hover:border-gray-300 text-gray-400 font-medium text-sm rounded-xl transition-colors">
                No puedo ir esta vez
              </button>
            </Link>
          </div>
        </div>

        {/* Footer branding */}
        <div className="mx-3 rounded-b-2xl bg-[#002060] px-5 py-3 flex items-center justify-center gap-2">
          <div className="w-5 h-5 bg-[#00A651] rounded-full flex items-center justify-center">
            <span className="text-white text-[9px] font-black">SM</span>
          </div>
          <p className="text-white/50 text-xs">San Martín · Plantel Superior</p>
        </div>

      </div>
    </div>
  )
}
