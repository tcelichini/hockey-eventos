"use client"

import { useState, useEffect } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { ArrowLeftIcon } from "lucide-react"
import ImageUpload from "@/components/image-upload"
import PricingTiersEditor from "@/components/pricing-tiers-editor"
import DateTiersEditor from "@/components/date-tiers-editor"
import type { PricingTier, DateTier } from "@/db/schema"

type PricingMode = "fixed" | "tiers" | "date"

type EventData = {
  id: string
  title: string
  description: string | null
  date: string
  flyer_url: string | null
  payment_account: string
  payment_amount: string
  whatsapp_number: string
  whatsapp_confirmation: boolean
  max_capacity: number | null
  pricing_tiers: PricingTier[] | null
  date_tiers: DateTier[] | null
  is_3t: boolean
}

function toDatetimeLocal(isoString: string) {
  const d = new Date(isoString)
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
  const parts = fmt.formatToParts(d)
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? ""
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`
}

function detectMode(data: EventData): PricingMode {
  if (data.date_tiers && data.date_tiers.length > 0) return "date"
  if (data.pricing_tiers && data.pricing_tiers.length > 0) return "tiers"
  return "fixed"
}

export default function EditEventPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [event, setEvent] = useState<EventData | null>(null)
  const [flyerUrl, setFlyerUrl] = useState<string | null>(null)
  const [pricingMode, setPricingMode] = useState<PricingMode>("fixed")
  const [pricingTiers, setPricingTiers] = useState<PricingTier[] | null>(null)
  const [dateTiers, setDateTiers] = useState<DateTier[] | null>(null)
  const [whatsappConfirmation, setWhatsappConfirmation] = useState(false)
  const [is3t, setIs3t] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch(`/api/events/by-id/${id}`)
      .then((r) => r.json())
      .then((data: EventData) => {
        setEvent(data)
        setFlyerUrl(data.flyer_url)
        setPricingTiers(data.pricing_tiers)
        setDateTiers(data.date_tiers)
        setPricingMode(detectMode(data))
        setWhatsappConfirmation(data.whatsapp_confirmation ?? false)
        setIs3t(data.is_3t ?? false)
      })
  }, [id])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError("")

    const form = e.currentTarget
    const maxCapacityVal = (form.elements.namedItem("max_capacity") as HTMLInputElement).value
    const data = {
      title: (form.elements.namedItem("title") as HTMLInputElement).value,
      description: (form.elements.namedItem("description") as HTMLTextAreaElement).value,
      date: (form.elements.namedItem("date") as HTMLInputElement).value,
      flyer_url: flyerUrl,
      payment_account: (form.elements.namedItem("payment_account") as HTMLInputElement).value,
      payment_amount: parseFloat((form.elements.namedItem("payment_amount") as HTMLInputElement).value),
      whatsapp_number: (form.elements.namedItem("whatsapp_number") as HTMLInputElement).value,
      max_capacity: maxCapacityVal ? parseInt(maxCapacityVal) : null,
      pricing_tiers: pricingMode === "tiers" ? pricingTiers : null,
      date_tiers: pricingMode === "date" ? dateTiers : null,
      whatsapp_confirmation: whatsappConfirmation,
      is_3t: is3t,
    }

    const res = await fetch(`/api/events/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })

    if (res.ok) {
      router.push(`/admin/events/${id}`)
    } else {
      const err = await res.json()
      setError(err.error || "Error al actualizar el evento")
      setLoading(false)
    }
  }

  if (!event) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-gray-400">Cargando...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/admin/events/${id}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeftIcon className="w-4 h-4 mr-1" />
            Volver
          </Button>
        </Link>
        <h2 className="text-xl font-semibold text-gray-900">Editar evento</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos del evento</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Nombre del evento *</Label>
              <Input id="title" name="title" defaultValue={event.title} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                name="description"
                defaultValue={event.description ?? ""}
                rows={3}
              />
            </div>

            <div className="flex items-center gap-3 pb-1">
              <input
                type="checkbox"
                id="is_3t"
                checked={is3t}
                onChange={(e) => setIs3t(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <Label htmlFor="is_3t" className="cursor-pointer">🍖 Tercer Tiempo (3T)</Label>
                <p className="text-xs text-gray-400">
                  Evento obligatorio para todo el plantel. En la página pública sólo pueden seleccionar su nombre y subir el comprobante.
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Imagen del evento (opcional)</Label>
              <ImageUpload value={flyerUrl} onChange={setFlyerUrl} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Fecha y hora *</Label>
              <Input
                id="date"
                name="date"
                type="datetime-local"
                defaultValue={toDatetimeLocal(event.date)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="max_capacity">Límite de cupos (opcional)</Label>
              <Input
                id="max_capacity"
                name="max_capacity"
                type="number"
                min="1"
                placeholder="Sin límite"
                defaultValue={event.max_capacity ?? ""}
              />
            </div>

            <div className="border-t pt-4 space-y-4">
              <h3 className="font-medium text-gray-700">Datos de pago</h3>

              {/* Selector de modo de precio */}
              <div className="space-y-2">
                <Label>Tipo de precio</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(["fixed", "tiers", "date"] as PricingMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setPricingMode(mode)}
                      className={`text-sm py-2 px-3 rounded-lg border transition-colors ${
                        pricingMode === mode
                          ? "border-blue-500 bg-blue-50 text-blue-700 font-medium"
                          : "border-gray-200 text-gray-500 hover:border-gray-300"
                      }`}
                    >
                      {mode === "fixed" && "Precio fijo"}
                      {mode === "tiers" && "Por cantidad"}
                      {mode === "date" && "Por fecha"}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-400">
                  {pricingMode === "fixed" && "Todos pagan el mismo monto."}
                  {pricingMode === "tiers" && "El precio varía según cuántos se hayan anotado antes."}
                  {pricingMode === "date" && "El precio varía según la fecha en que se realiza el pago."}
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="payment_amount">
                  {pricingMode === "fixed" ? "Monto a pagar (ARS) *" : "Monto base / fallback (ARS) *"}
                </Label>
                <Input
                  id="payment_amount"
                  name="payment_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={event.payment_amount}
                  required
                />
                {pricingMode !== "fixed" && (
                  <p className="text-xs text-gray-400">Se usa si no aplica ningún tramo.</p>
                )}
              </div>

              {pricingMode === "tiers" && (
                <PricingTiersEditor value={pricingTiers} onChange={setPricingTiers} />
              )}

              {pricingMode === "date" && (
                <DateTiersEditor value={dateTiers} onChange={setDateTiers} />
              )}

              <div className="space-y-2">
                <Label htmlFor="payment_account">CBU / Alias de destino *</Label>
                <Input
                  id="payment_account"
                  name="payment_account"
                  defaultValue={event.payment_account}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="whatsapp_number">WhatsApp para comprobantes *</Label>
                <Input
                  id="whatsapp_number"
                  name="whatsapp_number"
                  type="tel"
                  defaultValue={event.whatsapp_number}
                  required
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <input
                  type="checkbox"
                  id="whatsapp_confirmation"
                  checked={whatsappConfirmation}
                  onChange={(e) => setWhatsappConfirmation(e.target.checked)}
                  className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                <div>
                  <Label htmlFor="whatsapp_confirmation" className="cursor-pointer">Habilitar envío de comprobante por WhatsApp</Label>
                  <p className="text-xs text-gray-400">Si está activado, los asistentes verán la opción de enviar el comprobante por WhatsApp después de anotarse.</p>
                </div>
              </div>

            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <div className="pt-2">
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Guardando..." : "Guardar cambios"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}