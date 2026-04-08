"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { CheckCircleIcon, ArrowLeftIcon, CopyIcon, CheckIcon } from "lucide-react"
import Link from "next/link"
import PaymentProofUpload from "@/components/payment-proof-upload"

type ComboData = {
  id: string
  title: string
  payment_amount: string
  payment_account: string
  whatsapp_number: string
  whatsapp_confirmation: boolean
  is_3t?: boolean
  players?: string[]
  events: { id: string; title: string; date: string }[]
}

type PaymentData = {
  payment_account: string
  payment_amount: string
  whatsapp_number: string
  combo_title: string
  attendee_name: string
}

function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 fill-current" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  )
}

export default function ComboConfirmPage() {
  const params = useParams()
  const slug = params.slug as string

  const [combo, setCombo] = useState<ComboData | null>(null)
  const [step, setStep] = useState<"form" | "payment">("form")
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null)
  const [attendeeIds, setAttendeeIds] = useState<string[]>([])
  const [proofUrl, setProofUrl] = useState<string | null>(null)
  const [isExisting, setIsExisting] = useState(false)
  const [alreadyPaid, setAlreadyPaid] = useState(false)
  const [copiedAlias, setCopiedAlias] = useState(false)

  function copyAlias(text: string) {
    navigator.clipboard.writeText(text)
    setCopiedAlias(true)
    setTimeout(() => setCopiedAlias(false), 2000)
  }

  useEffect(() => {
    fetch(`/api/combos/by-slug/${slug}`)
      .then((r) => r.json())
      .then(setCombo)
  }, [slug])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!combo) return
    setLoading(true)
    setError("")

    const res = await fetch("/api/combo-attendees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ combo_id: combo.id, full_name: name, status: "confirmed" }),
    })

    if (res.ok) {
      const data = await res.json()
      const ids = (data.attendees as { id: string }[]).map((a) => a.id)
      setAttendeeIds(ids)
      setIsExisting(!!data.existing)
      setAlreadyPaid(!!data.already_paid)
      setPaymentData({
        payment_account: data.payment_account,
        payment_amount: data.payment_amount,
        whatsapp_number: data.whatsapp_number,
        combo_title: data.combo_title,
        attendee_name: name,
      })
      setStep("payment")
    } else {
      const err = await res.json()
      setError(err.error || "Error al confirmar")
    }
    setLoading(false)
  }

  function buildWhatsAppUrl(data: PaymentData): string {
    let message = `Hola! Te mando el comprobante del combo "${data.combo_title}". Soy ${data.attendee_name}.`
    if (proofUrl) {
      message += `\n\nComprobante: ${proofUrl}`
    }
    return `https://wa.me/${data.whatsapp_number}?text=${encodeURIComponent(message)}`
  }

  // Extrae el nombre de pila de "Apellido, Nombre" → "Nombre", o "Nombre Apellido" → "Nombre"
  function getFirstName(fullName: string): string {
    if (fullName.includes(",")) {
      return fullName.split(",")[1].trim().split(" ")[0]
    }
    return fullName.split(" ")[0]
  }

  function formatCurrency(amount: string) {
    return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(Number(amount))
  }

  if (!combo) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-400">Cargando...</p>
      </div>
    )
  }

  const is3t = combo.is_3t && combo.players && combo.players.length > 0

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center gap-3">
          <Link href={`/combo/${slug}`}>
            <Button variant="ghost" size="sm">
              <ArrowLeftIcon className="w-4 h-4 mr-1" />
              Volver
            </Button>
          </Link>
          <h1 className="font-semibold text-gray-900 truncate">{combo.title}</h1>
        </div>

        {step === "form" ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center mb-6">
                <div className="text-4xl mb-2">🎯</div>
                <h2 className="text-xl font-bold text-gray-900">
                  {is3t ? "Pagar el combo" : "Anotarme al combo"}
                </h2>
                <p className="text-gray-500 text-sm mt-1">
                  {is3t
                    ? `Seleccioná tu nombre para pagar los ${combo.events?.length || 0} partidos juntos`
                    : `Te anotas a ${combo.events?.length || 0} partidos con descuento`}
                </p>
                {combo.events && (
                  <div className="mt-2 space-y-0.5">
                    {combo.events.map((ev) => (
                      <p key={ev.id} className="text-xs text-gray-400">{ev.title}</p>
                    ))}
                  </div>
                )}
                {is3t ? (
                  <p className="text-gray-400 text-xs mt-3">Ya estás pre-inscripto. Seleccioná tu nombre y subí el comprobante.</p>
                ) : (
                  <p className="text-gray-400 text-xs mt-3">Si ya te anotaste al combo, pon tu nombre para ver los datos de pago.</p>
                )}
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  {is3t ? (
                    <>
                      <Label htmlFor="name">Seleccioná tu nombre</Label>
                      <select
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="">-- Seleccioná --</option>
                        {combo.players!.map((player) => (
                          <option key={player} value={player}>{player}</option>
                        ))}
                      </select>
                    </>
                  ) : (
                    <>
                      <Label htmlFor="name">Tu nombre completo</Label>
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Ej: Juan Perez"
                        autoComplete="name"
                        required
                        autoFocus
                      />
                    </>
                  )}
                </div>

                {error && <p className="text-red-500 text-sm">{error}</p>}

                <Button type="submit" className="w-full h-12 bg-green-600 hover:bg-green-700" disabled={loading || (is3t ? !name : false)}>
                  {loading ? "Confirmando..." : is3t ? "Ver datos de pago" : "Confirmar"}
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : paymentData ? (
          <div className="space-y-4">
            <Card>
              <CardContent className="pt-6">
                {alreadyPaid ? (
                  <div className="text-center mb-4">
                    <CheckCircleIcon className="w-12 h-12 text-green-500 mx-auto mb-2" />
                    <h2 className="text-xl font-bold text-gray-900">
                      Ya pagaste el combo, {getFirstName(paymentData.attendee_name)}!
                    </h2>
                    <p className="text-gray-500 text-sm mt-1">Tu pago del combo ya fue registrado.</p>
                  </div>
                ) : (
                  <>
                    <div className="text-center mb-6">
                      <CheckCircleIcon className="w-12 h-12 text-green-500 mx-auto mb-2" />
                      <h2 className="text-xl font-bold text-gray-900">
                        {isExisting
                          ? `Hola, ${getFirstName(paymentData.attendee_name)}!`
                          : `Anotado al combo, ${getFirstName(paymentData.attendee_name)}!`}
                      </h2>
                      <p className="text-gray-500 text-sm mt-1">
                        Subi tu comprobante de pago para confirmar.
                      </p>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                      <h3 className="font-semibold text-gray-700 text-sm">Datos para la transferencia</h3>
                      <div className="space-y-2">
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-wide">Monto del combo</p>
                          <p className="text-2xl font-bold text-green-600">{formatCurrency(paymentData.payment_amount)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 uppercase tracking-wide">CBU / Alias</p>
                          <div className="flex items-center gap-2">
                            <p className="font-mono font-medium text-gray-800 text-sm break-all">{paymentData.payment_account}</p>
                            <button
                              onClick={() => copyAlias(paymentData.payment_account)}
                              className="shrink-0 p-1.5 rounded-lg hover:bg-gray-200 transition-colors text-gray-400 hover:text-gray-700"
                              title="Copiar alias"
                            >
                              {copiedAlias
                                ? <CheckIcon className="w-4 h-4 text-green-500" />
                                : <CopyIcon className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {!alreadyPaid && attendeeIds.length > 0 && (
              <PaymentProofUpload
                attendeeId={attendeeIds[0]}
                extraAttendeeIds={attendeeIds.slice(1)}
                onUploaded={(url) => setProofUrl(url)}
              />
            )}

            {!alreadyPaid && combo.whatsapp_confirmation && (
              <>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-gray-200" />
                  <span className="text-xs text-gray-400">o envialo por WhatsApp</span>
                  <div className="flex-1 h-px bg-gray-200" />
                </div>

                <a
                  href={buildWhatsAppUrl(paymentData)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-3 bg-green-500 hover:bg-green-600 text-white rounded-xl px-5 py-4 w-full text-base font-semibold transition-colors"
                >
                  <WhatsAppIcon />
                  Enviar comprobante por WhatsApp
                </a>
              </>
            )}
          </div>
        ) : null}
      </div>
    </div>
  )
}
