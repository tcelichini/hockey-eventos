"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { DownloadIcon } from "lucide-react"

export default function ExportCsvButton({ eventId }: { eventId: string }) {
  const [loading, setLoading] = useState(false)

  async function handleExport() {
    setLoading(true)
    try {
      const res = await fetch(`/api/events/${eventId}/export`)
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download =
          res.headers.get("Content-Disposition")?.split("filename=")[1]?.replace(/"/g, "") ||
          "asistentes.csv"
        a.click()
        URL.revokeObjectURL(url)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleExport} disabled={loading}>
      <DownloadIcon className="w-4 h-4 mr-1" />
      {loading ? "..." : "Exportar CSV"}
    </Button>
  )
}
