"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { CheckIcon, UndoIcon } from "lucide-react"

export default function MarkComboPaidButton({
  attendeeIds,
  isPaid,
}: {
  attendeeIds: string[]
  isPaid: boolean
}) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleClick() {
    setLoading(true)
    const newStatus = isPaid ? "pending" : "paid"
    await Promise.all(
      attendeeIds.map((id) =>
        fetch(`/api/attendees/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ payment_status: newStatus }),
        })
      )
    )
    router.refresh()
    setLoading(false)
  }

  if (isPaid) {
    return (
      <Button
        size="sm"
        variant="ghost"
        onClick={handleClick}
        disabled={loading}
        className="text-xs h-7 text-gray-400 hover:text-orange-500"
        title="Desmarcar pago"
      >
        <UndoIcon className="w-3 h-3" />
      </Button>
    )
  }

  return (
    <Button size="sm" variant="outline" onClick={handleClick} disabled={loading} className="text-xs h-7">
      <CheckIcon className="w-3 h-3 mr-1" />
      {loading ? "..." : "Marcar pagado"}
    </Button>
  )
}
