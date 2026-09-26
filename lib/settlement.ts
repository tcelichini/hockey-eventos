import type { PricingTier, DateTier } from "@/db/schema"
import { calculateDatePrice, todayArg } from "@/lib/pricing"

/**
 * Módulo de Liquidación (ver CONTEXT.md).
 *
 * Función pura: recibe evento + asistentes confirmados + gastos y devuelve
 * quién debe, a quién se le debe, y los totales. No toca la DB — el único
 * side effect (marcar pagados por gastos) lo decide acá (`toMarkPaid`) y lo
 * aplica el caller.
 */

/**
 * Normalización canónica de nombres para matchear personas entre
 * asistentes y gastos. Quita tildes: "José" y "Jose" son la misma persona.
 */
export function normalizeName(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
}

/**
 * Invitado (ej: entrenadores): cuenta como asistente pero no paga ni debe.
 * No entra en deudores, cobrado ni pendiente; si adelanta gastos se le devuelven enteros.
 */
export function isGuest(attendee: { payment_status: string }): boolean {
  return attendee.payment_status === "guest"
}

// Tipos estructurales mínimos: solo los campos que la liquidación necesita.
// Cualquier proyección de Drizzle que los tenga, sirve.

export type SettlementEvent = {
  payment_amount: string
  pricing_tiers: PricingTier[] | null
  date_tiers: DateTier[] | null
  inferiores_price: string | null
}

export type SettlementAttendee = {
  id: string
  full_name: string
  payment_status: string
  payment_proof_url: string | null
  /** Cuándo subió el comprobante. Opcional: sin fecha no se infiere descuento de gastos previos. */
  proof_uploaded_at?: Date | string | null
  price_paid: string | null
  is_inferiores: boolean
}

export type SettlementExpense = {
  id: string
  responsible: string
  amount: string
  payment_alias: string | null
  settled: boolean
  /** Cuándo se cargó el gasto. Opcional: sin fecha se asume posterior al comprobante. */
  created_at?: Date | string | null
}

export type PersonBalance = {
  attendee: SettlementAttendee
  /** Precio adeudado si no hubiera pagado (tramo más caro / vigente). */
  owed: number
  /** Deuda del evento que entra al balance: 0 si pagó independientemente. */
  eventDebt: number
  /** Gastos adelantados por esta persona. */
  expPaid: number
  /** net = eventDebt - expPaid. >0 debe plata, <0 se le debe. */
  net: number
  /** Marcado como pagado porque sus gastos cubren el evento (sin comprobante). */
  paidViaExpenses: boolean
  /**
   * Parte del precio que se asume descontada del pago con comprobante porque
   * la persona ya había cargado gastos ANTES de subirlo (ver CONTEXT.md).
   * 0 si no aplica. eventDebt = discountedFromProof en ese caso.
   */
  discountedFromProof: number
  /** Monto que efectivamente transfirió por el evento (owed − discountedFromProof); 0 si no pagó o pagó vía gastos. */
  amountTransferred: number
  /** Invitado: eventDebt = 0, no paga ni debe. */
  guest: boolean
}

export type ExternalCreditor = {
  /** Nombre tal como figura en el gasto. */
  name: string
  expPaid: number
  /** Nombre normalizado (clave en los mapas por persona). */
  key: string
}

export type Settlement = {
  balances: PersonBalance[]
  /** net > 0 — deben plata. */
  debtors: PersonBalance[]
  /** net < 0 — se les debe devolver. */
  creditors: PersonBalance[]
  /** Adelantaron gastos sin ser asistentes confirmados. */
  externalCreditors: ExternalCreditor[]
  /** Asistentes cuyo estado "paid" proviene de gastos que cubren el evento. */
  coveredByExpensesIds: Set<string>
  /** Asistentes pending cuyos gastos ya cubren el evento: el caller debe marcarlos "paid". */
  toMarkPaid: string[]
  /** Suma de price_paid de los pagados (incluye toMarkPaid). */
  totalCollected: number
  totalExpenses: number
  /** totalCollected - totalExpenses. */
  balance: number
  /** Lo que falta cobrar de los que siguen debiendo (neto de sus gastos). */
  totalPending: number
  // Índices por persona (clave = normalizeName) para el render.
  expenseByPerson: Map<string, number>
  aliasByPerson: Map<string, string>
  expenseIdsByPerson: Map<string, string[]>
  settledByPerson: Map<string, boolean>
}

