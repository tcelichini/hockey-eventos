import { NextRequest, NextResponse } from "next/server"
import { getStorageClient, EXPENSE_RECEIPTS_BUCKET } from "@/lib/supabase-storage"

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const file = formData.get("file") as File | null

  if (!file) {
    return NextResponse.json({ error: "Falta el archivo" }, { status: 400 })
  }

  const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"]
  if (!allowed.includes(file.type)) {
    return NextResponse.json(
      { error: "Tipo de archivo no permitido. Usá JPG, PNG, WEBP, GIF o PDF." },
      { status: 400 }
    )
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: "El archivo es muy grande. Máximo 5MB." }, { status: 400 })
  }

  const ext = file.name.split(".").pop() ?? "jpg"
  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const supabase = getStorageClient()
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const { error } = await supabase.storage.from(EXPENSE_RECEIPTS_BUCKET).upload(filename, buffer, {
    contentType: file.type,
    upsert: false,
  })

  if (error) {
    return NextResponse.json({ error: "Error al subir archivo" }, { status: 500 })
  }

  const { data } = supabase.storage.from(EXPENSE_RECEIPTS_BUCKET).getPublicUrl(filename)
  return NextResponse.json({ url: data.publicUrl }, { status: 201 })
}
