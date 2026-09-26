"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { GiftIcon, UndoIcon } from "lucide-react"

/** Marca/desmarca a un asistente como invitado (no paga ni debe). */
export default function MarkGuestButton({
  attendeeId,
  isGuest,
}: {
  attendeeId: string
  isGuest: boolean
}) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleClick() {
    setLoading(true)
    await fetch(`/api/attendees/${attendeeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ payment_status: isGuest ? "pending" : "guest" }),
    })
    router.refresh()
    setLoading(false)
  }

  if (isGuest) {
    return (
      <Button
        size="sm"
        variant="ghost"
        onClick={handleClick}
        disabled={loading}
        className="text-xs h-7 text-gray-400 hover:text-orange-500"
        title="Desmarcar invitado"
      >
        <UndoIcon className="w-3 h-3" />
      </Button>
    )
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleClick}
      disabled={loading}
      className="text-xs h-7 text-blue-600 border-blue-200 hover:bg-blue-50 hover:text-blue-700"
      title="No paga: cuenta como asistente pero no como deudor"
    >
      <GiftIcon className="w-3 h-3 mr-1" />
      {loading ? "..." : "Invitado"}
    </Button>
  )
}
