import { db } from "@/db"
import { events, attendees, expenses } from "@/db/schema"
import { eq, inArray } from "drizzle-orm"
import { notFound } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { ArrowLeftIcon, PencilIcon } from "lucide-react"
import CopyLinkButton from "@/components/copy-link-button"
import DeleteEventButton from "@/components/delete-event-button"
import ToggleEventButton from "@/components/toggle-event-button"
import DeleteAttendeeButton from "@/components/delete-attendee-button"
import ExportCsvButton from "@/components/export-csv-button"
import ExpenseItem from "@/components/expense-item"
import CollapsibleCard from "@/components/collapsible-card"
import PaymentReminderButton from "@/components/payment-reminder-button"
import WhatsAppInviteButton from "@/components/whatsapp-invite-button"
import RefreshButton from "@/components/refresh-button"
import AddAttendeeButton from "@/components/add-attendee-button"
import SortableAttendeeList from "@/components/sortable-attendee-list"
import ExpenseForm from "@/components/expense-form"
import SettleCreditorButton from "@/components/settle-creditor-button"
import { getTierLabel, getDateTierLabel, todayArg } from "@/lib/pricing"
import { settleEvent, getOwedPrice, normalizeName } from "@/lib/settlement"
import { classifyComboPayment } from "@/lib/combo-payment"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(value)
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


