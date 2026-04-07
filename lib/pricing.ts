import type { PricingTier, DateTier } from "@/db/schema"

/**
 * Calcula el precio que le corresponde al próximo inscripto.
 * confirmedCount = cantidad de confirmados ANTES de este nuevo inscripto.
 */
export function calculatePrice(
  tiers: PricingTier[] | null | undefined,
  paymentAmount: string,
  confirmedCount: number,
): number {
  if (!tiers || tiers.length === 0) {
    return Number(paymentAmount)
  }

  const position = confirmedCount + 1

  const sorted = [...tiers].sort((a, b) => {
    if (a.upTo === null) return 1
    if (b.upTo === null) return -1
    return a.upTo - b.upTo
  })

  for (const tier of sorted) {
    if (tier.upTo === null || position <= tier.upTo) {
      return tier.price
    }
  }

  return Number(paymentAmount)
}

/**
 * Calcula el precio según la fecha de pago.
 * now = fecha actual (YYYY-MM-DD). Si no se pasa, usa hoy.
 */
export function calculateDatePrice(
  tiers: DateTier[] | null | undefined,
  paymentAmount: string,
  now?: string,
): number {
  if (!tiers || tiers.length === 0) return Number(paymentAmount)

  const today = now ?? new Date().toISOString().slice(0, 10)

  const sorted = [...tiers].sort((a, b) => {
    if (a.until === null) return 1
    if (b.until === null) return -1
    return a.until.localeCompare(b.until)
  })

  for (const tier of sorted) {
    if (tier.until === null || today <= tier.until) return tier.price
  }

  return Number(paymentAmount)
}

/**
 * Formatea "YYYY-MM-DD" como "D/M" (ej: "2026-04-15" → "15/4")
 */
function fmtDate(iso: string): string {
  const [, m, d] = iso.split("-")
  return `${parseInt(d)}/${parseInt(m)}`
}

/**
 * Genera la etiqueta de cada tramo por fecha.
 * Ejemplo: tiers [until:"2026-04-10", until:"2026-04-20", until:null]
 * → "Hasta el 10/4", "Del 11/4 al 20/4", "Después del 20/4"
 */
export function getDateTierLabel(
  tier: DateTier,
  index: number,
  sortedTiers: DateTier[],
): string {
  if (tier.until === null) {
    const prev = index > 0 ? sortedTiers[index - 1].until : null
    return prev ? `Después del ${fmtDate(prev)}` : "Precio único"
  }
  if (index === 0) return `Hasta el ${fmtDate(tier.until)}`

  // día siguiente al until del tramo anterior
  const prevUntil = sortedTiers[index - 1].until!
  const d = new Date(prevUntil + "T12:00:00")
  d.setDate(d.getDate() + 1)
  const nextDay = d.toISOString().slice(0, 10)
  return `Del ${fmtDate(nextDay)} al ${fmtDate(tier.until)}`
}

/**
 * Genera la etiqueta de rango para un tramo de precio.
 * Ejemplo: tiers [upTo:4, upTo:8, upTo:null] → "Del 1 al 4", "Del 5 al 8", "Resto"
 */
export function getTierLabel(
  tier: { upTo: number | null },
  index: number,
  sortedTiers: { upTo: number | null }[],
): string {
  if (tier.upTo === null) return "Resto"
  const prevUpTo = index > 0 ? (sortedTiers[index - 1].upTo ?? 0) : 0
  const start = prevUpTo + 1
  return start === tier.upTo ? `Asistente ${tier.upTo}` : `Del ${start} al ${tier.upTo}`
}

/**
 * Valida que los tramos sean correctos.
 * - Al menos 2 tramos
 * - Precios > 0
 * - upTo positivos y ascendentes
 * - Exactamente un tramo con upTo: null (el último)
 */
export function validateTiers(tiers: PricingTier[]): string | null {
  if (tiers.length < 2) return "Se necesitan al menos 2 tramos"

  const catchAll = tiers.filter((t) => t.upTo === null)
  if (catchAll.length !== 1) return "Debe haber exactamente un tramo 'Resto'"

  const numbered = tiers.filter((t) => t.upTo !== null).sort((a, b) => a.upTo! - b.upTo!)

  for (let i = 0; i < numbered.length; i++) {
    if (numbered[i].upTo! <= 0) return "Los límites deben ser mayores a 0"
    if (numbered[i].price <= 0) return "Los precios deben ser mayores a 0"
    if (i > 0 && numbered[i].upTo! <= numbered[i - 1].upTo!) {
      return "Los límites deben ser ascendentes"
    }
  }

  for (const tier of catchAll) {
    if (tier.price <= 0) return "Los precios deben ser mayores a 0"
  }

  return null
}
