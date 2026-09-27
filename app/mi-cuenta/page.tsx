"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { ChevronRightIcon, ReceiptIcon, WalletIcon } from "lucide-react"

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

// Estado de cuenta: el evento más viejo primero
function byDate(a: EventDetail, b: EventDetail) {
  return (a.date ?? "").localeCompare(b.date ?? "")
}

export default function MiCuentaPage({ searchParams }: { searchParams: { nombre?: string } }) {
  const [names, setNames] = useState<string[]>([])
  // ?nombre= llega al volver de subir un comprobante: la cuenta de esa persona se abre sola
  const [selected, setSelected] = useState(typeof searchParams.nombre === "string" ? searchParams.nombre : "")
  const [account, setAccount] = useState<Account | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch("/api/cuenta")
      .then((res) => res.json())
      .then((data) => setNames(data.names || []))
      .catch(() => setNames([]))
  }, [])

  useEffect(() => {
    setAccount(null)
    if (!selected) {
      setLoading(false)
      return
    }
    // Si cambian de nombre antes de que llegue la respuesta, la vieja se descarta
    let stale = false
    setLoading(true)
    fetch(`/api/cuenta?name=${encodeURIComponent(selected)}`)
      .then((res) => res.json())
      .then((data) => { if (!stale) setAccount(data) })
      .catch(() => { if (!stale) setAccount(null) })
      .finally(() => { if (!stale) setLoading(false) })
    return () => { stale = true }
  }, [selected])

  function handleSelect(name: string) {
    setSelected(name)
    // El nombre queda en la URL: al volver de un evento (botón "Volver" o el atrás del celu) sigue elegido
    window.history.replaceState(null, "", name ? `?nombre=${encodeURIComponent(name)}` : window.location.pathname)
  }

  // Quien ya saldó todo sale de la lista de nombres con saldo: que siga elegido igual
  const options = selected && !names.includes(selected)
    ? [...names, selected].sort((a, b) => a.localeCompare(b, "es"))
    : names
  const owedEvents = account ? account.events.filter((d) => d.net > 0).sort(byDate) : []
  const creditEvents = account ? account.events.filter((d) => d.net < 0).sort(byDate) : []

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
          {options.map((name) => (
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

            {/* Eventos que debe: cada uno lleva a subir el comprobante, con el nombre ya elegido */}
            {owedEvents.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500 text-center">Tocá un evento para subir el comprobante de pago</p>
                {owedEvents.map((detail, i) => (
                  <Link
                    key={i}
                    href={`/e/${detail.slug}/confirm?upload=1&from=mi-cuenta&nombre=${encodeURIComponent(account.displayName)}`}
                    className="block bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:border-blue-300 active:bg-gray-50 transition-colors"
                  >
                    <div className="px-4 py-3 space-y-0.5">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-gray-900 min-w-0">{detail.title}</p>
                        <span className="text-sm font-semibold text-orange-500 shrink-0">{formatCurrency(detail.net)}</span>
                      </div>
                      <p className="text-xs text-gray-400">{formatDate(detail.date)}</p>
                      {detail.expPaid > 0 && (
                        <p className="text-xs text-gray-400">{formatCurrency(detail.owed)} − {formatCurrency(detail.expPaid)} que adelantaste en gastos</p>
                      )}
                      {detail.paymentAccount && (
                        <p className="text-xs text-blue-500 font-mono">Transferir a: {detail.paymentAccount}</p>
                      )}
                    </div>
                    <div className="flex items-center justify-between px-4 py-2.5 bg-blue-50 border-t border-blue-100 text-sm font-medium text-blue-700">
                      <span className="flex items-center gap-2">
                        <ReceiptIcon className="w-4 h-4" />
                        Subir comprobante
                      </span>
                      <ChevronRightIcon className="w-4 h-4" />
                    </div>
                  </Link>
                ))}
              </div>
            )}

            {/* Eventos donde se le debe plata: informativos, no hay nada que subir */}
            {creditEvents.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
                {creditEvents.map((detail, i) => (
                  <div key={i} className="px-4 py-3 space-y-0.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm text-gray-700">{detail.title}</p>
                        <p className="text-xs text-gray-400">{formatDate(detail.date)}</p>
                      </div>
                      <span className="text-sm font-medium shrink-0 text-green-600">−{formatCurrency(Math.abs(detail.net))}</span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {detail.external ? "adelantaste gastos sin ser asistente" : `adelantaste ${formatCurrency(detail.expPaid)} en gastos`}
                    </p>
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
