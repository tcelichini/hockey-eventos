import { db } from "@/db"
import { combos, events, attendees } from "@/db/schema"
import { eq, and, inArray, count } from "drizzle-orm"
import { notFound } from "next/navigation"
import Link from "next/link"
import { CalendarIcon, PackageIcon } from "lucide-react"
import { calculateDatePrice, getDateTierLabel } from "@/lib/pricing"

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

function formatCurrency(amount: string | number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(Number(amount))
}

export default async function ComboPage({ params }: { params: { slug: string } }) {
  const [combo] = await db.select().from(combos).where(eq(combos.slug, params.slug)).limit(1)
  if (!combo) notFound()

  // Fetch linked events
  const linkedEvents = combo.event_ids.length > 0
    ? await db.select().from(events).where(inArray(events.id, combo.event_ids))
    : []

  // Sort by date
  linkedEvents.sort((a, b) => new Date(a.date!).getTime() - new Date(b.date!).getTime())

  // Check if all events are open and have capacity
  const allOpen = linkedEvents.every((e) => e.is_open) && combo.is_open
  let anyFull = false
  for (const event of linkedEvents) {
    if (event.max_capacity) {
      const [{ value: confirmedCount }] = await db
        .select({ value: count() })
        .from(attendees)
        .where(and(eq(attendees.event_id, event.id), eq(attendees.status, "confirmed")))
      if (Number(confirmedCount) >= event.max_capacity) anyFull = true
    }
  }

  const canConfirm = allOpen && !anyFull

  return (
    <div className="min-h-screen bg-[#001435]">
      <div className="max-w-md mx-auto">

        {/* Banner */}
        <div className="relative aspect-[4/3] w-full bg-[#002060] overflow-hidden flex flex-col items-center justify-center p-8">
          <div className="absolute top-0 right-0 w-48 h-48 bg-[#00A651]/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-[#00A651]/10 rounded-full translate-y-1/2 -translate-x-1/2" />
          <div className="absolute top-0 inset-x-0 h-1.5 bg-[#00A651]" />

          <div className="w-16 h-16 bg-[#001435] border-3 border-[#00A651] rounded-full flex items-center justify-center mb-4 shadow-lg ring-4 ring-[#00A651]/20">
            <PackageIcon className="w-7 h-7 text-[#00A651]" />
          </div>
          <p className="text-[#00A651] text-xs font-bold uppercase tracking-[0.25em] mb-3">Combo descuento</p>
          <h1 className="text-white font-black text-2xl text-center leading-tight uppercase">{combo.title}</h1>
        </div>

        {/* Info card */}
        <div className="bg-white mx-3 -mt-4 rounded-t-2xl relative z-10 px-5 pt-5 pb-2">
          <h2 className="text-xl font-bold text-[#002060]">{combo.title}</h2>
          <p className="text-sm text-gray-500 mt-1">Paga los {linkedEvents.length} partidos juntos y ahorra</p>
        </div>

        <div className="bg-white mx-3 px-5 pb-6 space-y-4">
          {combo.description && (
            <p className="text-gray-500 text-sm leading-relaxed">{combo.description}</p>
          )}

          {/* Included events */}
          <div className="bg-gray-50 rounded-xl p-3 space-y-2">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Eventos incluidos</p>
            {linkedEvents.map((event) => (
              <div key={event.id} className="flex items-center gap-2">
                <CalendarIcon className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <div>
                  <p className="text-sm font-medium text-gray-800">{event.title}</p>
                  <p className="text-xs text-gray-500 capitalize">{formatDate(event.date)}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Pricing */}
          {combo.date_tiers && combo.date_tiers.length > 0 ? (
            <div className="bg-[#002060]/5 border border-[#002060]/10 rounded-xl px-4 py-3 space-y-2">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Precio del combo</p>
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
                    <div key={i} className={`flex justify-between items-center ${isPast ? "opacity-40" : ""}`}>
                      <span className={`text-sm text-gray-600 ${isPast ? "line-through" : ""}`}>
                        {getDateTierLabel(tier, i, sorted)}
                      </span>
                      <span className={`font-bold text-[#002060] ${isPast ? "line-through" : ""}`}>
                        {formatCurrency(tier.price)}
                      </span>
                    </div>
                  )
                })
              })()}
              <div className="pt-1 border-t border-[#002060]/10">
                <p className="text-xs text-[#00A651] font-medium">
                  Tu precio hoy: {formatCurrency(calculateDatePrice(combo.date_tiers, combo.payment_amount))}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 bg-[#002060]/5 border border-[#002060]/10 rounded-xl px-4 py-3">
              <div className="w-8 h-8 bg-[#00A651] rounded-lg flex items-center justify-center shrink-0">
                <span className="text-white text-sm font-bold">$</span>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Precio del combo</p>
                <p className="font-bold text-[#002060] text-lg">{formatCurrency(combo.payment_amount)}</p>
              </div>
            </div>
          )}

          {/* Individual vs combo comparison */}
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-center">
            <p className="text-sm text-green-700 font-medium">
              Pagando el combo te anotas a los {linkedEvents.length} partidos
            </p>
          </div>

          {/* CTA */}
          <div className="space-y-3 pt-1">
            {canConfirm ? (
              <Link href={`/combo/${combo.slug}/confirm`} className="block">
                <button className="w-full h-14 bg-[#00A651] hover:bg-[#009045] active:bg-[#00803e] text-white font-bold text-base rounded-xl transition-colors uppercase tracking-wide shadow-md shadow-[#00A651]/20">
                  Anotarme al combo
                </button>
              </Link>
            ) : (
              <div className="w-full h-14 bg-gray-100 text-gray-400 font-bold text-base rounded-xl flex items-center justify-center uppercase tracking-wide cursor-not-allowed">
                {!combo.is_open ? "Inscripciones cerradas" : "Algun evento esta completo"}
              </div>
            )}
            {/* Links to individual events */}
            <div className="text-center pt-1">
              <p className="text-xs text-gray-400 mb-1">O anotate a un evento individual:</p>
              <div className="flex flex-wrap justify-center gap-2">
                {linkedEvents.map((event) => (
                  <Link key={event.id} href={`/e/${event.slug}`} className="text-xs text-blue-600 underline">
                    {event.title}
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mx-3 rounded-b-2xl bg-[#002060] px-5 py-3 flex items-center justify-center gap-2">
          <div className="w-5 h-5 bg-[#00A651] rounded-full flex items-center justify-center">
            <span className="text-white text-[9px] font-black">SM</span>
          </div>
          <p className="text-white/50 text-xs">San Martin - Plantel Superior</p>
        </div>

      </div>
    </div>
  )
}
