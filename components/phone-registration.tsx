"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { formatPhone, type PersonRef } from "@/lib/people"
import { normalizeName } from "@/lib/settlement"
import { getDevicePhone, setDevicePhone } from "@/lib/device-phone"

type LookupPerson = PersonRef & {
  /** Su anotación en este evento, si ya tiene una. */
  attendee: { id: string; full_name: string; payment_status: string } | null
}

/** Respuesta de POST /api/attendees cuando hay un asistente (nuevo o que ya estaba). */
export type AttendeeResponse = {
  attendee: { id: string; full_name: string; payment_status: string; payment_proof_url: string | null }
  payment_account: string
  payment_amount: string
  expenses_total?: string
  amount_due?: string
  whatsapp_number: string
  event_title: string
  existing?: boolean
  phone?: string
}

type View =
  | "loading"
  | "form"        // primera vez: nombre + celular
  | "phone"       // subir comprobante sin teléfono conocido: solo el celular
  | "choose"      // escribió un celular que ya existe: ¿quién sos?
  | "who"         // el teléfono recuerda un celular con más de una Persona
  | "recognized"  // el teléfono sabe quién es
  | "other"       // anotar a otra persona con este celular
  | "list"        // elegir un nombre de la lista (comprobante de otro, o anotado sin celular)

const selectClass =
  "w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
const linkClass = "text-sm text-blue-600 underline underline-offset-2"
const optionClass =
  "w-full text-left rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-800 hover:border-gray-300 active:bg-gray-50 transition-colors disabled:opacity-50"

/**
 * Anotarse a un evento que pide celular (ver "Personas" en CONTEXT.md): nombre libre + celular
 * la primera vez; después el teléfono recuerda el número y solo se confirma el nombre.
 * Qué pasa con cada anotación lo decide el servidor (lib/people.ts); acá solo se pregunta y se muestra.
 */