export default async function EventDetailPage({ params }: { params: { id: string } }) {
  const [event] = await db.select().from(events).where(eq(events.id, params.id)).limit(1)
  if (!event) notFound()

  const attendeeList = await db
    .select()
    .from(attendees)
    .where(eq(attendees.event_id, event.id))
    .orderBy(attendees.full_name)

  const confirmed = attendeeList.filter((a) => a.status === "confirmed")
  const declined = attendeeList.filter((a) => a.status === "declined")

  // Badge "Combo": asistentes que pagaron vía combo (misma proof URL en todos
  // sus registros del combo). Requiere los registros de otros eventos del combo.
  const comboIds = Array.from(new Set(confirmed.filter(a => a.combo_id).map(a => a.combo_id!)))
  let paidViaCombo = new Set<string>()
  if (comboIds.length > 0) {
    const allComboAttendees = await db
      .select({ id: attendees.id, combo_id: attendees.combo_id, full_name: attendees.full_name, payment_proof_url: attendees.payment_proof_url })
      .from(attendees)
      .where(inArray(attendees.combo_id, comboIds))
    paidViaCombo = classifyComboPayment(allComboAttendees)
  }

  const amount = Number(event.payment_amount) || 0
  const getPrice = (a: typeof confirmed[0]) => Number(a.price_paid) || amount
  const inferioresPrice = event.inferiores_price ? Number(event.inferiores_price) : null

  const expenseList = await db
    .select()
    .from(expenses)
    .where(eq(expenses.event_id, event.id))
    .orderBy(expenses.created_at)

  // Liquidación completa (lib/settlement.ts): balances, deudores, acreedores y totales
  const settlement = settleEvent({ event, attendees: confirmed, expenses: expenseList })
  const owedOf = (a: typeof confirmed[0]) => getOwedPrice(event, a)

  // Aplicar el sync que decidió la liquidación: pendientes cuyos gastos cubren el evento
  if (settlement.toMarkPaid.length > 0) {
    await db.update(attendees)
      .set({ payment_status: "paid" })
      .where(inArray(attendees.id, settlement.toMarkPaid))
    const toMarkPaidIds = new Set(settlement.toMarkPaid)
    for (const a of confirmed) {
      if (toMarkPaidIds.has(a.id)) a.payment_status = "paid"
    }
  }

  const {
    coveredByExpensesIds,
    expenseByPerson,
    aliasByPerson,
    expenseIdsByPerson,
    settledByPerson,
    totalCollected,
    totalExpenses,
    balance,
    totalPending,
  } = settlement

  const paid = confirmed.filter((a) => a.payment_status === "paid")
  // Asistentes cubiertos por gastos (marcados como paid sin comprobante)
  const coveredByExpenses = confirmed.filter(a => coveredByExpensesIds.has(a.id))
  const pendingCount = settlement.debtors.length
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").trim()
  const publicLink = `${appUrl}/e/${event.slug}`

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Link href="/admin">
          <Button variant="ghost" size="sm">
            <ArrowLeftIcon className="w-4 h-4 mr-1" />
            Volver
          </Button>
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <RefreshButton />
          <ExportCsvButton eventId={params.id} />
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
          {event.date_tiers && event.date_tiers.length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Precios por fecha</p>
              {(() => {
                const today = todayArg()
                const sorted = [...event.date_tiers!].sort((a, b) => {
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
          {event.pricing_tiers && event.pricing_tiers.length > 0 && (
            <div className="mt-3 space-y-1">
              <p className="text-xs text-gray-400 uppercase tracking-wide">Precios por tramo</p>
              {(() => {
                const sorted = [...event.pricing_tiers!].sort((a, b) => (a.upTo ?? Infinity) - (b.upTo ?? Infinity))
                return sorted.map((tier, i) => (
                  <p key={i} className="text-sm text-gray-700">
                    {getTierLabel(tier, i, sorted)}: {formatCurrency(tier.price)}
                  </p>
                ))
              })()}
            </div>
          )}
          {inferioresPrice !== null && (
            <p className="text-sm text-amber-700 mt-2">
              Precio inferiores: <span className="font-medium">{formatCurrency(inferioresPrice)}</span>
            </p>
          )}
          <div className="mt-3 flex items-center gap-2">
            <code className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600 break-all">{publicLink}</code>
            <CopyLinkButton link={publicLink} />
          </div>
          <WhatsAppInviteButton
            eventTitle={event.title}
            eventDescription={event.description}
            eventDate={event.date}
            publicLink={publicLink}
            maxCapacity={event.max_capacity}
            confirmedCount={confirmed.length}
            attendees={confirmed.map(a => ({ full_name: a.full_name }))}
            paymentAmount={amount}
            pricingTiers={event.pricing_tiers}
          />
        </CardContent>
      </Card>

      {/* Stats */}
      <div className={`grid gap-3 ${coveredByExpenses.length > 0 ? "grid-cols-3" : "grid-cols-2"}`}>
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
        {coveredByExpenses.length > 0 && (
          <Card>
            <CardContent className="pt-4 pb-4 text-center">
              <div className="text-3xl font-bold text-amber-600">{coveredByExpenses.length}</div>
              <div className="text-xs text-gray-500 mt-1">Cubiertos por gastos</div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Money Stats */}
      {(totalCollected + totalPending) > 0 && (
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-xs text-gray-500 mb-1">Recaudado</div>
              <div className="text-xl font-bold text-green-600">{formatCurrency(totalCollected)}</div>
              <div className="text-xs text-gray-400 mt-0.5">{paid.length} pagaron de {confirmed.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="text-xs text-gray-500 mb-1">Falta cobrar</div>
              <div className="text-xl font-bold text-orange-500">{formatCurrency(totalPending)}</div>
              <div className="text-xs text-gray-400 mt-0.5">{pendingCount} pendiente{pendingCount !== 1 ? "s" : ""}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Summary — debtors + expense split */}
      <CollapsibleCard title="Resumen">
        {confirmed.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-2">Sin asistentes confirmados</p>
        ) : (() => {
          // Balance neto por asistente: calculado por settleEvent (lib/settlement.ts)
          const { debtors, creditors, externalCreditors } = settlement

          return (
            <div className="space-y-3">
              {debtors.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs text-gray-400 uppercase tracking-wide">Deben pagar ({debtors.length})</p>
                  {debtors.map(({ attendee: a, net, expPaid, owed }) => (
                    <div key={a.id} className="flex items-center justify-between text-sm">
                      <span className="text-gray-700">{a.full_name}</span>
                      <div className="text-right">
                        <span className="font-medium text-orange-500">{formatCurrency(net)}</span>
                        {expPaid > 0 && (
                          <p className="text-xs text-gray-400">{formatCurrency(owed)} − {formatCurrency(expPaid)} gastos</p>
                        )}
                      </div>
                    </div>
                  ))}
                  <PaymentReminderButton
                    unpaidList={debtors.map(({ attendee: a, net }) => ({ name: a.full_name, amount: net }))}
                    eventTitle={event.title}
                  />
                </div>
              )}

              {creditors.length > 0 && (() => {
                const unsettled = creditors.filter(({ attendee: a }) => !settledByPerson.get(normalizeName(a.full_name)))
                const settled = creditors.filter(({ attendee: a }) => settledByPerson.get(normalizeName(a.full_name)))
                return (
                  <div className={`space-y-2 ${debtors.length > 0 ? "pt-3 border-t border-gray-100" : ""}`}>
                    <p className="text-xs text-gray-400 uppercase tracking-wide">
                      Se les debe devolver{unsettled.length < creditors.length ? ` (${unsettled.length} pendiente${unsettled.length !== 1 ? "s" : ""})` : ""}
                    </p>
                    {unsettled.map(({ attendee: a, net, expPaid, paidViaExpenses, owed }) => {
                      const key = normalizeName(a.full_name)
                      const alias = aliasByPerson.get(key)
                      const ids = expenseIdsByPerson.get(key) || []
                      return (
                        <div key={a.id} className="flex items-start justify-between gap-2 text-sm">
                          <div>
                            <span className="text-gray-700">{a.full_name}</span>
                            {alias && (
                              <p className="text-xs text-blue-500 font-mono mt-0.5">Transferir a: {alias}</p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <div className="flex items-center gap-1.5 justify-end">
                              <span className="font-medium text-green-600">Le deben {formatCurrency(Math.abs(net))}</span>
                              <SettleCreditorButton expenseIds={ids} />
                            </div>
                            {expPaid > 0 && paidViaExpenses && (
                              <p className="text-xs text-gray-400">{formatCurrency(expPaid)} gastos − {formatCurrency(owed)} evento</p>
                            )}
                            {expPaid > 0 && !paidViaExpenses && a.payment_status === "paid" && (
                              <p className="text-xs text-gray-400">pagó evento + {formatCurrency(expPaid)} en gastos</p>
                            )}
                            {expPaid > 0 && !paidViaExpenses && a.payment_status !== "paid" && (
                              <p className="text-xs text-gray-400">{formatCurrency(owed)} − {formatCurrency(expPaid)} gastos</p>
                            )}
                          </div>
                        </div>
                      )
                    })}
                    {settled.length > 0 && (
                      <div className={`space-y-1 ${unsettled.length > 0 ? "pt-2 border-t border-gray-100" : ""}`}>
                        <p className="text-xs text-gray-400 uppercase tracking-wide">Ya saldados</p>
                        {settled.map(({ attendee: a }) => {
                          const key = normalizeName(a.full_name)
                          const ids = expenseIdsByPerson.get(key) || []
                          return (
                            <div key={a.id} className="flex items-center justify-between text-sm">
                              <span className="text-gray-400 line-through">{a.full_name}</span>
                              <SettleCreditorButton expenseIds={ids} settled={true} />
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })()}

              {externalCreditors.length > 0 && (() => {
                const unsettledExt = externalCreditors.filter(c => !settledByPerson.get(c.key))
                const settledExt = externalCreditors.filter(c => settledByPerson.get(c.key))
                return (
                  <div className={`space-y-2 ${(debtors.length > 0 || creditors.length > 0) ? "pt-3 border-t border-gray-100" : ""}`}>
                    <p className="text-xs text-gray-400 uppercase tracking-wide">
                      Pagaron sin ser asistentes{unsettledExt.length < externalCreditors.length ? ` (${unsettledExt.length} pendiente${unsettledExt.length !== 1 ? "s" : ""})` : ""}
                    </p>
                    {unsettledExt.map(({ name, expPaid, key }) => {
                      const alias = aliasByPerson.get(key)
                      const ids = expenseIdsByPerson.get(key) || []
                      return (
                        <div key={key} className="flex items-start justify-between gap-2 text-sm">
                          <div>
                            <span className="text-gray-700">{name}</span>
                            {alias && (
                              <p className="text-xs text-blue-500 font-mono mt-0.5">Transferir a: {alias}</p>
                            )}
                          </div>
                          <div className="text-right shrink-0">
                            <div className="flex items-center gap-1.5 justify-end">
                              <span className="font-medium text-green-600">Le deben {formatCurrency(expPaid)}</span>
                              <SettleCreditorButton expenseIds={ids} />
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    {settledExt.length > 0 && (
                      <div className={`space-y-1 ${unsettledExt.length > 0 ? "pt-2 border-t border-gray-100" : ""}`}>
                        <p className="text-xs text-gray-400 uppercase tracking-wide">Ya saldados</p>
                        {settledExt.map(({ name, key }) => {
                          const ids = expenseIdsByPerson.get(key) || []
                          return (
                            <div key={key} className="flex items-center justify-between text-sm">
                              <span className="text-gray-400 line-through">{name}</span>
                              <SettleCreditorButton expenseIds={ids} settled={true} />
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })()}

              {debtors.length === 0 && creditors.length === 0 && externalCreditors.length === 0 && (
                <p className="text-sm text-green-600 font-medium">✅ Todos al día</p>
              )}
            </div>
          )
        })()}
      </CollapsibleCard>

      {/* Expenses */}
      <CollapsibleCard
        title={`Gastos del evento (${expenseList.length})`}
        headerRight={totalExpenses > 0 ? (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-500">Total: <span className="font-bold text-red-500">{formatCurrency(totalExpenses)}</span></span>
            {(totalCollected + totalPending) > 0 && (
              <span className="text-gray-500">Balance: <span className={`font-bold ${balance >= 0 ? "text-green-600" : "text-red-500"}`}>{formatCurrency(balance)}</span></span>
            )}
          </div>
        ) : undefined}
      >
        <div className="pb-3">
          <ExpenseForm
            eventId={params.id}
            attendeeNames={confirmed.length > 0 ? confirmed.map((a) => a.full_name) : undefined}
            compact
          />
        </div>
        {expenseList.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-4">No hay gastos cargados</p>
        ) : (
          <>
            <div className="divide-y">
              {expenseList.map((expense) => (
                <ExpenseItem
                  key={expense.id}
                  expense={{ id: expense.id, description: expense.description, responsible: expense.responsible, amount: expense.amount!, notes: expense.notes, payment_alias: expense.payment_alias, receipt_url: expense.receipt_url }}
                  attendeeNames={confirmed.length > 0 ? confirmed.map((a) => a.full_name) : undefined}
                />
              ))}
            </div>
            {confirmed.length > 0 && (
              <div className="pt-3 mt-1 border-t border-gray-100">
                <p className="text-sm text-gray-700">
                  Total: <span className="font-bold">{formatCurrency(totalExpenses)}</span>
                  <span className="text-gray-400"> ÷ {confirmed.length} personas = </span>
                  <span className="font-bold">{formatCurrency(Math.round(totalExpenses / confirmed.length))}</span>
                  <span className="text-gray-400"> c/u</span>
                </p>
              </div>
            )}
          </>
        )}
      </CollapsibleCard>

      {/* Attendees */}
      <CollapsibleCard title={`Asistentes (${confirmed.length})`}>
        <div className="pb-3">
          <AddAttendeeButton eventId={params.id} />
        </div>
        {confirmed.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-4">Nadie confirmó aún</p>
        ) : (
          <SortableAttendeeList
            attendees={confirmed.map(a => {
              const shortDateFmt = new Intl.DateTimeFormat("es-AR", {
                day: "numeric",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "America/Argentina/Buenos_Aires",
              })
              const isCovered = coveredByExpensesIds.has(a.id)
              const showOwedPrice = isCovered || a.payment_status !== "paid"
              const displayPrice = showOwedPrice ? owedOf(a) : getPrice(a)
              return {
                id: a.id,
                full_name: a.full_name,
                payment_status: a.payment_status,
                payment_proof_url: a.payment_proof_url,
                combo_id: a.combo_id,
                price: displayPrice,
                priceFormatted: formatCurrency(displayPrice),
                paidViaCombo: paidViaCombo.has(a.id),
                createdAtISO: a.created_at ? new Date(a.created_at).toISOString() : null,
                createdAtFormatted: a.created_at ? shortDateFmt.format(new Date(a.created_at)) : null,
                proofUploadedAtISO: a.proof_uploaded_at ? new Date(a.proof_uploaded_at).toISOString() : null,
                proofUploadedAtFormatted: a.proof_uploaded_at ? shortDateFmt.format(new Date(a.proof_uploaded_at)) : null,
                isInferiores: a.is_inferiores,
                coveredByExpenses: coveredByExpensesIds.has(a.id),
                hasExpenses: (expenseByPerson.get(normalizeName(a.full_name)) || 0) > 0,
              }
            })}
            hasInferioresPrice={inferioresPrice !== null}
          />
        )}
      </CollapsibleCard>

      {declined.length > 0 && (
        <CollapsibleCard title={`No van (${declined.length})`} defaultOpen={false}>
          <div className="divide-y">
            {declined.map((attendee) => (
              <div key={attendee.id} className="py-2 flex items-center justify-between gap-2">
                <p className="text-gray-500 text-sm">{attendee.full_name}</p>
                <DeleteAttendeeButton attendeeId={attendee.id} />
              </div>
            ))}
          </div>
        </CollapsibleCard>
      )}
    </div>
  )
}
