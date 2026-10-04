"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { PlusIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

/**
 * Agregar un asistente a mano en un evento que pide celular: se elige una Persona
 * que ya existe o se crea una nueva, sin celular (ver CONTEXT.md).
 */
export default function AddPersonAttendeeButton({
  eventId,
  people,
}: {
  eventId: string
  /** Personas que todavía no están anotadas en el evento. */
  people: { id: string; label: string }[]
}) {
  const [open, setOpen] = useState(false)
  const [personId, setPersonId] = useState("")
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  function close() {
    setOpen(false)
    setPersonId("")
    setName("")
    setError("")
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    const res = await fetch(`/api/events/${eventId}/attendees`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ person_id: personId || null, full_name: name }),
    })

    if (res.ok) {
      close()
      router.refresh()
    } else {
      const err = await res.json()
      setError(err.error || "Error al agregar")
    }
    setLoading(false)
  }

  if (!open) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs gap-1 text-gray-500"
        onClick={() => setOpen(true)}
      >
        <PlusIcon className="w-3.5 h-3.5" />
        Agregar asistente
      </Button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 bg-gray-50 rounded-xl p-3">
      <select
        value={personId}
        onChange={(e) => setPersonId(e.target.value)}
        disabled={loading}
        className="text-sm rounded-md border border-input bg-background px-3 py-2 w-full"
      >
        <option value="">Persona nueva (sin celular)</option>
        {people.map((p) => (
          <option key={p.id} value={p.id}>{p.label}</option>
        ))}
      </select>
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={personId ? "Nombre con el que figura (opcional)" : "Nombre con el que figura"}
        className="h-8 text-sm"
        required={!personId}
        disabled={loading}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" className="h-8 px-3 text-xs" disabled={loading}>
          {loading ? "..." : "Agregar"}
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-8 px-3 text-xs" onClick={close} disabled={loading}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}
