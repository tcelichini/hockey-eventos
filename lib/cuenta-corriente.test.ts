import { describe, it, expect } from "vitest"
import { settleEvent, type SettlementAttendee, type SettlementExpense } from "@/lib/settlement"
import { consolidateAccounts, type AccountEvent } from "@/lib/cuenta-corriente"

// ── Fixtures ────────────────────────────────────────────────────────────────

let seq = 0

function makeAccountEvent(overrides: Partial<AccountEvent> = {}): AccountEvent {
  const n = ++seq
  return { id: `ev-${n}`, title: `Evento ${n}`, date: new Date("2026-07-01"), slug: `evento-${n}`, ...overrides }
}

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

const EVENT_10K = { payment_amount: "10000", pricing_tiers: null, date_tiers: null, inferiores_price: null }

function settle(attendees: SettlementAttendee[], expenses: SettlementExpense[] = []) {
  return settleEvent({ event: EVENT_10K, attendees, expenses })
}

// ── consolidateAccounts ─────────────────────────────────────────────────────

describe("consolidateAccounts", () => {
  it("suma deudas de la misma persona across eventos", () => {
    const accounts = consolidateAccounts([
      { event: makeAccountEvent(), settlement: settle([makeAttendee({ full_name: "Ana" })]) },
      { event: makeAccountEvent(), settlement: settle([makeAttendee({ full_name: "Ana" })]) },
    ])
    expect(accounts).toHaveLength(1)
    expect(accounts[0].total).toBe(20000)
    expect(accounts[0].events).toHaveLength(2)
  })

  it("consolida a la misma persona con tildes y formatos distintos", () => {
    const accounts = consolidateAccounts([
      { event: makeAccountEvent(), settlement: settle([makeAttendee({ full_name: "José García" })]) },
      { event: makeAccountEvent(), settlement: settle([makeAttendee({ full_name: "jose garcia" })]) },
    ])
    expect(accounts).toHaveLength(1)
    expect(accounts[0].total).toBe(20000)
    expect(accounts[0].displayName).toBe("José García")
  })

  it("netea deudor en un evento con acreedor en otro", () => {
    const accounts = consolidateAccounts([
      // Debe 10000 (pending, sin gastos)
      { event: makeAccountEvent(), settlement: settle([makeAttendee({ full_name: "Ana" })]) },
      // Le deben 4000 (pagó con comprobante y gastó 4000)
      {
        event: makeAccountEvent(),
        settlement: settle(
          [makeAttendee({ full_name: "Ana", payment_status: "paid", payment_proof_url: "https://p" })],
          [makeExpense({ responsible: "Ana", amount: "4000" })],
        ),
      },
    ])
    expect(accounts).toHaveLength(1)
    expect(accounts[0].total).toBe(6000)
  })

  it("los que están al día no aparecen", () => {
    const accounts = consolidateAccounts([
      {
        event: makeAccountEvent(),
        settlement: settle([makeAttendee({ full_name: "Ana", payment_status: "paid", payment_proof_url: "https://p" })]),
      },
    ])
    expect(accounts).toHaveLength(0)
  })

  it("acreedor con todos sus gastos saldados no aparece", () => {
    const accounts = consolidateAccounts([
      {
        event: makeAccountEvent(),
        settlement: settle(
          [makeAttendee({ full_name: "Ana", payment_status: "paid", payment_proof_url: "https://p" })],
          [makeExpense({ responsible: "Ana", amount: "4000", settled: true })],
        ),
      },
    ])
    expect(accounts).toHaveLength(0)
  })

  it("acreedor con gastos parcialmente saldados sí aparece (con el net completo)", () => {
    const accounts = consolidateAccounts([
      {
        event: makeAccountEvent(),
        settlement: settle(
          [makeAttendee({ full_name: "Ana", payment_status: "paid", payment_proof_url: "https://p" })],
          [
            makeExpense({ responsible: "Ana", amount: "4000", settled: true }),
            makeExpense({ responsible: "Ana", amount: "3000", settled: false }),
          ],
        ),
      },
    ])
    expect(accounts).toHaveLength(1)
    expect(accounts[0].total).toBe(-7000)
  })

  it("acreedor externo entra con net negativo y flag external", () => {
    const accounts = consolidateAccounts([
      {
        event: makeAccountEvent(),
        settlement: settle([], [makeExpense({ responsible: "Carlos", amount: "7000" })]),
      },
    ])
    expect(accounts).toHaveLength(1)
    expect(accounts[0].total).toBe(-7000)
    expect(accounts[0].events[0].external).toBe(true)
  })

  it("externo saldado no aparece", () => {
    const accounts = consolidateAccounts([
      {
        event: makeAccountEvent(),
        settlement: settle([], [makeExpense({ responsible: "Carlos", amount: "7000", settled: true })]),
      },
    ])
    expect(accounts).toHaveLength(0)
  })

  it("ordena deudores primero (desc) y acreedores después (mayor crédito primero)", () => {
    const accounts = consolidateAccounts([
      {
        event: makeAccountEvent(),
        settlement: settle(
          [
            makeAttendee({ full_name: "DebeMucho", price_paid: "20000" }),
            makeAttendee({ full_name: "DebePoco", price_paid: "5000" }),
          ],
          [
            makeExpense({ responsible: "AcreedorGrande", amount: "30000" }),
            makeExpense({ responsible: "AcreedorChico", amount: "1000" }),
          ],
        ),
      },
    ])
    expect(accounts.map((a) => a.displayName)).toEqual([
      "DebeMucho",
      "DebePoco",
      "AcreedorGrande",
      "AcreedorChico",
    ])
  })
})
