"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { LockIcon, UnlockIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function ToggleEventButton({ eventId, isOpen }: { eventId: string; isOpen: boolean }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleToggle() {
    setLoading(true)
    await fetch(`/api/events/${eventId}/toggle`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_open: !isOpen }),
    })
    router.refresh()
    setLoading(false)
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleToggle}
      disabled={loading}
      className={isOpen
        ? "border-orange-200 text-orange-600 hover:bg-orange-50"
        : "border-green-200 text-green-600 hover:bg-green-50"}
    >
      {isOpen ? (
        <><LockIcon className="w-4 h-4 mr-1" />Cerrar inscripciones</>
      ) : (
        <><UnlockIcon className="w-4 h-4 mr-1" />Abrir inscripciones</>
      )}
    </Button>
  )
}
