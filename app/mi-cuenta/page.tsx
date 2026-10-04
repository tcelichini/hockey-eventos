"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { ChevronRightIcon, ReceiptIcon, WalletIcon } from "lucide-react"
import { normalizeName } from "@/lib/settlement"
import { personKey } from "@/lib/cuenta-corriente"
import { getDevicePhone } from "@/lib/device-phone"

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
  /** Nombre con el que figura en ese evento. */
  name: string
  net: number
  owed: number
  expPaid: number
  external: boolean
  paymentAccount: string | null
}

type Account = {
  key: string
  displayName: string | null
  total: number
  events: EventDetail[]
}

type AccountOption = { key: string; name: string }

// Estado de cuenta: el evento más viejo primero
function byDate(a: EventDetail, b: EventDetail) {
  return (a.date ?? "").localeCompare(b.date ?? "")
}

export default function MiCuentaPage({ searchParams }: { searchParams: { cuenta?: string; nombre?: string } }) {
  const [accounts, setAccounts] = useState<AccountOption[]>([])
  // ?cuenta= llega al volver de subir un comprobante: esa cuenta se abre sola. ?nombre= son los links viejos, por nombre.
  const initialName = typeof searchParams.nombre === "string" ? searchParams.nombre : null
  const [selected, setSelected] = useState(
    typeof searchParams.cuenta === "string" ? searchParams.cuenta : initialName ? normalizeName(initialName) : ""
  )
  const [account, setAccount] = useState<Account | null>(null)
  const [loading, setLoading] = useState(false)
  // Nombre de la Persona que este teléfono recuerda, por si su cuenta no tiene saldo y no está en la lista
  const [knownName, setKnownName] = useState<string | null>(null)

  useEffect(() => {
    let stale = false
    async function load() {
      const data = await fetch("/api/cuenta").then((res) => res.json()).catch(() => null)
      if (stale) return
      const list: AccountOption[] = data?.accounts || []
      setAccounts(list)

      // Si este teléfono recuerda un celular (eventos que piden celular), su cuenta viene elegida
      const phone = getDevicePhone()
      if (!phone) return
      const found = await fetch("/api/people/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      }).then((res) => (res.ok ? res.json() : null)).catch(() => null)
      if (stale || !found) return
      const known: { id: string; name: string }[] = found.people
      const withBalance = known.filter((p) => list.some((o) => o.key === personKey(p.id)))
      // Una sola Persona con saldo, o una sola Persona a secas (verá "Estás al día")
      const me = withBalance.length === 1 ? withBalance[0] : known.length === 1 ? known[0] : null
      if (!me) return
      setKnownName(me.name)
      setSelected((current) => current || personKey(me.id))
    }
    load()
    return () => { stale = true }
  }, [])

  useEffect(() => {
    setAccount(null)
    // La cuenta elegida queda en la URL: al volver de un evento (botón "Volver" o el atrás del celu) sigue elegida
    window.history.replaceState(null, "", selected ? `?cuenta=${encodeURIComponent(selected)}` : window.location.pathname)
    if (!selected) {
      setLoading(false)
      return
    }
    // Si cambian de cuenta antes de que llegue la respuesta, la vieja se descarta
    let stale = false
    setLoading(true)
    fetch(`/api/cuenta?key=${encodeURIComponent(selected)}`)
      .then((res) => res.json())
      .then((data) => { if (!stale) setAccount(data) })
      .catch(() => { if (!stale) setAccount(null) })
      .finally(() => { if (!stale) setLoading(false) })
    return () => { stale = true }
  }, [selected])

  // Quien ya saldó todo sale de la lista de cuentas con saldo: que siga elegido igual
  const options = selected && !accounts.some((o) => o.key === selected)
    ? [...accounts, { key: selected, name: account?.displayName ?? initialName ?? knownName ?? "Mi cuenta" }].sort((a, b) => a.name.localeCompare(b.name, "es"))
    : accounts
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
          onChange={(e) => setSelected(e.target.value)}
          className="w-full h-11 px-3 rounded-lg border border-gray-300 bg-white text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Elegí tu nombre...</option>
          {options.map((o) => (
            <option key={o.key} value={o.key}>{o.name}</option>
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

            {/* Eventos que debe: cada uno lleva a subir el comprobante, con el nombre de ese evento ya elegido */}
            {owedEvents.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-gray-500 text-center">Tocá un evento para subir el comprobante de pago</p>
                {owedEvents.map((detail, i) => (
                  <Link
                    key={i}
                    href={`/e/${detail.slug}/confirm?upload=1&from=mi-cuenta&nombre=${encodeURIComponent(detail.name)}&cuenta=${encodeURIComponent(account.key)}`}
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
