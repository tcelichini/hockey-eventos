import type { PricingTier } from "@/db/schema"

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
