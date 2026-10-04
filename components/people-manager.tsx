"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PencilIcon, PlusIcon, UploadIcon } from "lucide-react"
import { formatPhone, personLabel, type ImportPlanRow } from "@/lib/people"
import { normalizeName } from "@/lib/settlement"
import type { DirectoryPerson } from "@/lib/people-db"

type Filter = "all" | "A" | "B" | "external" | "unnamed"

const FILTERS: { value: Filter; label: string; matches: (p: DirectoryPerson) => boolean }[] = [
  { value: "all", label: "Todas", matches: () => true },
  { value: "A", label: "Plantel A", matches: (p) => p.team === "A" },
  { value: "B", label: "Plantel B", matches: (p) => p.team === "B" },
  { value: "external", label: "Externos", matches: (p) => !p.team },
  { value: "unnamed", label: "Sin nombre real", matches: (p) => !p.realName },
]

const selectClass = "text-sm rounded-md border border-input bg-background px-3 py-2 w-full"

function phonesText(person: DirectoryPerson) {
  return person.phones.length > 0 ? person.phones.map(formatPhone).join(" / ") : "sin celular"
}

/** Sección Personas del admin: listar, editar, fusionar, crear e importar (ver CONTEXT.md). */
export default function PeopleManager({ people }: { people: DirectoryPerson[] }) {
  const [filter, setFilter] = useState<Filter>("all")
  const [search, setSearch] = useState("")
  const [editingId, setEditingId] = useState<string | null>(null)
  const [panel, setPanel] = useState<"none" | "import" | "create">("none")

  // Personas que comparten un celular (alguien anotó a otro desde su teléfono, o un duplicado a fusionar)
  const sharedWith = (person: DirectoryPerson) =>
    people.filter((o) => o.id !== person.id && o.phones.some((ph) => person.phones.includes(ph)))

  const query = normalizeName(search)
  const visible = people
    .filter(FILTERS.find((f) => f.value === filter)!.matches)
    .filter((p) => {
      if (!query) return true
      const haystack = normalizeName([p.realName ?? "", ...p.names, ...p.phones].join(" "))
      return haystack.includes(query)
    })
    .sort((a, b) => {
      // Las que faltan revisar (sin nombre real) primero
      if (!a.realName !== !b.realName) return a.realName ? 1 : -1
      return personLabel(a).localeCompare(personLabel(b), "es")
    })

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={() => setPanel(panel === "import" ? "none" : "import")}>
          <UploadIcon className="w-4 h-4 mr-1" />
          Importar lista
        </Button>
        <Button size="sm" variant="outline" onClick={() => setPanel(panel === "create" ? "none" : "create")}>
          <PlusIcon className="w-4 h-4 mr-1" />
          Nueva persona
        </Button>
      </div>

      {panel === "import" && <ImportPanel onClose={() => setPanel("none")} />}
      {panel === "create" && <CreatePanel onClose={() => setPanel("none")} />}

      <div className="flex items-center gap-1.5 flex-wrap">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              filter === f.value ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {f.label} ({people.filter(f.matches).length})
          </button>
        ))}
      </div>

      <Input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar por nombre, apodo o celular"
        className="h-9 text-sm"
      />

      {visible.length === 0 ? (
        <p className="text-gray-400 text-sm text-center py-8">
          {people.length === 0 ? "Todavía no hay Personas. Importá la lista del plantel para empezar." : "Ninguna Persona con ese filtro."}
        </p>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100 px-4">
          {visible.map((person) =>
            editingId === person.id ? (
              <PersonEditor
                key={person.id}
                person={person}
                others={people.filter((o) => o.id !== person.id)}
                onClose={() => setEditingId(null)}
              />
            ) : (
              <div key={person.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-3">
                <div className="min-w-0">
                  <p className="font-medium text-gray-900">{personLabel(person)}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {phonesText(person)} · {person.eventCount} evento{person.eventCount !== 1 ? "s" : ""}
                  </p>
                  {person.names.length > 0 && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      Figuró como: {person.names.map((n) => `«${n}»`).join(", ")}
                    </p>
                  )}
                  {sharedWith(person).length > 0 && (
                    <p className="text-xs text-amber-600 mt-0.5">
                      Comparte celular con {sharedWith(person).map(personLabel).join(", ")}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {person.team ? (
                    <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Plantel {person.team}</Badge>
                  ) : (
                    <Badge variant="secondary">Externo</Badge>
                  )}
                  {!person.realName && (
                    <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">Sin nombre real</Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-gray-400 hover:text-gray-700"
                    onClick={() => setEditingId(person.id)}
                    title="Editar o fusionar"
                  >
                    <PencilIcon className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}

function PersonEditor({
  person,
  others,
  onClose,
}: {
  person: DirectoryPerson
  others: DirectoryPerson[]
  onClose: () => void
}) {
  const router = useRouter()
  const [realName, setRealName] = useState(person.realName ?? "")
  const [team, setTeam] = useState(person.team ?? "")
  const [phones, setPhones] = useState(person.phones.map(formatPhone).join(", "))
  const [mergeInto, setMergeInto] = useState("")
  const [confirming, setConfirming] = useState<"none" | "merge" | "delete">("none")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function call(url: string, method: string, body?: unknown) {
    setLoading(true)
    setError("")
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    if (res.ok) {
      onClose()
      router.refresh()
    } else {
      const err = await res.json().catch(() => ({}))
      setError(err.error || "No se pudo guardar")
      setConfirming("none")
    }
    setLoading(false)
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault()
    call(`/api/people/${person.id}`, "PATCH", {
      real_name: realName,
      team: team || null,
      phones: phones.split(/[,/]/).map((p) => p.trim()).filter(Boolean),
    })
  }

  const target = others.find((o) => o.id === mergeInto)
  const sortedOthers = [...others].sort((a, b) => personLabel(a).localeCompare(personLabel(b), "es"))

  return (
    <div className="py-3 space-y-3">
      <form onSubmit={handleSave} className="space-y-2">
        <p className="text-xs text-gray-400">
          {person.names.length > 0 ? `Figuró como: ${person.names.map((n) => `«${n}»`).join(", ")}` : "Todavía no se anotó a ningún evento"}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <Input
            value={realName}
            onChange={(e) => setRealName(e.target.value)}
            placeholder="Nombre real (Apellido, Nombre)"
            className="text-sm"
            disabled={loading}
          />
          <select value={team} onChange={(e) => setTeam(e.target.value)} className={selectClass} disabled={loading}>
            <option value="">Externo (ningún plantel)</option>
            <option value="A">Plantel A</option>
            <option value="B">Plantel B</option>
          </select>
        </div>
        <Input
          value={phones}
          onChange={(e) => setPhones(e.target.value)}
          placeholder="Celulares, separados por coma (ej: 11 5555-1234)"
          inputMode="tel"
          className="text-sm"
          disabled={loading}
        />
        <div className="flex items-center gap-2">
          <Button type="submit" size="sm" className="h-8 px-3 text-xs" disabled={loading}>
            {loading ? "..." : "Guardar"}
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-8 px-3 text-xs" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
        </div>
      </form>

      <div className="space-y-2 pt-3 border-t border-gray-100">
        <p className="text-xs text-gray-500">¿Es la misma persona que otra? Fusionalas: la otra se queda con los celulares y los eventos de las dos.</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={mergeInto}
            onChange={(e) => { setMergeInto(e.target.value); setConfirming("none") }}
            className={selectClass}
            disabled={loading}
          >
            <option value="">Es la misma persona que…</option>
            {sortedOthers.map((o) => (
              <option key={o.id} value={o.id}>
                {personLabel(o)} · {phonesText(o)}
              </option>
            ))}
          </select>
          {confirming !== "merge" && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-9 px-3 text-xs shrink-0"
              disabled={loading || !mergeInto}
              onClick={() => setConfirming("merge")}
            >
              Fusionar
            </Button>
          )}
        </div>
        {confirming === "merge" && target && (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs text-gray-700">
              {personLabel(person)} pasa a ser parte de {personLabel(target)}. No se puede deshacer.
            </p>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="h-7 text-xs px-2"
              disabled={loading}
              onClick={() => call(`/api/people/${person.id}/merge`, "POST", { into: target.id })}
            >
              {loading ? "..." : "Sí, fusionar"}
            </Button>
            <Button type="button" variant="ghost" size="sm" className="h-7 text-xs px-2" disabled={loading} onClick={() => setConfirming("none")}>
              No
            </Button>
          </div>
        )}
      </div>

      {person.eventCount === 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-gray-100">
          {confirming === "delete" ? (
            <>
              <p className="text-xs text-gray-700">¿Borrar a {personLabel(person)}?</p>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="h-7 text-xs px-2"
                disabled={loading}
                onClick={() => call(`/api/people/${person.id}`, "DELETE")}
              >
                {loading ? "..." : "Sí, borrar"}
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-7 text-xs px-2" disabled={loading} onClick={() => setConfirming("none")}>
                No
              </Button>
            </>
          ) : (
            <button type="button" className="text-xs text-red-500 hover:underline" onClick={() => setConfirming("delete")}>
              Borrar esta persona
            </button>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

function CreatePanel({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setLoading(true)
    setError("")
    const form = e.currentTarget
    const res = await fetch("/api/people", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        real_name: (form.elements.namedItem("real_name") as HTMLInputElement).value,
        team: (form.elements.namedItem("team") as HTMLSelectElement).value || null,
        phone: (form.elements.namedItem("phone") as HTMLInputElement).value || null,
      }),
    })
    if (res.ok) {
      onClose()
      router.refresh()
    } else {
      const err = await res.json().catch(() => ({}))
      setError(err.error || "No se pudo crear")
    }
    setLoading(false)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 bg-gray-50 rounded-xl p-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Input name="real_name" placeholder="Nombre real (Apellido, Nombre)" required className="text-sm" disabled={loading} />
        <select name="team" defaultValue="" className={selectClass} disabled={loading}>
          <option value="">Externo (ningún plantel)</option>
          <option value="A">Plantel A</option>
          <option value="B">Plantel B</option>
        </select>
      </div>
      <Input name="phone" placeholder="Celular (opcional)" inputMode="tel" className="text-sm" disabled={loading} />
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm" className="h-8 px-3 text-xs" disabled={loading}>
          {loading ? "..." : "Crear"}
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-8 px-3 text-xs" onClick={onClose} disabled={loading}>
          Cancelar
        </Button>
      </div>
    </form>
  )
}

const ACTION_LABEL: Record<ImportPlanRow["action"], { text: string; className: string }> = {
  create: { text: "Nueva", className: "text-green-600" },
  update: { text: "Se completa", className: "text-blue-600" },
  none: { text: "Sin cambios", className: "text-gray-400" },
  error: { text: "Error", className: "text-red-500" },
}

function ImportPanel({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [text, setText] = useState("")
  const [rows, setRows] = useState<ImportPlanRow[] | null>(null)
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function send(apply: boolean) {
    setLoading(true)
    setError("")
    const res = await fetch("/api/people/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, apply }),
    })
    const data = await res.json().catch(() => ({}))
    if (res.ok) {
      setRows(data.rows)
      setDone(apply)
      if (apply) router.refresh()
    } else {
      setError(data.error || "No se pudo importar")
    }
    setLoading(false)
  }

  const changes = rows ? rows.filter((r) => r.action === "create" || r.action === "update").length : 0
  const errors = rows ? rows.filter((r) => r.action === "error").length : 0

  return (
    <div className="space-y-3 bg-gray-50 rounded-xl p-4">
      <p className="text-xs text-gray-500">
        Una persona por línea: <span className="font-mono">Nombre real; Plantel; Celular</span>. Plantel es A, B o vacío (externo); el celular es opcional.
        Si ya existe una Persona con ese nombre real, se le completa lo que falte.
      </p>
      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); setRows(null); setDone(false) }}
        rows={6}
        placeholder={"Pérez, Juan;A;11 5555-1234\nGómez, Ana;;11 4444-0000"}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
        disabled={loading}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}

      {rows && (
        <div className="space-y-2">
          <p className="text-sm text-gray-700">
            {done
              ? `Listo: ${changes} Persona${changes !== 1 ? "s" : ""} creada${changes !== 1 ? "s" : ""} o completada${changes !== 1 ? "s" : ""}.`
              : `Vista previa: ${changes} cambio${changes !== 1 ? "s" : ""}`}
            {errors > 0 && <span className="text-red-500"> · {errors} con error (no se importan)</span>}
          </p>
          <div className="bg-white rounded-lg border border-gray-200 divide-y divide-gray-100 max-h-72 overflow-y-auto">
            {rows.map((row) => (
              <div key={row.line} className="px-3 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-0.5 sm:gap-3 text-sm">
                <div className="min-w-0">
                  <p className="text-gray-800">{row.realName || `(línea ${row.line})`}</p>
                  <p className="text-xs text-gray-400">
                    {row.team ? `Plantel ${row.team}` : "Externo"} · {row.phone ? formatPhone(row.phone) : "sin celular"}
                    {row.note && <span className="text-amber-600"> · {row.note}</span>}
                  </p>
                </div>
                <span className={`text-xs font-medium shrink-0 ${ACTION_LABEL[row.action].className}`}>
                  {row.action === "error" ? row.error : ACTION_LABEL[row.action].text}
                  {row.action === "update" && ` (${[row.addPhone && "celular", row.setTeam && "plantel"].filter(Boolean).join(" y ")})`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {!done && (
          <Button type="button" size="sm" variant="outline" className="h-8 px-3 text-xs" disabled={loading || !text.trim()} onClick={() => send(false)}>
            {loading && !rows ? "..." : "Vista previa"}
          </Button>
        )}
        {rows && !done && changes > 0 && (
          <Button type="button" size="sm" className="h-8 px-3 text-xs" disabled={loading} onClick={() => send(true)}>
            {loading ? "Importando..." : `Importar ${changes} cambio${changes !== 1 ? "s" : ""}`}
          </Button>
        )}
        <Button type="button" variant="ghost" size="sm" className="h-8 px-3 text-xs" onClick={onClose} disabled={loading}>
          {done ? "Cerrar" : "Cancelar"}
        </Button>
      </div>
    </div>
  )
}
