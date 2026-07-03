import { describe, it, expect } from "vitest"
import {
  normalizeName,
  getOwedPrice,
  settleEvent,
  type SettlementEvent,
  type SettlementAttendee,
  type SettlementExpense,
} from "@/lib/settlement"
import { classifyComboPayment } from "@/lib/combo-payment"

// ── Fixtures ────────────────────────────────────────────────────────────────

function makeEvent(overrides: Partial<SettlementEvent> = {}): SettlementEvent {
  return {
    payment_amount: "10000",
    pricing_tiers: null,
    date_tiers: null,
    inferiores_price: null,
    ...overrides,
  }
}

let seq = 0
function makeAttendee(overrides: Partial<SettlementAttendee> = {}): SettlementAttendee {
  return {
    id: `att-${++seq}`,
    full_name: "Pérez, Juan",
    payment_status: "pending",
    payment_proof_url: null,
    price_paid: null,
    is_inferiores: false,
    ...overrides,
  }
}

function makeExpense(overrides: Partial<SettlementExpense> = {}): SettlementExpense {
  return {
    id: `exp-${++seq}`,
    responsible: "Pérez, Juan",
    amount: "5000",
    payment_alias: null,
    settled: false,
    ...overrides,
  }
}

// ── normalizeName ───────────────────────────────────────────────────────────

describe("normalizeName", () => {
  it("quita tildes: José y Jose son la misma persona", () => {
    expect(normalizeName("José Pérez")).toBe(normalizeName("jose perez"))
  })

  it("ignora mayúsculas y espacios", () => {
    expect(normalizeName("  GARCÍA, Ana ")).toBe("garcia, ana")
  })
})

// ── getOwedPrice: escalera de precio adeudado ───────────────────────────────

describe("getOwedPrice", () => {
  it("inferiores gana sobre todo lo demás", () => {
    const event = makeEvent({
      inferiores_price: "3000",
      date_tiers: [{ until: null, price: 20000 }],
      pricing_tiers: [{ upTo: null, price: 15000 }],
    })
    expect(getOwedPrice(event, makeAttendee({ is_inferiores: true }))).toBe(3000)
  })

  it("date_tiers: usa el tramo vigente según now", () => {
    const event = makeEvent({
      date_tiers: [
        { until: "2026-07-10", price: 8000 },
        { until: null, price: 12000 },
      ],
    })
    expect(getOwedPrice(event, makeAttendee(), "2026-07-05")).toBe(8000)
    expect(getOwedPrice(event, makeAttendee(), "2026-07-20")).toBe(12000)
  })

  it("pricing_tiers: usa el tramo más caro", () => {
    const event = makeEvent({
      pricing_tiers: [
        { upTo: 10, price: 7000 },
        { upTo: null, price: 9000 },
      ],
    })
    expect(getOwedPrice(event, makeAttendee())).toBe(9000)
  })

  it("precio fijo: price_paid del asistente, o payment_amount del evento", () => {
    expect(getOwedPrice(makeEvent(), makeAttendee({ price_paid: "8500" }))).toBe(8500)
    expect(getOwedPrice(makeEvent(), makeAttendee())).toBe(10000)
  })

  it("combo impago: debe el precio del evento, no la cuota del combo (CONTEXT.md)", () => {
    // La regla se cumple por construcción: la escalera no mira el combo.
    const event = makeEvent({ date_tiers: [{ until: null, price: 12000 }] })
    const comboAttendee = makeAttendee({ price_paid: "6000" }) // cuota-parte asignada al anotarse
    expect(getOwedPrice(event, comboAttendee, "2026-07-03")).toBe(12000)
  })
})

// ── settleEvent ─────────────────────────────────────────────────────────────

