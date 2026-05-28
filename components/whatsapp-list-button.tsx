"use client"

import { MessageCircleIcon } from "lucide-react"

function formatDate(date: Date | null) {
  if (!date) return ""
  const formatted = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(date))
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

export default function WhatsAppListButton({
  eventTitle,
  eventDate,
  attendees,
  publicLink,
}: {
  eventTitle: string
  eventDate: Date | null
  attendees: { full_name: string }[]
  publicLink: string
}) {
  function handleClick() {
    const lines: string[] = [
      `🏑🍖🥗 *${eventTitle}*`,
    ]

    if (eventDate) {
      lines.push(`📅 ${formatDate(eventDate)}`)
    }

    lines.push("")
    lines.push(`✅ *Confirmados (${attendees.length}):*`)

    attendees.forEach((a, i) => {
      lines.push(`${i + 1}. ${a.full_name}`)
    })

    lines.push("")
    lines.push(`👉 Anotate desde el link y compartí la lista actualizada desde ahí:`)
    lines.push(publicLink)

    const message = lines.join("\n")
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank")
  }

  if (attendees.length === 0) return null

  return (
    <button
      onClick={handleClick}
      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#25D366] hover:bg-[#20BD5A] active:bg-[#1DA851] text-white font-medium text-sm rounded-xl transition-colors"
    >
      <MessageCircleIcon className="w-4 h-4" />
      Enviar lista por WhatsApp
    </button>
  )
}
