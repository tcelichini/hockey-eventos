"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { WalletIcon } from "lucide-react"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(value)
}

function formatDate(iso: string | null) {
  if (!iso) return ""
  return new Intl.DateTimeFormat("es-AR", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(iso))
}

type EventDetail = {
  title: string
  date: string | null
  slug: string
  net: number
  owed: number
  expPaid: number
  external: boolean
  paymentAccount: string | null
}

type Account = {
  displayName: string
  total: number
  events: EventDetail[]
}

export default function MiCuentaPage() {
  const [names, setNames] = useState<string[]>([])
  const [selected, setSelected] = useState("")
  const [account, setAccount] = useState<Account | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch("/api/cuenta")
      .then((res) => res.json())
      .then((data) => setNames(data.names || []))
      .catch(() => setNames([]))
  }, [])

  async function handleSelect(name: string) {
    setSelected(name)
    setAccount(null)
    if (!name) return
    setLoading(true)
    try {
      const res = await fetch(`/api/cuenta?name=${encodeURIComponent(name)}`)
      setAccount(await res.json())
    } catch {
      setAccount(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto px-4 py-8 space-y-5">
        <div className="text-center">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <WalletIcon className="w-6 h-6 text-blue-600" />
          </div>
          <h1 className="text-xl font-bold text-gray-900">Mi cuenta corriente</h1>
          <p className="text-sm text-gray-500 mt-1">Elegí tu nombre y mirá cuánto te falta pagar (o cuánto te deben)</p>
        </div>

        <select
          value={selected}
          onChange={(e) => handleSelect(e.target.value)}
          className="w-full h-11 px-3 rounded-lg border border-gray-300 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Elegí tu nombre...</option>
          {names.map((name) => (
            <option key={name} value={name}>{name}</option>
          ))}
        </select>

        {loading && <p className="text-center text-sm text-gray-400 py-4">Calculando...</p>}

        {account && !loading && (
          <>
            <Card>
              <CardContent className="p-5 text-center">
                {account.total === 0 ? (
                  <>
                    <p className="text-2xl font-bold text-green-600">Estás al día ✅</p>
                    <p className="text-sm text-gray-400 mt-1">No tenés saldos pendientes</p>
                  </>
                ) : account.total > 0 ? (
                  <>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Te falta pagar</p>
                    <p className="text-3xl font-bold text-orange-500">{formatCurrency(account.total)}</p>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Te deben devolver</p>
                    <p className="text-3xl font-bold text-green-600">{formatCurrency(Math.abs(account.total))}</p>
                  </>
                )}
              </CardContent>
            </Card>

            {account.events.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                {account.events.map((detail, i) => (
                  <div key={i} className="px-4 py-3 space-y-0.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <a href={`/e/${detail.slug}`} className="text-sm text-gray-700 hover:text-blue-600">
                          {detail.title}
                        </a>
                        <p className="text-xs text-gray-400">{formatDate(detail.date)}</p>
                      </div>
                      <span className={`text-sm font-medium shrink-0 ${detail.net > 0 ? "text-orange-500" : "text-green-600"}`}>
                        {detail.net > 0 ? formatCurrency(detail.net) : `−${formatCurrency(Math.abs(detail.net))}`}
                      </span>
                    </div>
                    {detail.expPaid > 0 && detail.net > 0 && (
                      <p className="text-xs text-gray-400">{formatCurrency(detail.owed)} − {formatCurrency(detail.expPaid)} que adelantaste en gastos</p>
                    )}
                    {detail.net < 0 && (
                      <p className="text-xs text-gray-400">
                        {detail.external ? "adelantaste gastos sin ser asistente" : `adelantaste ${formatCurrency(detail.expPaid)} en gastos`}
                      </p>
                    )}
                    {detail.paymentAccount && (
                      <p className="text-xs text-blue-500 font-mono">Transferir a: {detail.paymentAccount}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
