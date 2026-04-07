"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { ArrowLeftIcon } from "lucide-react"
import DateTiersEditor from "@/components/date-tiers-editor"
import EventSelector from "@/components/event-selector"
import type { DateTier } from "@/db/schema"

export default function NewComboPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [eventIds, setEventIds] = useState<string[]>([])
  const [dateTiers, setDateTiers] = useState<DateTier[] | null>(null)
  const [whatsappConfirmation, setWhatsappConfirmation] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (eventIds.length < 2) {
      setError("Selecciona al menos 2 eventos para el combo")
      return
    }
    setLoading(true)
    setError("")

    const form = e.currentTarget
    const data = {
      title: (form.elements.namedItem("title") as HTMLInputElement).value,
      description: (form.elements.namedItem("description") as HTMLTextAreaElement).value,
      event_ids: eventIds,
      date_tiers: dateTiers,
      payment_amount: parseFloat((form.elements.namedItem("payment_amount") as HTMLInputElement).value),
      payment_account: (form.elements.namedItem("payment_account") as HTMLInputElement).value,
      whatsapp_number: (form.elements.namedItem("whatsapp_number") as HTMLInputElement).value,
      whatsapp_confirmation: whatsappConfirmation,
    }

    const res = await fetch("/api/combos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })

    if (res.ok) {
      const combo = await res.json()
      router.push(`/admin/combos/${combo.id}`)
    } else {
      const err = await res.json()
      setError(err.error || "Error al crear el combo")
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin">
          <Button variant="ghost" size="sm">
            <ArrowLeftIcon className="w-4 h-4 mr-1" />
            Volver
          </Button>
        </Link>
        <h2 className="text-xl font-semibold text-gray-900">Nuevo combo</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos del combo</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Nombre del combo *</Label>
              <Input
                id="title"
                name="title"
                placeholder="Ej: Combo Abril - Ciudad + Ducilo"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripcion</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Detalles del combo..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Eventos incluidos *</Label>
              <EventSelector value={eventIds} onChange={setEventIds} />
              {eventIds.length > 0 && eventIds.length < 2 && (
                <p className="text-xs text-orange-500">Selecciona al menos 2 eventos</p>
              )}
            </div>

            <div className="border-t pt-4 space-y-4">
              <h3 className="font-medium text-gray-700">Precio del combo</h3>

              <div className="space-y-2">
                <Label htmlFor="payment_amount">Monto base / fallback (ARS) *</Label>
                <Input
                  id="payment_amount"
                  name="payment_amount"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="48000"
                  required
                />
                <p className="text-xs text-gray-400">Se usa si no aplica ningun tramo por fecha.</p>
              </div>

              <DateTiersEditor value={dateTiers} onChange={setDateTiers} />

              <div className="space-y-2">
                <Label htmlFor="payment_account">CBU / Alias de destino *</Label>
                <Input
                  id="payment_account"
                  name="payment_account"
                  placeholder="Ej: hockey.club o 0000003100123456789012"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="whatsapp_number">WhatsApp para comprobantes *</Label>
                <Input
                  id="whatsapp_number"
                  name="whatsapp_number"
                  type="tel"
                  placeholder="Ej: 5491112345678 (con codigo de pais, sin +)"
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
                  <Label htmlFor="whatsapp_confirmation" className="cursor-pointer">Habilitar envio de comprobante por WhatsApp</Label>
                  <p className="text-xs text-gray-400">Los asistentes veran la opcion de enviar el comprobante por WhatsApp.</p>
                </div>
              </div>
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <div className="pt-2">
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? "Creando..." : "Crear combo"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
