import { NextResponse } from "next/server"
import { getCuentasCorrientes } from "@/lib/cuenta-corriente-query"
import { normalizeName } from "@/lib/settlement"

export const dynamic = "force-dynamic"

/**
 * API pública de cuenta corriente (consulta del jugador).
 * - GET /api/cuenta            → { names: string[] } para el selector
 * - GET /api/cuenta?name=X     → saldo y detalle por evento de esa persona
 * Solo expone los montos de la persona consultada, nunca el listado completo.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const name = searchParams.get("name")

  const { accounts, paymentAccountByEvent } = await getCuentasCorrientes()

  if (!name) {
    return NextResponse.json({
      names: accounts.map((a) => a.displayName).sort((a, b) => a.localeCompare(b, "es")),
    })
  }

  const account = accounts.find((a) => a.key === normalizeName(name))
  if (!account) {
    return NextResponse.json({ displayName: name, total: 0, events: [] })
  }

  return NextResponse.json({
    displayName: account.displayName,
    total: account.total,
    events: account.events.map((d) => ({
      title: d.event.title,
      date: d.event.date,
      slug: d.event.slug,
      net: d.net,
      owed: d.owed,
      expPaid: d.expPaid,
      external: d.external,
      paymentAccount: d.net > 0 ? paymentAccountByEvent.get(d.event.id) || null : null,
    })),
  })
}
