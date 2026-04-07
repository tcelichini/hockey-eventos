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
import DateTiersEditor from "@/components/date-tiers-editor"
import EventSelector from "@/components/event-selector"
import type { DateTier } from "@/db/schema"

type ComboData = {
  id: string
  title: string
  description: string | null
  event_ids: string[]
  date_tiers: DateTier[] | null
  payment_amount: string
  payment_account: string
  whatsapp_number: string
  whatsapp_confirmation: boolean
}

export default function EditComboPage() {
  const router = useRouter()
  const params = useParams()
  const id = params.id as string
  const [combo, setCombo] = useState<ComboData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [eventIds, setEventIds] = useState<string[]>([])
  const [dateTiers, setDateTiers] = useState<DateTier[] | null>(null)
  const [whatsappConfirmation, setWhatsappConfirmation] = useState(false)

  useEffect(() => {
    fetch(`/api/combos/by-id/${id}`)
      .then((r) => r.json())
      .then((data: ComboData) => {
        setCombo(data)
        setEventIds(data.event_ids)
        setDateTiers(data.date_tiers)
        setWhatsappConfirmation(data.whatsapp_confirmation)
      })
  }, [id])

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

    const res = await fetch(`/api/combos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })

    if (res.ok) {
      router.push(`/admin/combos/${id}`)
    } else {
      const err = await res.json()
      setError(err.error || "Error al actualizar el combo")
      setLoading(false)
    }
  }

  if (!combo) {
    return <div className="flex items-center justify-center py-16"><p className="text-gray-400">Cargando...</p></div>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/admin/combos/${id}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeftIcon className="w-4 h-4 mr-1" />
            Volver
          </Button>
        </Link>
        <h2 className="text-xl font-semibold text-gray-900">Editar combo</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos del combo</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Nombre del combo *</Label>
              <Input id="title" name="title" defaultValue={combo.title} required />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripcion</Label>
              <Textarea id="description" name="description" defaultValue={combo.description || ""} rows={2} />
            </div>

            <div className="space-y-2">
              <Label>Eventos incluidos *</Label>
              <EventSelector value={eventIds} onChange={setEventIds} />
            </div>

            <div className="border-t pt-4 space-y-4">
              <h3 className="font-medium text-gray-700">Precio del combo</h3>

              <div className="space-y-2">
                <Label htmlFor="payment_amount">Monto base / fallback (ARS) *</Label>
                <Input id="payment_amount" name="payment_amount" type="number" min="0" step="0.01" defaultValue={combo.payment_amount} required />
              </div>

              <DateTiersEditor value={dateTiers} onChange={setDateTiers} />

              <div className="space-y-2">
                <Label htmlFor="payment_account">CBU / Alias de destino *</Label>
                <Input id="payment_account" name="payment_account" defaultValue={combo.payment_account} required />
              </div>

              <div className="space-y-2">
                <Label htmlFor="whatsapp_number">WhatsApp para comprobantes *</Label>
                <Input id="whatsapp_number" name="whatsapp_number" type="tel" defaultValue={combo.whatsapp_number} required />
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