/**
 * Precio adeudado por un asistente que NO pagó (ver CONTEXT.md).
 * Escalera: inferiores → tramo vigente por fecha → tramo más caro por
 * cantidad → price_paid o payment_amount.
 * `now` ("YYYY-MM-DD") permite tests determinísticos; default: hoy en Argentina.
 */
export function getOwedPrice(
  event: SettlementEvent,
  attendee: Pick<SettlementAttendee, "is_inferiores" | "price_paid">,
  now?: string,
): number {
  const amount = Number(event.payment_amount) || 0
  const inferioresPrice = event.inferiores_price ? Number(event.inferiores_price) : null
  if (attendee.is_inferiores && inferioresPrice !== null) return inferioresPrice

  if (event.date_tiers && event.date_tiers.length > 0) {
    return calculateDatePrice(event.date_tiers, String(event.payment_amount), now ?? todayArg())
  }
  if (event.pricing_tiers && event.pricing_tiers.length > 0) {
    return Math.max(...event.pricing_tiers.map((t) => t.price))
  }
  return Number(attendee.price_paid) || amount
}

/**
 * Liquidación completa de un evento.
 * `attendees` deben ser los confirmados (el caller filtra por status).
 * Calcula el estado *post-sync*: los `toMarkPaid` ya cuentan como pagados
 * en balances y totales; el caller persiste ese cambio en la DB.
 */
