import { NextRequest, NextResponse } from "next/server"
import { getStorageClient, BUCKET } from "@/lib/supabase-storage"
import { db } from "@/db"
import { attendees } from "@/db/schema"
import { eq } from "drizzle-orm"

export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const file = formData.get("file") as File | null
  const attendeeId = formData.get("attendee_id") as string | null

  if (!file || !attendeeId) {
    return NextResponse.json({ error: "Faltan datos" }, { status: 400 })
  }

  // Verify attendee exists and is confirmed
  const [attendee] = await db
    .select()
    .from(attendees)
    .where(eq(attendees.id, attendeeId))
    .limit(1)

  if (!attendee || attendee.status !== "confirmed") {
    return NextResponse.json({ error: "Asistente no encontrado" }, { status: 404 })
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
  const filename = `proofs/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const supabase = getStorageClient()
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const { error } = await supabase.storage.from(BUCKET).upload(filename, buffer, {
    contentType: file.type,
    upsert: false,
  })

  if (error) {
    return NextResponse.json({ error: "Error al subir imagen" }, { status: 500 })
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(filename)

  await db
    .update(attendees)
    .set({ payment_proof_url: data.publicUrl, payment_status: "paid" })
    .where(eq(attendees.id, attendeeId))

  return NextResponse.json({ url: data.publicUrl }, { status: 201 })
}
