import { normalizeName } from "@/lib/settlement"

/**
 * Módulo de Personas (ver CONTEXT.md): reglas puras de identidad por celular.
 * No toca la DB: las rutas le pasan lo que leyeron y aplican lo que decide.
 *
 * El celular es declarado, no verificado (docs/adr/0001): sirve para reconocer
 * a la misma Persona entre eventos, no para autenticar.
 */

/**
 * Lleva cualquier forma de escribir un celular argentino a 10 dígitos (área + número).
 * "+54 9 11 5555-1234", "011 15 5555-1234", "15 5555 1234" y "5555-1234" son el mismo número.
 * Sin código de área se asume 11 (Buenos Aires). Devuelve null si no es un celular válido.
 */
export function normalizePhone(text: string | null | undefined): string | null {
  let d = String(text ?? "").replace(/\D/g, "")
  if (d.length > 10 && d.startsWith("54")) d = d.slice(2)
  if (d.length > 10 && d.startsWith("9")) d = d.slice(1)
  if (d.startsWith("0")) d = d.slice(1)
  if (d.length === 12) {
    for (const area of [2, 3, 4]) {
      if (d.slice(area, area + 2) === "15") {
        d = d.slice(0, area) + d.slice(area + 2)
        break
      }
    }
  }
  if (d.length === 10 && d.startsWith("15")) d = "11" + d.slice(2)
  if (d.length === 8) d = "11" + d
  return d.length === 10 ? d : null
}

/** "1155551234" → "11 5555-1234" */
export function formatPhone(phone: string): string {
  return phone.startsWith("11")
    ? `11 ${phone.slice(2, 6)}-${phone.slice(6)}`
    : `${phone.slice(0, 3)} ${phone.slice(3, 6)}-${phone.slice(6)}`
}

/** Cómo se nombra a una Persona en el admin: su nombre real o, si no tiene, el último con el que figuró. */
export function personLabel(person: { realName: string | null; names: string[] }): string {
  if (person.realName) return person.realName
  return person.names.length > 0 ? `«${person.names[person.names.length - 1]}»` : "Sin nombre"
}

// ── Anotarse con celular ────────────────────────────────────────────────────

/** Una Persona tal como se le muestra a quien se anota: su id y el último nombre con el que figuró. */
export type PersonRef = { id: string; name: string }

export type EventAttendeeRef = { id: string; person_id: string | null; full_name: string }

export type RegistrationDecision =
  | { kind: "invalid"; error: string }
  /** El celular ya tiene Personas: hay que preguntar quién es antes de crear nada. */
  | { kind: "choose"; options: PersonRef[] }
  /** Esa Persona ya está anotada en el evento: no se crea otra anotación. */
  | { kind: "already"; attendeeId: string; personId: string }
  /** Otro anotado del evento ya usa ese nombre. */
  | { kind: "name-taken"; error: string }
  /** Anotar. personId null = crear una Persona nueva con ese celular. */
  | { kind: "register"; personId: string | null }

/**
 * Decide qué hacer cuando alguien se anota con nombre + celular a un evento que pide celular.
 *
 * personId: undefined = que la app resuelva (y pregunte si el celular ya existe),
 *           "new"     = otra Persona con el mismo celular,
 *           un id     = una Persona que ya tiene ese celular.
 */
export function decideRegistration({
  name,
  phone,
  personId,
  peopleForPhone,
  eventAttendees,
}: {
  name: string | null | undefined
  /** Ya normalizado con normalizePhone (null = inválido). */
  phone: string | null
  personId: string | undefined
  peopleForPhone: PersonRef[]
  /** Asistentes confirmados del evento. */
  eventAttendees: EventAttendeeRef[]
}): RegistrationDecision {
  if (!phone) {
    return { kind: "invalid", error: "Ese celular no parece válido. Escribilo con código de área, por ejemplo 11 5555-1234." }
  }

  if (personId === undefined && peopleForPhone.length > 0) {
    return { kind: "choose", options: peopleForPhone }
  }

  const isNewPerson = personId === "new" || peopleForPhone.length === 0
  if (!isNewPerson) {
    if (!peopleForPhone.some((p) => p.id === personId)) {
      return { kind: "invalid", error: "Esa persona no corresponde a ese celular." }
    }
    const already = eventAttendees.find((a) => a.person_id === personId)
    if (already) return { kind: "already", attendeeId: already.id, personId: personId! }
  }

  const cleanName = (name ?? "").trim()
  if (!cleanName) return { kind: "invalid", error: "Falta el nombre. Puede ser el que quieras." }

  // El nombre es único dentro del evento: los gastos y la liquidación cruzan por nombre.
  const key = normalizeName(cleanName)
  if (eventAttendees.some((a) => normalizeName(a.full_name) === key)) {
    return {
      kind: "name-taken",
      error: `Ya hay un «${cleanName}» anotado. Agregá algo para distinguirte (por ejemplo, tu apellido).`,
    }
  }

  return { kind: "register", personId: isNewPerson ? null : personId! }
}

// ── Comprobantes ────────────────────────────────────────────────────────────

export type ProofOrigin = "own" | "other" | "unidentified"

