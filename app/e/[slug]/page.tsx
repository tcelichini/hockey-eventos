import { db } from "@/db"
import { events, attendees as attendeesTable, combos } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { notFound } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { CalendarIcon, ReceiptIcon, UsersIcon, CheckCircleIcon, PackageIcon } from "lucide-react"
import { calculatePrice, getTierLabel, calculateDatePrice, getDateTierLabel } from "@/lib/pricing"
import ExpenseForm from "@/components/expense-form"

import CollapsibleSection from "@/components/collapsible-section"
import type { Metadata } from "next"

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const [event] = await db.select().from(events).where(eq(events.slug, params.slug)).limit(1)
  if (!event) return {}

  const title = event.title
  const description = event.description || "Evento del club de hockey - San Martín"

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "website",
      siteName: "Eventos del Club",
      ...(event.flyer_url && {
        images: [{ url: event.flyer_url, width: 1200, height: 630, alt: title }],
      }),
    },
  }
}

function formatDate(date: Date | null) {
  if (!date) return ""
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(date))
}

function formatCurrency(amount: string | null) {
  if (!amount) return ""
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(Number(amount))
}

export default async function EventPage({ params }: { params: { slug: string } }) {
  const [event] = await db.select().from(events).where(eq(events.slug, params.slug)).limit(1)
  if (!event) notFound()

  const confirmedAttendees = await db
    .select({
      full_name: attendeesTable.full_name,
      payment_status: attendeesTable.payment_status,
      price_paid: attendeesTable.price_paid,
    })
    .from(attendeesTable)
    .where(and(eq(attendeesTable.event_id, event.id), eq(attendeesTable.status, "confirmed")))

  const confirmedCount = confirmedAttendees.length

  const isFull = event.max_capacity ? Number(confirmedCount) >= event.max_capacity : false
  const canConfirm = event.is_open && !isFull

  // Check for active combo containing this event
  const allCombos = await db.select().from(combos).where(eq(combos.is_open, true))
  const activeCombo = allCombos.find((c) =>
    (c.event_ids as string[]).includes(event.id)
  )
  const comboPrice = activeCombo?.date_tiers?.length
    ? calculateDatePrice(activeCombo.date_tiers, activeCombo.payment_amount)
    : activeCombo ? Number(activeCombo.payment_amount) : null

  return (
    <div className="min-h-screen bg-[#001435]">
      <div className="max-w-md mx-auto">

        {/* Banner */}
        {event.flyer_url ? (
          <div className="relative aspect-[4/3] w-full">
            {(() => {
              const [imgUrl, pos] = (event.flyer_url ?? "").split("#")
              const objectPosition = ["top", "center", "bottom"].includes(pos) ? pos : "center"
              return <Image src={imgUrl} alt={event.title} fill className="object-cover" style={{ objectPosition }} />
            })()}
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
          {event.date_tiers && event.date_tiers.length > 0 ? (
            // Precio por fecha
            <div className="bg-[#002060]/5 border border-[#002060]/10 rounded-xl px-4 py-3 space-y-2">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Costo por persona</p>
              {(() => {
                const today = new Date().toISOString().slice(0, 10)
                const sorted = [...event.date_tiers!].sort((a, b) => {
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
                        {formatCurrency(String(tier.price))}
                      </span>
                    </div>
                  )
                })
              })()}
              <div className="pt-1 border-t border-[#002060]/10">
                <p className="text-xs text-[#00A651] font-medium">
                  Tu precio hoy: {formatCurrency(String(calculateDatePrice(event.date_tiers, event.payment_amount)))}
                </p>
              </div>
            </div>
          ) : event.pricing_tiers && event.pricing_tiers.length > 0 ? (
            // Precio por cantidad
            <div className="bg-[#002060]/5 border border-[#002060]/10 rounded-xl px-4 py-3 space-y-2">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Costo por persona</p>
              {(() => {
                const sorted = [...event.pricing_tiers!].sort((a, b) => (a.upTo ?? Infinity) - (b.upTo ?? Infinity))
                return sorted.map((tier, i) => {
                  const isTierFull = tier.upTo !== null && Number(confirmedCount) >= tier.upTo
                  return (
                    <div key={i} className={`flex justify-between items-center ${isTierFull ? "opacity-40" : ""}`}>
                      <span className={`text-sm text-gray-600 ${isTierFull ? "line-through" : ""}`}>
                        {getTierLabel(tier, i, sorted)}
                      </span>
                      <span className={`font-bold text-[#002060] ${isTierFull ? "line-through" : ""}`}>
                        {formatCurrency(String(tier.price))}
                      </span>
                    </div>
                  )
                })
              })()}
              <div className="pt-1 border-t border-[#002060]/10">
                <p className="text-xs text-[#00A651] font-medium">
                  Tu precio: {formatCurrency(String(calculatePrice(event.pricing_tiers, event.payment_amount, Number(confirmedCount))))}
                </p>
              </div>
            </div>
          ) : (
            // Precio fijo
            <div className="flex items-center gap-3 bg-[#002060]/5 border border-[#002060]/10 rounded-xl px-4 py-3">
              <div className="w-8 h-8 bg-[#00A651] rounded-lg flex items-center justify-center shrink-0">
                <span className="text-white text-sm font-bold">$</span>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Costo por persona</p>
                <p className="font-bold text-[#002060] text-lg">{formatCurrency(event.payment_amount)}</p>
              </div>
            </div>
          )}

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

          {/* Combo banner */}
          {activeCombo && comboPrice && (
            <Link href={`/combo/${activeCombo.slug}`} className="block">
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-xl px-4 py-3 hover:border-blue-300 transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <PackageIcon className="w-4 h-4 text-blue-600" />
                  <p className="text-sm font-semibold text-blue-800">Combo disponible</p>
                </div>
                <p className="text-sm text-gray-600">
                  Paga {formatCurrency(String(comboPrice))} y anotate a los {(activeCombo.event_ids as string[]).length} partidos juntos
                </p>
                <p className="text-xs text-blue-600 font-medium mt-1 underline">Ver combo →</p>
              </div>
            </Link>
          )}

          {/* CTA Buttons */}
          <div className="space-y-3 pt-1">
            {event.is_3t ? (
              // Evento 3T: asistencia obligatoria, sólo subir comprobante
              <>
                <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-2.5 text-center">
                  <p className="text-sm text-blue-700 font-medium">Asistencia obligatoria para todo el plantel</p>
                </div>
                <Link href={`/e/${event.slug}/confirm`} className="block">
                  <button className="w-full h-14 bg-[#002060] hover:bg-[#001840] active:bg-[#001430] text-white font-bold text-base rounded-xl transition-colors uppercase tracking-wide shadow-md shadow-[#002060]/20">
                    🧾 Subir comprobante de pago
                  </button>
                </Link>
              </>
            ) : canConfirm ? (
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
            {!event.is_3t && (
              <>
                <Link href={`/e/${event.slug}/decline`} className="block">
                  <button className="w-full h-11 bg-white border-2 border-gray-200 hover:border-gray-300 text-gray-400 font-medium text-sm rounded-xl transition-colors">
                    No puedo ir esta vez
                  </button>
                </Link>
                <Link href={`/e/${event.slug}/confirm`} className="block text-center pt-1">
                  <span className="text-xs text-gray-400 underline">
                    Ya me anoté, quiero subir el comprobante
                  </span>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Confirmed attendees section */}
        {confirmedAttendees.length > 0 && (
          <CollapsibleSection
            icon={<UsersIcon className="w-4 h-4 text-[#002060]" />}
            title="¿Quiénes van?"
            badge={<span className="text-sm font-bold text-[#00A651]">{confirmedAttendees.length}</span>}
          >
            <div className="flex flex-wrap gap-2">
              {confirmedAttendees.map((a, i) => (
                <span
                  key={i}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm ${
                    a.payment_status === "paid"
                      ? "bg-green-50 text-green-700"
                      : "bg-[#002060]/5 text-gray-700"
                  }`}
                >
                  {a.payment_status === "paid" && <CheckCircleIcon className="w-3.5 h-3.5 text-green-500" />}
                  {a.full_name}
                </span>
              ))}
            </div>
          </CollapsibleSection>
        )}

        {/* Expense form section */}
        <CollapsibleSection
          icon={<ReceiptIcon className="w-4 h-4 text-[#002060]" />}
          title="Cargar gasto"
        >
          <ExpenseForm eventId={event.id} />
        </CollapsibleSection>

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
