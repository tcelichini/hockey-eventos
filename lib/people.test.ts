import { describe, it, expect } from "vitest"
import {
  normalizePhone,
  formatPhone,
  decideRegistration,
  proofOrigin,
  mergeConflicts,
  parseImportList,
  planImport,
  type PersonRef,
  type EventAttendeeRef,
} from "@/lib/people"

const PHONE = "1155551234"
const GUILLOTE: PersonRef = { id: "p-guillote", name: "Guillote" }
const SOFI: PersonRef = { id: "p-sofi", name: "Sofi" }

function attendee(overrides: Partial<EventAttendeeRef> = {}): EventAttendeeRef {
  return { id: "att-1", person_id: null, full_name: "Juan", ...overrides }
}

// ── normalizePhone ──────────────────────────────────────────────────────────

describe("normalizePhone", () => {
  it.each([
    "11 5555-1234",
    "+54 9 11 5555-1234",
    "011 15 5555-1234",
    "15 5555 1234",
    "5555-1234",
    "+54 11 5555 1234",
    "1155551234",
  ])("reconoce %s como el mismo celular", (text) => {
    expect(normalizePhone(text)).toBe(PHONE)
  })

  it("respeta códigos de área del interior", () => {
    expect(normalizePhone("2804123456")).toBe("2804123456")
    expect(normalizePhone("0351 15 555-1234")).toBe("3515551234")
    expect(normalizePhone("+54 9 3388 12-3456")).toBe("3388123456")
  })

  it("rechaza lo que no es un celular", () => {
    expect(normalizePhone("123")).toBeNull()
    expect(normalizePhone("11155551234")).toBeNull() // sobra un dígito
    expect(normalizePhone("")).toBeNull()
    expect(normalizePhone(null)).toBeNull()
  })
})

describe("formatPhone", () => {
  it("separa área y número", () => {
    expect(formatPhone(PHONE)).toBe("11 5555-1234")
    expect(formatPhone("2804123456")).toBe("280 412-3456")
  })
})

// ── decideRegistration ──────────────────────────────────────────────────────

describe("decideRegistration", () => {
  const base = { name: "Guillote", phone: PHONE, personId: undefined, peopleForPhone: [], eventAttendees: [] }

  it("celular nuevo: anota creando una Persona", () => {
    expect(decideRegistration(base)).toEqual({ kind: "register", personId: null })
  })

  it("celular inválido: no anota", () => {
    expect(decideRegistration({ ...base, phone: null }).kind).toBe("invalid")
  })

  it("celular conocido sin decir quién es: pregunta antes de crear nada", () => {
    const decision = decideRegistration({ ...base, name: "Guille C.", peopleForPhone: [GUILLOTE] })
    expect(decision).toEqual({ kind: "choose", options: [GUILLOTE] })
  })

  it("misma Persona con otro nombre en otro evento: la anota sin crear otra", () => {
    const decision = decideRegistration({ ...base, name: "Guille C.", personId: GUILLOTE.id, peopleForPhone: [GUILLOTE] })
    expect(decision).toEqual({ kind: "register", personId: GUILLOTE.id })
  })

  it("no deja a la misma Persona dos veces en el evento, aunque cambie el nombre", () => {
    const decision = decideRegistration({
      ...base,
      name: "Guillermo Campana",
      personId: GUILLOTE.id,
      peopleForPhone: [GUILLOTE],
      eventAttendees: [attendee({ id: "att-g", person_id: GUILLOTE.id, full_name: "Guillote" })],
    })
    expect(decision).toEqual({ kind: "already", attendeeId: "att-g", personId: GUILLOTE.id })
  })

  it("otra persona con el mismo celular: crea una Persona aparte", () => {
    const decision = decideRegistration({
      ...base,
      name: "Sofi",
      personId: "new",
      peopleForPhone: [GUILLOTE],
      eventAttendees: [attendee({ person_id: GUILLOTE.id, full_name: "Guillote" })],
    })
    expect(decision).toEqual({ kind: "register", personId: null })
  })

  it("celular con dos Personas: anota a la elegida", () => {
    const decision = decideRegistration({ ...base, name: "Sofi", personId: SOFI.id, peopleForPhone: [GUILLOTE, SOFI] })
    expect(decision).toEqual({ kind: "register", personId: SOFI.id })
  })

  it("rechaza una Persona que no tiene ese celular", () => {
    const decision = decideRegistration({ ...base, personId: "p-otro", peopleForPhone: [GUILLOTE] })
    expect(decision.kind).toBe("invalid")
  })

  it("pide distinguirse si otro anotado ya usa ese nombre (sin tildes ni mayúsculas)", () => {
    const decision = decideRegistration({
      ...base,
      name: "jose",
      eventAttendees: [attendee({ person_id: "p-otro", full_name: "José" })],
    })
    expect(decision.kind).toBe("name-taken")
  })

  it("el nombre también choca con anotados sin Persona (agregados a mano)", () => {
    const decision = decideRegistration({ ...base, name: "Juan", eventAttendees: [attendee()] })
    expect(decision.kind).toBe("name-taken")
  })

  it("sin nombre no anota", () => {
    expect(decideRegistration({ ...base, name: "   " }).kind).toBe("invalid")
  })
})

