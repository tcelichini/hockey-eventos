import { NextResponse } from "next/server"
import { getCuentasCorrientes } from "@/lib/cuenta-corriente-query"
import { normalizeName } from "@/lib/settlement"

export const dynamic = "force-dynamic"

/**
 * API pública de cuenta corriente (consulta del jugador).
 * - GET /api/cuenta            → { accounts: [{ key, name }] } para el selector
 * - GET /api/cuenta?key=K      → saldo y detalle por evento de esa cuenta
 * - GET /api/cuenta?name=X     → lo mismo, buscando por nombre (links viejos)
 * Solo expone los montos de la cuenta consultada, nunca el listado completo.
 * Las Personas salen con el nombre con el que figuran, nunca con su nombre real.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const key = searchParams.get("key")
  const name = searchParams.get("name")

  const { accounts, paymentAccountByEvent } = await getCuentasCorrientes()

  if (!key && !name) {
    return NextResponse.json({
      accounts: accounts
        .map((a) => ({ key: a.key, name: a.displayName }))
        .sort((a, b) => a.name.localeCompare(b.name, "es")),
    })
  }

  const account = accounts.find((a) => a.key === (key ?? normalizeName(name!)))
  if (!account) {
    return NextResponse.json({ key: key ?? normalizeName(name!), displayName: name ?? null, total: 0, events: [] })
  }

  return NextResponse.json({
    key: account.key,
    displayName: account.displayName,
    total: account.total,
    events: account.events.map((d) => ({
      title: d.event.title,
      date: d.event.date,
      slug: d.event.slug,
      // Nombre con el que figura en ese evento: con ese se elige al subir el comprobante
      name: d.name,
      net: d.net,
      owed: d.owed,
      expPaid: d.expPaid,
      external: d.external,
      paymentAccount: d.net > 0 ? paymentAccountByEvent.get(d.event.id) || null : null,
    })),
  })
}