/**
 * Desde dónde se subió un comprobante: el teléfono de la propia Persona, el de otro,
 * o uno sin identificar (ver "El celular ordena, no autentica" en CONTEXT.md).
 */
export function proofOrigin(uploadedFrom: string | null, personPhones: string[]): ProofOrigin {
  if (!uploadedFrom) return "unidentified"
  return personPhones.includes(uploadedFrom) ? "own" : "other"
}

// ── Fusionar ────────────────────────────────────────────────────────────────

/**
 * Eventos en los que las dos Personas están anotadas a la vez. Con alguno, no se fusiona:
 * el admin tiene que quitar una de las dos anotaciones primero (pueden tener pagos o gastos).
 */
export function mergeConflicts(
  sourceAttendees: { event_id: string }[],
  targetAttendees: { event_id: string }[],
): string[] {
  const targetEvents = new Set(targetAttendees.map((a) => a.event_id))
  return Array.from(new Set(sourceAttendees.map((a) => a.event_id).filter((id) => targetEvents.has(id))))
}

// ── Importar lista ──────────────────────────────────────────────────────────

export type ImportRow = {
  line: number
  realName: string
  team: "A" | "B" | null
  phone: string | null
  error: string | null
}

/**
 * Lee una lista pegada: una persona por línea, columnas separadas por ";" o tabulación.
 * Columnas: Nombre real; Plantel (A, B o vacío = externo); Celular (opcional). Lo que siga se ignora.
 * La primera línea se saltea si es un encabezado.
 */
export function parseImportList(text: string): ImportRow[] {
  const rows: ImportRow[] = []
  const lines = text.split(/\r?\n/)
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i].replace(/^﻿/, "")
    if (!raw.trim()) continue
    const cells = raw.split(raw.includes("\t") ? "\t" : ";").map((c) => c.trim())
    const realName = cells[0] ?? ""
    if (rows.length === 0 && normalizeName(realName).startsWith("nombre")) continue

    const teamText = (cells[1] ?? "").toUpperCase()
    const phoneText = cells[2] ?? ""
    const phone = phoneText ? normalizePhone(phoneText) : null

    let error: string | null = null
    if (!realName) error = "Falta el nombre"
    else if (teamText !== "" && teamText !== "A" && teamText !== "B") error = `Plantel "${cells[1]}" no válido (A, B o vacío)`
    else if (phoneText && !phone) error = `Celular "${phoneText}" no válido`

    rows.push({
      line: i + 1,
      realName,
      team: teamText === "A" || teamText === "B" ? teamText : null,
      phone,
      error,
    })
  }
  return rows
}

export type ExistingPerson = { id: string; real_name: string | null; team: string | null; phones: string[] }

export type ImportPlanRow = ImportRow & {
  /** create = Persona nueva; update = completa plantel o celular de una existente; none = ya estaba igual. */
  action: "error" | "create" | "update" | "none"
  /** Persona existente con ese nombre real (null si se crea, o si la crea una fila anterior de la misma lista). */
  personId: string | null
  setTeam: boolean
  addPhone: boolean
  note: string | null
}

/**
 * Qué haría la importación con cada fila. Una fila coincide con una Persona si tienen el mismo
 * nombre real (sin tildes ni mayúsculas). Plantel vacío en una Persona existente no la saca del
 * plantel: solo se completa lo que falta.
 */
export function planImport(rows: ImportRow[], existing: ExistingPerson[]): ImportPlanRow[] {
  type Known = { id: string | null; name: string; team: string | null; phones: Set<string> }
  const byName = new Map<string, Known>()
  const phoneOwners = new Map<string, Known[]>()
  const track = (person: Known, phone: string) => {
    phoneOwners.set(phone, [...(phoneOwners.get(phone) ?? []), person])
  }
  for (const p of existing) {
    if (!p.real_name) continue
    const known: Known = { id: p.id, name: p.real_name, team: p.team, phones: new Set(p.phones) }
    const key = normalizeName(p.real_name)
    if (!byName.has(key)) byName.set(key, known)
    for (const phone of p.phones) track(known, phone)
  }

  return rows.map((row) => {
    if (row.error) return { ...row, action: "error", personId: null, setTeam: false, addPhone: false, note: null }

    const key = normalizeName(row.realName)
    const person = byName.get(key)
    const others = row.phone ? (phoneOwners.get(row.phone) ?? []).filter((o) => o !== person) : []
    const note = others.length > 0 ? `Ese celular ya lo tiene ${others.map((o) => o.name).join(", ")}` : null

    if (!person) {
      const created: Known = { id: null, name: row.realName, team: row.team, phones: new Set(row.phone ? [row.phone] : []) }
      byName.set(key, created)
      if (row.phone) track(created, row.phone)
      return { ...row, action: "create", personId: null, setTeam: false, addPhone: false, note }
    }

    const setTeam = row.team !== null && row.team !== person.team
    const addPhone = row.phone !== null && !person.phones.has(row.phone)
    if (setTeam) person.team = row.team
    if (addPhone) {
      person.phones.add(row.phone!)
      track(person, row.phone!)
    }
    return { ...row, action: setTeam || addPhone ? "update" : "none", personId: person.id, setTeam, addPhone, note }
  })
}
