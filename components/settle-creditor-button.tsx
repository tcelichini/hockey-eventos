"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { CheckCheckIcon, UndoIcon } from "lucide-react"

export default function SettleCreditorButton({
  expenseIds,
  settled = false,
}: {
  expenseIds: string[]
  settled?: boolean
}) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleClick() {
    setLoading(true)
    await Promise.all(
      expenseIds.map((id) =>
        fetch(`/api/expenses/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ settled: !settled }),
        })
      )
    )
    router.refresh()
    setLoading(false)
  }

  if (settled) {
    return (
      <Button
        size="sm"
        variant="ghost"
        onClick={handleClick}
        disabled={loading}
        className="h-6 w-6 p-0 text-gray-400 hover:text-orange-500"
        title="Deshacer saldado"
      >
        {loading ? <span className="text-xs">...</span> : <UndoIcon className="w-3 h-3" />}
      </Button>
    )
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={handleClick}
      disabled={loading}
      className="h-7 w-7 p-0 text-green-600 border-green-300 hover:bg-green-50"
      title="Marcar como saldado"
    >
      {loading ? <span className="text-xs">...</span> : <CheckCheckIcon className="w-3.5 h-3.5" />}
    </Button>
  )
}
