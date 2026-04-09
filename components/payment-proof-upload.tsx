"use client"

import { useState, useRef } from "react"
import { CameraIcon, CheckCircleIcon, ClipboardPasteIcon } from "lucide-react"

export default function PaymentProofUpload({ attendeeId, extraAttendeeIds, onUploaded }: { attendeeId: string; extraAttendeeIds?: string[]; onUploaded?: (url: string) => void }) {
  const [uploading, setUploading] = useState(false)
  const [uploaded, setUploaded] = useState(false)
  const [error, setError] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setUploading(true)
    setError("")
    const form = new FormData()
    form.append("file", file)
    form.append("attendee_id", attendeeId)

    try {
      const res = await fetch("/api/upload-proof", { method: "POST", body: form })
      if (res.ok) {
        const data = await res.json()
        // If combo, also update proof for other attendees
        if (extraAttendeeIds?.length) {
          await Promise.all(
            extraAttendeeIds.map((id) => {
              const extraForm = new FormData()
              extraForm.append("attendee_id", id)
              extraForm.append("proof_url", data.url)
              return fetch("/api/upload-proof-url", { method: "POST", body: JSON.stringify({ attendee_id: id, proof_url: data.url }), headers: { "Content-Type": "application/json" } })
            })
          )
        }
        setUploaded(true)
        onUploaded?.(data.url)
      } else {
        const data = await res.json()
        setError(data.error || "Error al subir comprobante")
      }
    } catch {
      setError("Error de conexión")
    }
    setUploading(false)
  }

  function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items
    if (!items) return
    for (const item of Array.from(items)) {
      if (item.type.startsWith("image/")) {
        e.preventDefault()
        const file = item.getAsFile()
        if (file) handleFile(file)
        return
      }
    }
  }

  async function handlePasteButton() {
    try {
      const items = await navigator.clipboard.read()
      for (const item of items) {
        const imageType = item.types.find((t) => t.startsWith("image/"))
        if (imageType) {
          const blob = await item.getType(imageType)
          const file = new File([blob], "comprobante.png", { type: imageType })
          handleFile(file)
          return
        }
      }
      setError("No hay imagen en el portapapeles")
    } catch {
      setError("No se pudo acceder al portapapeles. Intentá con Ctrl+V o adjuntá el archivo.")
    }
  }

  if (uploaded) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center space-y-1">
        <CheckCircleIcon className="w-8 h-8 text-green-500 mx-auto" />
        <p className="font-medium text-green-700 text-sm">Comprobante enviado</p>
        <p className="text-xs text-green-600">El organizador lo va a revisar.</p>
      </div>
    )
  }

  return (
    <div onPaste={handlePaste}>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex-1 border-2 border-dashed border-gray-200 hover:border-green-400 rounded-xl p-4 flex flex-col items-center gap-2 transition-colors"
        >
          {uploading ? (
            <>
              <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-gray-500">Subiendo...</p>
            </>
          ) : (
            <>
              <CameraIcon className="w-8 h-8 text-gray-400" />
              <p className="text-sm font-medium text-gray-600">Adjuntar</p>
              <p className="text-xs text-gray-400">Foto o PDF</p>
            </>
          )}
        </button>
        <button
          type="button"
          onClick={handlePasteButton}
          disabled={uploading}
          className="flex-1 border-2 border-dashed border-gray-200 hover:border-blue-400 rounded-xl p-4 flex flex-col items-center gap-2 transition-colors"
        >
          <ClipboardPasteIcon className="w-8 h-8 text-gray-400" />
          <p className="text-sm font-medium text-gray-600">Pegar imagen</p>
          <p className="text-xs text-gray-400">Del portapapeles</p>
        </button>
      </div>
      {error && <p className="text-red-500 text-xs mt-2 text-center">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.pdf"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) handleFile(file)
        }}
      />
    </div>
  )
}
