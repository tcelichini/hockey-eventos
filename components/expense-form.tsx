"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PlusIcon } from "lucide-react"

export default function ExpenseForm({ eventId, attendeeNames }: { eventId: string; attendeeNames?: string[] }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError("")

    const form = e.currentTarget
    const data = {
      event_id: eventId,
      description: (form.elements.namedItem("description") as HTMLInputElement).value,
      responsible: (form.elements.namedItem("responsible") as HTMLInputElement).value,
      amount: parseFloat((form.elements.namedItem("amount") as HTMLInputElement).value),
      notes: (form.elements.namedItem("notes") as HTMLInputElement).value || null,
    }

    const res = await fetch("/api/expenses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })

    if (res.ok) {
      form.reset()
      setOpen(false)
      router.refresh()
    } else {
      const err = await res.json()
      setError(err.error || "Error al agregar gasto")
    }
    setLoading(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 py-3 text-sm text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-xl transition-colors border-2 border-dashed border-gray-200 hover:border-gray-300"
      >
        <PlusIcon className="w-4 h-4" />
        Agregar gasto
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 bg-gray-50 rounded-xl p-4">
      {!attendeeNames && <p className="text-xs text-gray-400">Usá el mismo nombre con el que te anotaste</p>}
      <div className="grid grid-cols-2 gap-2">
        <Input
          name="description"
          placeholder="Descripción (ej: Carbón)"
          required
          className="text-sm"
        />
        {attendeeNames ? (
          <select
            name="responsible"
            required
            className="text-sm rounded-md border border-input bg-background px-3 py-2"
            defaultValue=""
          >
            <option value="" disabled>Seleccioná quién</option>
            {attendeeNames.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        ) : (
          <Input
            name="responsible"
            placeholder="Tu nombre"
            required
            className="text-sm"
          />
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Input
          name="amount"
          type="number"
          min="0"
          step="0.01"
          placeholder="Monto ($)"
          required
          className="text-sm"
        />
        <Input
          name="notes"
          placeholder="Notas (opcional)"
          className="text-sm"
        />
      </div>
      {error && <p className="text-red-500 text-xs">{error}</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" className="flex-1" disabled={loading}>
          {loading ? "Guardando..." : "Agregar"}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={loading}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
