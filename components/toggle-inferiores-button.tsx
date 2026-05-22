"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"

export default function ToggleInferioresButton({ attendeeId, isInferiores }: { attendeeId: string; isInferiores: boolean }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleToggle() {
    setLoading(true)
    await fetch(`/api/attendees/${attendeeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_inferiores: !isInferiores }),
    })
    router.refresh()
  }

  return (
    <button onClick={handleToggle} disabled={loading} title={isInferiores ? "Quitar inferiores" : "Marcar como inferiores"}>
      <Badge className={`cursor-pointer text-[10px] ${
        isInferiores
          ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
          : "bg-gray-100 text-gray-400 hover:bg-gray-200"
      }`}>
        {loading ? "..." : isInferiores ? "Inferiores" : "Inf."}
      </Badge>
    </button>
  )
}
