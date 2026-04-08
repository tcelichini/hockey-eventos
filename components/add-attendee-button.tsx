"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { PlusIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export default function AddAttendeeButton({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError("")

    const res = await fetch("/api/attendees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_id: eventId, full_name: name.trim(), status: "confirmed" }),
    })

    if (res.ok) {
      setName("")
      setOpen(false)
      router.refresh()
    } else {
      const err = await res.json()
      setError(err.error || "Error al agregar")
      setLoading(false)
    }
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
    <form onSubmit={handleSubmit} className="flex items-center gap-2 py-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Nombre completo"
        className="h-8 text-sm"
        autoFocus
        disabled={loading}
      />
      <Button type="submit" size="sm" className="h-8 px-3 text-xs shrink-0" disabled={loading || !name.trim()}>
        {loading ? "..." : "Agregar"}
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 shrink-0"
        onClick={() => { setOpen(false); setName(""); setError("") }}
        disabled={loading}
      >
        <XIcon className="w-3.5 h-3.5" />
      </Button>
      {error && <p className="text-xs text-red-500 shrink-0">{error}</p>}
    </form>
  )
}
