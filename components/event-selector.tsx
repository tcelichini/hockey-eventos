"use client"

import { useState, useEffect } from "react"

type EventOption = {
  id: string
  title: string
  date: string
}

type Props = {
  value: string[]
  onChange: (ids: string[]) => void
}

function formatDate(date: string) {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(date))
}

export default function EventSelector({ value, onChange }: Props) {
  const [events, setEvents] = useState<EventOption[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/events")
      .then((r) => r.json())
      .then((data) => {
        // API returns all events; we show upcoming ones
        const upcoming = (data as EventOption[])
          .filter((e) => new Date(e.date) >= new Date())
          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        setEvents(upcoming)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  function toggle(id: string) {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id))
    } else {
      onChange([...value, id])
    }
  }

  if (loading) return <p className="text-sm text-gray-400">Cargando eventos...</p>
  if (events.length === 0) return <p className="text-sm text-gray-400">No hay eventos proximos</p>

  return (
    <div className="space-y-2">
      {events.map((event) => (
        <label
          key={event.id}
          className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
            value.includes(event.id)
              ? "border-blue-500 bg-blue-50"
              : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <input
            type="checkbox"
            checked={value.includes(event.id)}
            onChange={() => toggle(event.id)}
            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          <div>
            <p className="text-sm font-medium text-gray-900">{event.title}</p>
            <p className="text-xs text-gray-500 capitalize">{formatDate(event.date)}</p>
          </div>
        </label>
      ))}
    </div>
  )
}
