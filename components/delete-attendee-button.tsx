"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Trash2Icon } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function DeleteAttendeeButton({ attendeeId }: { attendeeId: string }) {
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleDelete() {
    setLoading(true)
    const res = await fetch(`/api/attendees/${attendeeId}`, { method: "DELETE" })
    if (res.ok) {
      router.refresh()
    } else {
      setLoading(false)
      setConfirming(false)
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1">
        <Button
          variant="destructive"
          size="sm"
          className="h-7 text-xs px-2"
          onClick={handleDelete}
          disabled={loading}
        >
          {loading ? "..." : "Sí"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs px-2"
          onClick={() => setConfirming(false)}
          disabled={loading}
        >
          No
        </Button>
      </div>
    )
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 w-7 p-0 text-gray-400 hover:text-red-500 hover:bg-red-50"
      onClick={() => setConfirming(true)}
      title="Eliminar asistente"
    >
      <Trash2Icon className="w-3.5 h-3.5" />
    </Button>
  )
}
