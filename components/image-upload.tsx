"use client"

import { useState, useRef } from "react"
import Image from "next/image"
import { ImageIcon, XIcon, UploadIcon } from "lucide-react"

interface ImageUploadProps {
  value?: string | null
  onChange: (url: string | null) => void
}

type Position = "top" | "center" | "bottom"

const POSITION_LABELS: Record<Position, string> = {
  top: "Arriba",
  center: "Centro",
  bottom: "Abajo",
}

function parseUrl(value: string | null | undefined): { rawUrl: string | null; position: Position } {
  if (!value) return { rawUrl: null, position: "center" }
  const [rawUrl, fragment] = value.split("#")
  const position = (["top", "center", "bottom"].includes(fragment) ? fragment : "center") as Position
  return { rawUrl, position }
}

export default function ImageUpload({ value, onChange }: ImageUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState("")
  const inputRef = useRef<HTMLInputElement>(null)

  const { rawUrl, position } = parseUrl(value)

  function buildUrl(url: string, pos: Position) {
    return pos === "center" ? url : `${url}#${pos}`
  }

  async function handleFile(file: File) {
    setUploading(true)
    setError("")

    const form = new FormData()
    form.append("file", file)

    const res = await fetch("/api/upload", { method: "POST", body: form })
    const data = await res.json()

    if (res.ok) {
      onChange(buildUrl(data.url, position))
    } else {
      setError(data.error || "Error al subir la imagen")
    }
    setUploading(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function handlePositionChange(pos: Position) {
    if (!rawUrl) return
    onChange(buildUrl(rawUrl, pos))
  }

  if (rawUrl) {
    return (
      <div className="relative">
        <div className="relative aspect-[4/3] w-full rounded-xl overflow-hidden border border-gray-200">
          <Image
            src={rawUrl}
            alt="Banner del evento"
            fill
            className="object-cover"
            style={{ objectPosition: position }}
          />
        </div>
        <button
          type="button"
          onClick={() => { onChange(null); if (inputRef.current) inputRef.current.value = "" }}
          className="absolute top-2 right-2 w-7 h-7 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-md transition-colors"
        >
          <XIcon className="w-4 h-4" />
        </button>

        {/* Position selector */}
        <div className="mt-2 flex items-center gap-2">
          <span className="text-xs text-gray-400">Posición:</span>
          <div className="flex gap-1">
            {(["top", "center", "bottom"] as Position[]).map((pos) => (
              <button
                key={pos}
                type="button"
                onClick={() => handlePositionChange(pos)}
                className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                  position === pos
                    ? "bg-[#00A651] text-white font-medium"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {POSITION_LABELS[pos]}
              </button>
            ))}
          </div>
        </div>
        <p className="text-xs text-gray-400 mt-1">Ajustá la posición si la imagen se ve cortada</p>
      </div>
    )
  }

  return (
    <div>
      <div
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className="aspect-[4/3] w-full border-2 border-dashed border-gray-200 hover:border-[#00A651] rounded-xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors bg-gray-50 hover:bg-green-50/30"
      >
        {uploading ? (
          <>
            <div className="w-8 h-8 border-2 border-[#00A651] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-400">Subiendo imagen...</p>
          </>
        ) : (
          <>
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
              <ImageIcon className="w-6 h-6 text-gray-400" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-gray-600">Subir imagen del evento</p>
              <p className="text-xs text-gray-400 mt-0.5">JPG, PNG o WEBP · Recomendado 4:3 (ej: 1200×900px)</p>
            </div>
            <div className="flex items-center gap-1.5 text-[#00A651] text-xs font-medium">
              <UploadIcon className="w-3.5 h-3.5" />
              Seleccionar archivo
            </div>
          </>
        )}
      </div>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
      <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} />
    </div>
  )
}
