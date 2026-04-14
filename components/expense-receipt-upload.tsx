"use client"

import { useState, useRef } from "react"
import { PaperclipIcon, ClipboardPasteIcon, XIcon, CheckCircleIcon } from "lucide-react"

export default function ExpenseReceiptUpload({
  url,
  onChange,
}: {
  url: string | null
  onChange: (url: string | null) => void
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFile(file: File) {
    setUploading(true)
    setError("")
    const form = new FormData()
    form.append("file", file)

    try {
      const res = await fetch("/api/upload-expense-receipt", { method: "POST", body: form })
      if (res.ok) {
        const data = await res.json()
        onChange(data.url)
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
      setError("No se pudo acceder al portapapeles. Usá Ctrl+V o adjuntá el archivo.")
    }
  }

  if (url) {
    return (
      <div className="flex items-center justify-between gap-2 bg-green-50 border border-green-200 rounded-md px-3 py-2">
        <div className="flex items-center gap-2 min-w-0">
          <CheckCircleIcon className="w-4 h-4 text-green-600 shrink-0" />
          <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs text-green-700 hover:underline truncate">
            Comprobante cargado (ver)
          </a>
        </div>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-gray-400 hover:text-red-500 shrink-0"
          title="Quitar comprobante"
        >
          <XIcon className="w-4 h-4" />
        </button>
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
          className="flex-1 border-2 border-dashed border-gray-200 hover:border-green-400 rounded-md p-2 flex items-center justify-center gap-2 transition-colors text-sm text-gray-600"
        >
          {uploading ? (
            <>
              <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-xs">Subiendo...</span>
            </>
          ) : (
            <>
              <PaperclipIcon className="w-4 h-4 text-gray-400" />
              <span className="text-xs font-medium">Adjuntar comprobante</span>
            </>
          )}
        </button>
        <button
          type="button"
          onClick={handlePasteButton}
          disabled={uploading}
          className="flex-1 border-2 border-dashed border-gray-200 hover:border-blue-400 rounded-md p-2 flex items-center justify-center gap-2 transition-colors text-sm text-gray-600"
        >
          <ClipboardPasteIcon className="w-4 h-4 text-gray-400" />
          <span className="text-xs font-medium">Pegar imagen</span>
        </button>
      </div>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
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