describe("settleEvent", () => {
  it("INVARIANTE CRÍTICO: pagó con comprobante → se le devuelven TODOS sus gastos", () => {
    const a = makeAttendee({ payment_status: "paid", payment_proof_url: "https://proof" })
    const s = settleEvent({
      event: makeEvent(),
      attendees: [a],
      expenses: [makeExpense({ amount: "4000" })],
    })
    const b = s.balances[0]
    expect(b.eventDebt).toBe(0)
    expect(b.net).toBe(-4000)
    expect(b.paidViaExpenses).toBe(false)
    expect(s.creditors).toHaveLength(1)
  })

  it("cubierto por gastos: entra en toMarkPaid y solo se devuelve la diferencia", () => {
    const a = makeAttendee() // pending, evento de $10000
    const s = settleEvent({
      event: makeEvent(),
      attendees: [a],
      expenses: [makeExpense({ amount: "15000" })],
    })
    expect(s.toMarkPaid).toEqual([a.id])
    expect(s.coveredByExpensesIds.has(a.id)).toBe(true)
    const b = s.balances[0]
    expect(b.paidViaExpenses).toBe(true)
    expect(b.eventDebt).toBe(10000)
    expect(b.net).toBe(-5000) // se le devuelve la diferencia, no todo
  })

  it("gastos insuficientes: sigue debiendo el neto", () => {
    const a = makeAttendee()
    const s = settleEvent({
      event: makeEvent(),
      attendees: [a],
      expenses: [makeExpense({ amount: "4000" })],
    })
    expect(s.toMarkPaid).toEqual([])
    const b = s.balances[0]
    expect(b.net).toBe(6000)
    expect(s.debtors).toHaveLength(1)
    expect(s.totalPending).toBe(6000)
  })

  it("marcado manual (paid sin comprobante, sin gastos que cubran): eventDebt = 0", () => {
    const a = makeAttendee({ payment_status: "paid" })
    const s = settleEvent({
      event: makeEvent(),
      attendees: [a],
      expenses: [makeExpense({ amount: "2000" })],
    })
    const b = s.balances[0]
    expect(b.paidViaExpenses).toBe(false)
    expect(b.eventDebt).toBe(0)
    expect(b.net).toBe(-2000)
  })

  it("matchea gastos con tildes distintas (bug de matching silencioso)", () => {
    const a = makeAttendee({ full_name: "José García" })
    const s = settleEvent({
      event: makeEvent(),
      attendees: [a],
      expenses: [makeExpense({ responsible: "jose garcia", amount: "12000" })],
    })
    expect(s.toMarkPaid).toEqual([a.id])
    expect(s.externalCreditors).toHaveLength(0)
  })

  it("acreedor externo: gastó sin ser asistente", () => {
    const s = settleEvent({
      event: makeEvent(),
      attendees: [makeAttendee({ full_name: "Ana" })],
      expenses: [makeExpense({ responsible: "Carlos", amount: "7000", payment_alias: "carlos.mp" })],
    })
    expect(s.externalCreditors).toEqual([
      { name: "Carlos", expPaid: 7000, key: "carlos" },
    ])
    expect(s.aliasByPerson.get("carlos")).toBe("carlos.mp")
  })

  it("totales: cobrado incluye a los toMarkPaid, balance descuenta gastos", () => {
    const paid = makeAttendee({ payment_status: "paid", payment_proof_url: "https://p", price_paid: "10000" })
    const covered = makeAttendee({ full_name: "Beto", price_paid: "10000" })
    const owing = makeAttendee({ full_name: "Cami" })
    const s = settleEvent({
      event: makeEvent(),
      attendees: [paid, covered, owing],
      expenses: [makeExpense({ responsible: "Beto", amount: "10000" })],
    })
    expect(s.toMarkPaid).toEqual([covered.id])
    expect(s.totalCollected).toBe(20000) // paid + covered
    expect(s.totalExpenses).toBe(10000)
    expect(s.balance).toBe(10000)
    expect(s.totalPending).toBe(10000) // solo Cami
  })

  it("settledByPerson: true solo si TODOS los gastos de la persona están saldados", () => {
    const s = settleEvent({
      event: makeEvent(),
      attendees: [],
      expenses: [
        makeExpense({ responsible: "Ana", settled: true }),
        makeExpense({ responsible: "Ana", settled: false }),
        makeExpense({ responsible: "Beto", settled: true }),
      ],
    })
    expect(s.settledByPerson.get("ana")).toBe(false)
    expect(s.settledByPerson.get("beto")).toBe(true)
  })
})

// ── classifyComboPayment ────────────────────────────────────────────────────

describe("classifyComboPayment", () => {
  it("misma proof URL en todos los registros del combo → pagó vía combo", () => {
    const records = [
      { id: "1", combo_id: "c1", full_name: "Ana", payment_proof_url: "https://p" },
      { id: "2", combo_id: "c1", full_name: "ana", payment_proof_url: "https://p" },
    ]
    const set = classifyComboPayment(records)
    expect(set.has("1")).toBe(true)
    expect(set.has("2")).toBe(true)
  })

  it("URLs distintas → pagó cada evento individual, no vía combo", () => {
    const records = [
      { id: "1", combo_id: "c1", full_name: "Ana", payment_proof_url: "https://p1" },
      { id: "2", combo_id: "c1", full_name: "Ana", payment_proof_url: "https://p2" },
    ]
    expect(classifyComboPayment(records).size).toBe(0)
  })

  it("sin proof URL → no cuenta como combo", () => {
    const records = [
      { id: "1", combo_id: "c1", full_name: "Ana", payment_proof_url: null },
      { id: "2", combo_id: "c1", full_name: "Ana", payment_proof_url: null },
    ]
    expect(classifyComboPayment(records).size).toBe(0)
  })
})