export function settleEvent({
  event,
  attendees,
  expenses,
  now,
}: {
  event: SettlementEvent
  attendees: SettlementAttendee[]
  expenses: SettlementExpense[]
  now?: string
}): Settlement {
  const amount = Number(event.payment_amount) || 0
  const owedOf = (a: SettlementAttendee) => getOwedPrice(event, a, now)
  const pricePaidOf = (a: SettlementAttendee) => Number(a.price_paid) || amount

  // Índices de gastos por persona
  const expenseByPerson = new Map<string, number>()
  const aliasByPerson = new Map<string, string>()
  const expenseIdsByPerson = new Map<string, string[]>()
  const settledByPerson = new Map<string, boolean>()
  const displayNameByPerson = new Map<string, string>()
  for (const e of expenses) {
    const key = normalizeName(e.responsible)
    expenseByPerson.set(key, (expenseByPerson.get(key) || 0) + Number(e.amount))
    if (e.payment_alias && !aliasByPerson.has(key)) aliasByPerson.set(key, e.payment_alias)
    expenseIdsByPerson.set(key, [...(expenseIdsByPerson.get(key) || []), e.id])
    settledByPerson.set(key, (settledByPerson.get(key) ?? true) && e.settled)
    if (!displayNameByPerson.has(key)) displayNameByPerson.set(key, e.responsible)
  }
  const totalExpenses = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
  const expOf = (a: SettlementAttendee) => expenseByPerson.get(normalizeName(a.full_name)) || 0

  // Gastos cargados ANTES de que la persona subiera su comprobante. Se asume que
  // al pagar los descontó (transfirió precio − gastos previos). Sin fechas → 0.
  const toTime = (d: Date | string | null | undefined) => (d ? new Date(d).getTime() : NaN)
  const expensesBeforeProofOf = (a: SettlementAttendee) => {
    const proofAt = toTime(a.proof_uploaded_at)
    if (!a.payment_proof_url || Number.isNaN(proofAt)) return 0
    const key = normalizeName(a.full_name)
    return expenses
      .filter((e) => normalizeName(e.responsible) === key)
      .filter((e) => {
        const t = toTime(e.created_at)
        return !Number.isNaN(t) && t < proofAt
      })
      .reduce((sum, e) => sum + Number(e.amount), 0)
  }

  // Pendientes cuyos gastos ya cubren el evento → el caller los marca "paid".
  // Los invitados nunca: no deben nada que el gasto tenga que cubrir.
  const toMarkPaid = attendees
    .filter((a) => {
      if (a.payment_status === "paid" || isGuest(a)) return false
      const exp = expOf(a)
      return exp > 0 && exp >= owedOf(a)
    })
    .map((a) => a.id)
  const toMarkPaidSet = new Set(toMarkPaid)
  const isPaid = (a: SettlementAttendee) => a.payment_status === "paid" || toMarkPaidSet.has(a.id)

  // Cubiertos por gastos: pagados sin comprobante, con gastos >= precio adeudado.
  const coveredByExpensesIds = new Set(
    attendees
      .filter((a) => isPaid(a) && !a.payment_proof_url)
      .filter((a) => {
        const exp = expOf(a)
        return exp > 0 && exp >= owedOf(a)
      })
      .map((a) => a.id),
  )

  // Balance neto por asistente (ver CONTEXT.md, "Pago de evento y gastos"):
  // - no pagó, o paidViaExpenses → eventDebt = owed (el gasto absorbe la deuda)
  // - pagó independientemente (combo, marcado manual, o comprobante sin gastos
  //   previos) → eventDebt = 0, se le devuelven TODOS sus gastos
  // - pagó con comprobante habiendo cargado gastos ANTES → se asume que transfirió
  //   precio − gastos previos: eventDebt = min(owed, gastosPrevios). Los gastos
  //   cargados después del comprobante se devuelven enteros.
  // - invitado → eventDebt = 0, se le devuelven TODOS sus gastos
  const balances: PersonBalance[] = attendees.map((a) => {
    const guest = isGuest(a)
    const paidViaExpenses = coveredByExpensesIds.has(a.id)
    const expPaid = expOf(a)
    const owed = owedOf(a)
    const paidIndependently = isPaid(a) && !paidViaExpenses
    const discountedFromProof = paidIndependently ? Math.min(owed, expensesBeforeProofOf(a)) : 0
    const eventDebt = guest ? 0 : paidIndependently ? discountedFromProof : owed
    const amountTransferred = paidIndependently ? owed - discountedFromProof : 0
    return {
      attendee: a,
      owed,
      eventDebt,
      expPaid,
      net: eventDebt - expPaid,
      paidViaExpenses,
      discountedFromProof,
      amountTransferred,
      guest,
    }
  })
  const debtors = balances.filter((b) => b.net > 0)
  const creditors = balances.filter((b) => b.net < 0)

  // Adelantaron gastos sin ser asistentes confirmados
  const confirmedKeys = new Set(attendees.map((a) => normalizeName(a.full_name)))
  const externalCreditors: ExternalCreditor[] = []
  expenseByPerson.forEach((total, key) => {
    if (!confirmedKeys.has(key)) {
      externalCreditors.push({ name: displayNameByPerson.get(key) || key, expPaid: total, key })
    }
  })

  const totalCollected = balances
    .filter((b) => isPaid(b.attendee))
    .reduce((sum, b) => sum + pricePaidOf(b.attendee), 0)
  const totalPending = balances
    .filter((b) => !isPaid(b.attendee) && !b.guest)
    .reduce((sum, b) => sum + Math.max(b.owed - b.expPaid, 0), 0)

  return {
    balances,
    debtors,
    creditors,
    externalCreditors,
    coveredByExpensesIds,
    toMarkPaid,
    totalCollected,
    totalExpenses,
    balance: totalCollected - totalExpenses,
    totalPending,
    expenseByPerson,
    aliasByPerson,
    expenseIdsByPerson,
    settledByPerson,
  }
}