export default function PhoneRegistration({
  event,
  isUploadMode,
  prefillName,
  startWithOther = false,
  onDone,
}: {
  event: { id: string; inferiores_price: string | null; unpaidAttendeeNames: string[] }
  isUploadMode: boolean
  /** Nombre que llega en la URL (desde /mi-cuenta o un recordatorio). */
  prefillName: string | null
  /** Volvió desde los datos de pago para anotar a otra persona. */
  startWithOther?: boolean
  onDone: (data: AttendeeResponse) => void
}) {
  const [view, setView] = useState<View>("loading")
  const [phone, setPhone] = useState("")
  const [people, setPeople] = useState<LookupPerson[]>([])
  const [selected, setSelected] = useState<LookupPerson | null>(null)
  const [choices, setChoices] = useState<PersonRef[]>([])
  const [name, setName] = useState("")
  const [phoneInput, setPhoneInput] = useState("")
  const [isInferiores, setIsInferiores] = useState(false)
  const [listName, setListName] = useState("")
  const [notice, setNotice] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const unpaidNames = event.unpaidAttendeeNames || []
  const firstView: View = isUploadMode ? "phone" : "form"

  async function lookup(phoneText: string): Promise<{ phone: string; people: LookupPerson[] } | null> {
    const res = await fetch("/api/people/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_id: event.id, phone: phoneText }),
    })
    const data = await res.json()
    if (!res.ok) {
      setError(data.error || "No pudimos buscar ese celular")
      return null
    }
    return data
  }

  async function post(body: Record<string, unknown>) {
    setLoading(true)
    setError("")
    const res = await fetch("/api/attendees", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event_id: event.id, status: "confirmed", ...body }),
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) {
      setError(data.error || "Error al confirmar")
      return
    }
    if (data.choose) {
      setChoices(data.choose)
      setPhone(data.phone)
      setView("choose")
      return
    }
    if (data.phone) setDevicePhone(data.phone)
    onDone(data)
  }

  /** Ya está anotado: ir a sus datos de pago sin crear nada. */
  function continueAs(person: LookupPerson, personPhone: string) {
    return post({ full_name: person.attendee!.full_name, phone: personPhone, person_id: person.id })
  }

  function select(person: LookupPerson) {
    setSelected(person)
    setName(person.name)
    setView("recognized")
  }

  /** Con el celular ya resuelto: a qué pantalla ir según quiénes lo tienen. */
  function route(found: { phone: string; people: LookupPerson[] }) {
    setPhone(found.phone)
    setPeople(found.people)
    setError("")

    if (found.people.length === 0) {
      if (isUploadMode) {
        setNotice("No encontramos una anotación con ese celular en este evento. Elegí tu nombre de la lista.")
        setView("list")
      } else {
        setPhoneInput(formatPhone(found.phone))
        setView("form")
      }
      return
    }

    if (isUploadMode) {
      const registered = found.people.filter((p) => p.attendee)
      if (registered.length === 1) return void continueAs(registered[0], found.phone)
      if (registered.length === 0) {
        setNotice("No encontramos una anotación con ese celular en este evento. Elegí tu nombre de la lista.")
        setView("list")
        return
      }
    }

    if (found.people.length === 1) select(found.people[0])
    else setView("who")
  }

  useEffect(() => {
    let stale = false
    async function start() {
      // Llega con un nombre en la URL (desde /mi-cuenta o un recordatorio): directo a la lista, con el nombre elegido
      const match = prefillName && unpaidNames.find((n) => normalizeName(n) === normalizeName(prefillName))
      if (match) {
        setListName(match)
        setView("list")
        return
      }

      const remembered = getDevicePhone()
      if (!remembered) {
        setView(firstView)
        return
      }
      const found = await lookup(remembered)
      if (stale) return
      if (!found) {
        setError("")
        setView(firstView)
        return
      }
      if (startWithOther && found.people.length > 0) {
        setPhone(found.phone)
        setPeople(found.people)
        setView("other")
        return
      }
      route(found)
    }
    start()
    return () => { stale = true }
    // Solo al montar: después manda lo que la persona va eligiendo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handlePhoneOnly(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")
    const found = await lookup(phoneInput)
    setLoading(false)
    if (found) route(found)
  }

  function backToStart() {
    setError("")
    setNotice("")
    if (people.length === 1) select(people[0])
    else if (people.length > 1) setView("who")
    else setView(firstView)
  }

  const inferioresCheckbox = event.inferiores_price && (
    <div className="flex items-center gap-3">
      <input
        type="checkbox"
        id="is_inferiores"
        checked={isInferiores}
        onChange={(e) => setIsInferiores(e.target.checked)}
        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
      />
      <label htmlFor="is_inferiores" className="text-sm text-gray-700 cursor-pointer">
        Soy de inferiores
      </label>
    </div>
  )

  const errorLine = error && <p className="text-red-500 text-sm">{error}</p>

  const listLink = unpaidNames.length > 0 && (
    <button type="button" className={linkClass} onClick={() => { setError(""); setNotice(""); setView("list") }}>
      Subir el comprobante de otra persona
    </button>
  )

  if (view === "loading") {
    return <p className="text-center text-sm text-gray-400 py-6">Cargando...</p>
  }

  if (view === "choose") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-700">
          <strong>Ese celular ya se anotó antes.</strong> ¿Quién se está anotando ahora?
        </p>
        {choices.map((c) => (
          <button
            key={c.id}
            type="button"
            className={optionClass}
            disabled={loading}
            onClick={() => post({ full_name: name, phone, person_id: c.id, is_inferiores: isInferiores })}
          >
            Soy «{c.name}»
          </button>
        ))}
        <button
          type="button"
          className={optionClass}
          disabled={loading}
          onClick={() => post({ full_name: name, phone, person_id: "new", is_inferiores: isInferiores })}
        >
          Es otra persona, con el mismo celular
        </button>
        {errorLine}
        <button type="button" className={linkClass} onClick={() => { setError(""); setView("form") }}>
          Volver
        </button>
      </div>
    )
  }

  if (view === "who") {
    return (
      <div className="space-y-3">
        <p className="text-sm text-gray-700">
          <strong>Desde este celular se anotó más de una persona.</strong> ¿Quién sos?
        </p>
        {people.map((p) => (
          <button
            key={p.id}
            type="button"
            className={optionClass}
            disabled={loading}
            onClick={() => (isUploadMode && p.attendee ? continueAs(p, phone) : select(p))}
          >
            «{p.name}»
          </button>
        ))}
        {!isUploadMode && (
          <button type="button" className={optionClass} onClick={() => { setName(""); setView("other") }}>
            Otra persona
          </button>
        )}
        {errorLine}
        {listLink}
      </div>
    )
  }

  if (view === "recognized" && selected) {
    const footer = (
      <div className="flex flex-col items-start gap-2 pt-1">
        {people.length > 1 && (
          <button type="button" className={linkClass} onClick={() => { setError(""); setView("who") }}>
            Cambiar de persona
          </button>
        )}
        <button type="button" className={linkClass} onClick={() => { setError(""); setName(""); setView("other") }}>
          Anotar a otra persona con este celular
        </button>
        <button
          type="button"
          className={linkClass}
          onClick={() => { setError(""); setName(""); setPhoneInput(""); setSelected(null); setView("form") }}
        >
          No soy «{selected.name}»
        </button>
        {listLink}
      </div>
    )

    if (selected.attendee) {
      return (
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            <strong>Ya estás anotado</strong> como «{selected.attendee.full_name}».
          </p>
          {errorLine}
          <Button
            type="button"
            className="w-full h-12 bg-green-600 hover:bg-green-700"
            disabled={loading}
            onClick={() => continueAs(selected, phone)}
          >
            {loading ? "Cargando..." : "Ver datos de pago"}
          </Button>
          {footer}
        </div>
      )
    }

    return (
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          post({ full_name: name, phone, person_id: selected.id, is_inferiores: isInferiores })
        }}
      >
        <p className="text-sm text-gray-700">
          <strong>Hola de nuevo 👋</strong> La última vez figuraste como «{selected.name}». Podés cambiar el nombre si querés.
        </p>
        <div className="space-y-2">
          <Label htmlFor="name">Tu nombre</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
        </div>
        {inferioresCheckbox}
        {errorLine}
        <Button type="submit" className="w-full h-12 bg-green-600 hover:bg-green-700" disabled={loading}>
          {loading ? "Cargando..." : "Confirmar asistencia"}
        </Button>
        {footer}
      </form>
    )
  }

  if (view === "other") {
    return (
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          post({ full_name: name, phone, person_id: "new", is_inferiores: isInferiores })
        }}
      >
        <p className="text-sm text-gray-700">
          Vas a anotar a <strong>otra persona</strong> con el celular {formatPhone(phone)}.
        </p>
        <div className="space-y-2">
          <Label htmlFor="name">Su nombre</Label>
          <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Sofi" required autoFocus />
        </div>
        {inferioresCheckbox}
        {errorLine}
        <Button type="submit" className="w-full h-12 bg-green-600 hover:bg-green-700" disabled={loading}>
          {loading ? "Cargando..." : "Confirmar asistencia"}
        </Button>
        <button type="button" className={linkClass} onClick={backToStart}>
          Volver
        </button>
      </form>
    )
  }

  if (view === "list") {
    return (
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault()
          post({ full_name: listName })
        }}
      >
        {notice && <p className="text-sm text-gray-700">{notice}</p>}
        {unpaidNames.length > 0 ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="list-name">Nombre</Label>
              <select id="list-name" value={listName} onChange={(e) => setListName(e.target.value)} required className={selectClass}>
                <option value="">— Seleccioná el nombre —</option>
                {unpaidNames.map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            {errorLine}
            <Button type="submit" className="w-full h-12 bg-green-600 hover:bg-green-700" disabled={loading || !listName}>
              {loading ? "Cargando..." : "Continuar"}
            </Button>
          </>
        ) : (
          <p className="text-sm text-gray-500">No hay nadie pendiente de pago en este evento.</p>
        )}
        <button type="button" className={linkClass} onClick={backToStart}>
          Volver
        </button>
      </form>
    )
  }

  if (view === "phone") {
    return (
      <form className="space-y-4" onSubmit={handlePhoneOnly}>
        <div className="space-y-2">
          <Label htmlFor="phone">Tu celular</Label>
          <Input
            id="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            value={phoneInput}
            onChange={(e) => setPhoneInput(e.target.value)}
            placeholder="Ej: 11 5555-1234"
            required
            autoFocus
          />
          <p className="text-xs text-gray-400">El mismo con el que te anotaste.</p>
        </div>
        {errorLine}
        <Button type="submit" className="w-full h-12 bg-green-600 hover:bg-green-700" disabled={loading}>
          {loading ? "Cargando..." : "Continuar"}
        </Button>
        {unpaidNames.length > 0 && (
          <button type="button" className={linkClass} onClick={() => { setError(""); setNotice(""); setView("list") }}>
            Elegir mi nombre de la lista
          </button>
        )}
      </form>
    )
  }

  // view === "form": primera vez en este teléfono
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault()
        post({ full_name: name, phone: phoneInput, is_inferiores: isInferiores })
      }}
    >
      <div className="space-y-2">
        <Label htmlFor="name">Tu nombre</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej: Juan Pérez"
          autoComplete="name"
          required
          autoFocus
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="phone">Tu celular</Label>
        <Input
          id="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={phoneInput}
          onChange={(e) => setPhoneInput(e.target.value)}
          placeholder="Ej: 11 5555-1234"
          required
        />
        <p className="text-xs text-gray-400">Solo lo ven los organizadores. Sirve para reconocerte la próxima vez.</p>
      </div>
      {inferioresCheckbox}
      {errorLine}
      <Button type="submit" className="w-full h-12 bg-green-600 hover:bg-green-700" disabled={loading}>
        {loading ? "Cargando..." : "Confirmar asistencia"}
      </Button>
      {listLink}
    </form>
  )
}
