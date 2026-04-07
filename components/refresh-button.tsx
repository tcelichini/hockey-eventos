"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { RefreshCwIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function RefreshButton() {
  const router = useRouter()
  const [spinning, setSpinning] = useState(false)

  function handleRefresh() {
    setSpinning(true)
    router.refresh()
    setTimeout(() => setSpinning(false), 800)
  }

  return (
    <Button variant="outline" size="sm" onClick={handleRefresh}>
      <RefreshCwIcon className={`w-4 h-4 mr-1 transition-transform duration-500 ${spinning ? "rotate-180" : ""}`} />
      Actualizar
    </Button>
  )
}