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
import ImageUpload from "@/components/image-upload"

export default function NewEventPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [flyerUrl, setFlyerUrl] = useState<string | null>(null)

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
      payment_account: (form.elements.namedItem("payment_account") as HTMLInputElement).value,
      payment_amount: parseFloat((form.elements.namedItem("payment_amount") as HTMLInputElement).value),
      whatsapp_number: (form.elements.namedItem("whatsapp_number") as HTMLInputElement).value,
      flyer_url: flyerUrl,
      max_capacity: maxCapacityVal ? parseInt(maxCapacityVal) : null,
    }

    const res = await fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })

    if (res.ok) {
      const event = await res.json()
      router.push(`/admin/events/${event.id}`)
    } else {
      const err = await res.json()
      setError(err.error || "Error al crear el evento")
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
        <h2 className="text-xl font-semibold text-gray-900">Nuevo evento</h2>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos del evento</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Nombre del evento *</Label>
              <Input
                id="title"
                name="title"
                placeholder="Ej: Asado viernes 13 de marzo"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Descripción</Label>
              <Textarea
                id="description"
                name="description"
                placeholder="Detalles del evento, qué incluye, dónde es..."
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
                placeholder="Ej: 20 (dejá vacío para sin límite)"
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
                  placeholder="5000"
                  required
                />
              </div>

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
                  placeholder="Ej: 5491112345678 (con código de país, sin +)"
                  required
                />
                <p className="text-xs text-gray-400">
                  Formato internacional sin +. Argentina: 549 + código de área + número (ej: 5491151234567)
                </p>
              </div>
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}

            <div className="pt-2">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Creando..." : "Crear evento"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
