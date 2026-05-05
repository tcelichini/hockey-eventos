import { NextRequest, NextResponse } from "next/server"
import { db } from "@/db"
import { events, attendees } from "@/db/schema"
import { eq } from "drizzle-orm"
import { COOKIE_NAME, verifySession } from "@/lib/auth"
import { getPlayersForTeams } from "@/lib/players"
import { calculateDatePrice, calculatePrice } from "@/lib/pricing"

async function authCheck(request: NextRequest) {
  const cookie = request.cookies.get(COOKIE_NAME)?.value
  return cookie ? await verifySession(cookie) : false
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await authCheck(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json()
  const { title, description, date, flyer_url, payment_account, payment_amount, whatsapp_number, max_capacity, is_open, pricing_tiers, date_tiers, whatsapp_confirmation, is_3t, teams } = body

  if (!title || !date || !payment_account || payment_amount == null || !whatsapp_number) {
    return NextResponse.json({ error: "Faltan campos requeridos" }, { status: 400 })
  }

  // Leer el estado actual del evento para validar transiciones de equipos.
  const [existing] = await db.select().from(events).where(eq(events.id, params.id)).limit(1)
  if (!existing) {
    return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 })
  }

  const newIs3t = is_3t !== undefined ? Boolean(is_3t) : existing.is_3t

  // Validación superset: si el evento ya era 3T y sigue siendo 3T, los teams nuevos deben contener todos los viejos.
  // Esto evita que un cambio de equipo descarte asistentes ya confirmados/pagados.
  if (existing.is_3t && newIs3t && teams !== undefined && Array.isArray(existing.teams) && Array.isArray(teams)) {
    const newTeamSet = new Set(teams as string[])
    const isSuperset = (existing.teams as string[]).every((t) => newTeamSet.has(t))
    if (!isSuperset) {
      return NextResponse.json(
        { error: "Solo podés agregar equipos, no reemplazarlos. Para cambiar de equipo creá un evento nuevo." },
        { status: 400 }
      )
    }
  }

  // Calcular el valor de teams para el update:
  // - Si pasa a no-3T: teams = null
  // - Si entra a 3T por primera vez (no era 3T antes): teams = body.teams ?? ["A"]
  // - Si sigue siendo 3T y se mandan teams: usar los del body
  // - Si nada cambió: undefined (no toca el campo)
  let teamsForUpdate: string[] | null | undefined = undefined
  if (newIs3t === false && existing.is_3t === true) {
    teamsForUpdate = null
  } else if (newIs3t === true && existing.is_3t === false) {
    teamsForUpdate = (teams as string[] | undefined) ?? ["A"]
  } else if (newIs3t === true && teams !== undefined) {
    teamsForUpdate = teams as string[]
  }

  const [updated] = await db
    .update(events)
    .set({
      title,
      description: description || null,
      date: new Date(date + ":00-03:00"),
      flyer_url: flyer_url !== undefined ? (flyer_url || null) : undefined,
      payment_account,
      payment_amount: String(payment_amount),
      whatsapp_number,
      max_capacity: max_capacity ? Number(max_capacity) : null,
      is_open: is_open !== undefined ? Boolean(is_open) : undefined,
      pricing_tiers: pricing_tiers !== undefined ? (pricing_tiers || null) : undefined,
      date_tiers: date_tiers !== undefined ? (date_tiers || null) : undefined,
      whatsapp_confirmation: whatsapp_confirmation !== undefined ? Boolean(whatsapp_confirmation) : undefined,
      is_3t: is_3t !== undefined ? Boolean(is_3t) : undefined,
      teams: teamsForUpdate,
    })
    .where(eq(events.id, params.id))
    .returning()

  if (!updated) {
    return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 })
  }

  // Si tras el update el evento es 3T y hay equipos nuevos respecto al estado anterior,
  // pre-cargar los jugadores faltantes como asistentes confirmados.
  if (updated.is_3t && Array.isArray(updated.teams) && updated.teams.length > 0) {
    const oldTeams: string[] = existing.is_3t && Array.isArray(existing.teams) ? (existing.teams as string[]) : []
    const addedTeams = (updated.teams as string[]).filter((t) => !oldTeams.includes(t))

    if (addedTeams.length > 0) {
      const newPlayers = getPlayersForTeams(addedTeams)

      // Evitar duplicar a alguien que ya esté como asistente (por ejemplo agregado a mano por el admin).
      const existingAttendees = await db
        .select({ full_name: attendees.full_name })
        .from(attendees)
        .where(eq(attendees.event_id, updated.id))
      const existingNames = new Set(existingAttendees.map((a) => a.full_name))
      const playersToAdd = newPlayers.filter((p) => !existingNames.has(p))

      if (playersToAdd.length > 0) {
        const price = updated.date_tiers && updated.date_tiers.length > 0
          ? calculateDatePrice(updated.date_tiers, updated.payment_amount)
          : calculatePrice(updated.pricing_tiers, updated.payment_amount, 0)

        await db.insert(attendees).values(
          playersToAdd.map((playerName) => ({
            event_id: updated.id,
            full_name: playerName,
            status: "confirmed" as const,
            payment_status: "pending" as const,
            price_paid: String(price),
          }))
        )
      }
    }
  }

  return NextResponse.json(updated)
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  if (!(await authCheck(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [deleted] = await db
    .delete(events)
    .where(eq(events.id, params.id))
    .returning()

  if (!deleted) {
    return NextResponse.json({ error: "Evento no encontrado" }, { status: 404 })
  }

  return NextResponse.json({ ok: true })
}
