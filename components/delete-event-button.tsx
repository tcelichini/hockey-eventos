"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Trash2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function DeleteEventButton({ eventId }: { eventId: string }) {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    setLoading(true)
    const res = await fetch(`/api/events/${eventId}`, { method: "DELETE" })
    if (res.ok) {
      router.push("/admin")
      router.refresh()
    } else {
      setLoading(false)
      setConfirming(false)
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-red-600 font-medium">¿Eliminar evento?</span>
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDelete}
          disabled={loading}
        >
          {loading ? "Eliminando..." : "Sí, eliminar"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConfirming(false)}
          disabled={loading}
        >
          Cancelar
        </Button>
      </div>
    )
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="text-red-500 hover:text-red-600 hover:bg-red-50"
      onClick={() => setConfirming(true)}
    >
      <Trash2Icon className="w-4 h-4 mr-1" />
      Eliminar
    </Button>
  )
}