// ── proofOrigin ─────────────────────────────────────────────────────────────

describe("proofOrigin", () => {
  it("distingue teléfono propio, de otro y sin identificar", () => {
    expect(proofOrigin(PHONE, [PHONE])).toBe("own")
    expect(proofOrigin("1144440000", [PHONE])).toBe("other")
    expect(proofOrigin(null, [PHONE])).toBe("unidentified")
    expect(proofOrigin(PHONE, [])).toBe("other")
  })
})

// ── mergeConflicts ──────────────────────────────────────────────────────────

describe("mergeConflicts", () => {
  it("sin eventos en común no hay conflicto", () => {
    expect(mergeConflicts([{ event_id: "e1" }], [{ event_id: "e2" }])).toEqual([])
  })

  it("devuelve los eventos donde las dos están anotadas", () => {
    expect(mergeConflicts([{ event_id: "e1" }, { event_id: "e2" }], [{ event_id: "e2" }, { event_id: "e3" }])).toEqual(["e2"])
  })
})

// ── parseImportList ─────────────────────────────────────────────────────────

describe("parseImportList", () => {
  it("lee nombre, plantel y celular, y saltea el encabezado", () => {
    const rows = parseImportList("Nombre real;Plantel;Celular;Nota\nPérez, Juan;A;11 5555-1234;\nGómez, Ana;;1144440000;Externo\n")
    expect(rows).toEqual([
      { line: 2, realName: "Pérez, Juan", team: "A", phone: "1155551234", error: null },
      { line: 3, realName: "Gómez, Ana", team: null, phone: "1144440000", error: null },
    ])
  })

  it("acepta tabulaciones y filas sin celular", () => {
    const rows = parseImportList("Mora, Tobías\tb\t")
    expect(rows).toEqual([{ line: 1, realName: "Mora, Tobías", team: "B", phone: null, error: null }])
  })

  it("marca los errores sin frenar el resto", () => {
    const rows = parseImportList("López, Luis;;11155551234\nDíaz, Eva;C;\n;A;1155551234\nRuiz, Leo;B;1144440001")
    expect(rows.map((r) => r.error !== null)).toEqual([true, true, true, false])
  })
})

// ── planImport ──────────────────────────────────────────────────────────────

describe("planImport", () => {
  const existing = [
    { id: "p1", real_name: "Pérez, Juan", team: "A", phones: [] },
    { id: "p2", real_name: "Ruiz, Leo", team: "B", phones: ["1144440001"] },
  ]
  const plan = (text: string) => planImport(parseImportList(text), existing)

  it("crea las Personas que no existen", () => {
    const [row] = plan("Gómez, Ana;;1144440000")
    expect(row).toMatchObject({ action: "create", personId: null })
  })

  it("completa el celular de una Persona que ya existe, sin importar tildes ni mayúsculas", () => {
    const [row] = plan("perez, juan;A;1155551234")
    expect(row).toMatchObject({ action: "update", personId: "p1", addPhone: true, setTeam: false })
  })

  it("no toca lo que ya está igual", () => {
    const [row] = plan("Ruiz, Leo;B;11 4444-0001")
    expect(row).toMatchObject({ action: "none", personId: "p2" })
  })

  it("plantel vacío no saca del plantel a una Persona existente", () => {
    const [row] = plan("Ruiz, Leo;;")
    expect(row).toMatchObject({ action: "none", setTeam: false })
  })

  it("una fila repetida en la misma lista completa a la que se crea antes", () => {
    const rows = plan("Sosa, Pedro;;\nSosa, Pedro;;1144440002")
    expect(rows.map((r) => r.action)).toEqual(["create", "update"])
    expect(rows[1]).toMatchObject({ personId: null, addPhone: true })
  })

  it("avisa cuando el celular ya es de otra Persona, sin bloquear", () => {
    const [row] = plan("Ruiz, Lucía;;1144440001")
    expect(row.action).toBe("create")
    expect(row.note).toContain("Ruiz, Leo")
  })

  it("las filas con error no hacen nada", () => {
    const [row] = plan("López, Luis;;11155551234")
    expect(row.action).toBe("error")
  })
})
