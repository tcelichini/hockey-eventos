import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeftIcon, ChevronDownIcon } from "lucide-react"
import { getCuentasCorrientes } from "@/lib/cuenta-corriente-query"
import type { PersonAccount } from "@/lib/cuenta-corriente"
import WhatsAppCuentasButton from "@/components/whatsapp-cuentas-button"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(value)
}

function formatDate(date: Date | null) {
  if (!date) return ""
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(date))
}

export default async function CuentasPage() {
  const { accounts } = await getCuentasCorrientes()

  const debtors = accounts.filter((a) => a.total > 0)
  const creditors = accounts.filter((a) => a.total < 0)
  const totalToCollect = debtors.reduce((sum, a) => sum + a.total, 0)
  const totalToReturn = creditors.reduce((sum, a) => sum + Math.abs(a.total), 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-gray-400 hover:text-gray-600 transition">
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <h2 className="text-xl font-semibold text-gray-900">Cuenta corriente</h2>
        </div>
        <WhatsAppCuentasButton debtors={debtors.map((a) => ({ name: a.displayName, amount: a.total }))} />
      </div>

      {/* Empty state */}
      {accounts.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <p className="font-medium text-lg">Todos al día</p>
          <p className="text-sm mt-1">No hay saldos pendientes</p>
        </div>
      )}

      {accounts.length > 0 && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-gray-500 mb-1">Por cobrar</div>
                <div className="text-2xl font-bold text-orange-500">{formatCurrency(totalToCollect)}</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {debtors.length} persona{debtors.length !== 1 ? "s" : ""}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-xs text-gray-500 mb-1">Por devolver</div>
                <div className="text-2xl font-bold text-green-600">{formatCurrency(totalToReturn)}</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {creditors.length} persona{creditors.length !== 1 ? "s" : ""}
                </div>
              </CardContent>
            </Card>
          </div>

          {debtors.length > 0 && (
            <AccountSection title={`Deben pagar (${debtors.length})`} accounts={debtors} />
          )}
          {creditors.length > 0 && (
            <AccountSection title={`Se les debe devolver (${creditors.length})`} accounts={creditors} />
          )}
        </>
      )}
    </div>
  )
}

function AccountSection({ title, accounts }: { title: string; accounts: PersonAccount[] }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-400 uppercase tracking-wide">{title}</p>
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {accounts.map((account) => (
          <details key={account.key} className="group">
            <summary className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-3 cursor-pointer list-none">
              <div className="flex items-center gap-2 min-w-0">
                <ChevronDownIcon className="w-4 h-4 text-gray-300 shrink-0 transition-transform group-open:rotate-180" />
                <span className="text-sm text-gray-700">{account.displayName}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className={`text-sm font-medium ${account.total > 0 ? "text-orange-500" : "text-green-600"}`}>
                  {account.total > 0 ? `Debe ${formatCurrency(account.total)}` : `Le deben ${formatCurrency(Math.abs(account.total))}`}
                </span>
                <span className="text-xs text-gray-400">
                  {account.events.length} evento{account.events.length !== 1 ? "s" : ""}
                </span>
              </div>
            </summary>
            <div className="px-4 pb-3 pl-10 space-y-1.5">
              {account.events.map((detail, i) => (
                <div key={i} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 sm:gap-3 text-sm">
                  <div className="min-w-0">
                    <Link href={`/admin/events/${detail.event.id}`} className="text-gray-600 hover:text-blue-600">
                      {detail.event.title}
                    </Link>
                    <span className="text-xs text-gray-400 ml-2">{formatDate(detail.event.date)}</span>
                  </div>
                  <div className="text-right shrink-0">
                    <span className={detail.net > 0 ? "text-orange-500" : "text-green-600"}>
                      {detail.net > 0 ? formatCurrency(detail.net) : `−${formatCurrency(Math.abs(detail.net))}`}
                    </span>
                    {detail.expPaid > 0 && (
                      <p className="text-xs text-gray-400">
                        {detail.external
                          ? "gastó sin ser asistente"
                          : detail.net > 0
                            ? `${formatCurrency(detail.owed)} − ${formatCurrency(detail.expPaid)} gastos`
                            : `adelantó ${formatCurrency(detail.expPaid)} en gastos`}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>
    </div>
  )
}
