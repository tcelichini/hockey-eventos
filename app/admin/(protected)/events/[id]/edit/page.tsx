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
import type { PricingTier } from "@/db/schema"

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
}

function toDatetimeLocal(isoString: string) {
  const d = new Date(isoString)
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export default function EditEventPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string

  const [event, setEvent] = useState<EventData | null>(null)
  const [flyerUrl, setFlyerUrl] = useState<string | null>(null)
  const [pricingTiers, setPricingTiers] = useState<PricingTier[] | null>(null)
  const [whatsappConfirmation, setWhatsappConfirmation] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    fetch(`/api/events/by-id/${id}`)
      .then((r) => r.json())
      .then((data: EventData) => {
        setEvent(data)
        setFlyerUrl(data.flyer_url)
        setPricingTiers(data.pricing_tiers)
        setWhatsappConfirmation(data.whatsapp_confirmation ?? false)
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
      pricing_tiers: pricingTiers,
      whatsapp_confirmation: whatsappConfirmation,
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

              <div className="space-y-2">
                <Label htmlFor="payment_amount">Monto a pagar (ARS) *</Label>
                <Input
                  id="payment_amount"
                  name="payment_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  defaultValue={event.payment_amount}
                  required
                />
              </div>

              <PricingTiersEditor value={pricingTiers} onChange={setPricingTiers} />

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
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Guardando..." : "Guardar cambios"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
