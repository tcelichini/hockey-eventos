"use client"

import { MessageCircleIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(value)
}

function formatDate(date: Date | null) {
  if (!date) return ""
  const formatted = new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date))
  return formatted.charAt(0).toUpperCase() + formatted.slice(1)
}

export default function WhatsAppInviteButton({
  eventTitle,
  eventDate,
  publicLink,
  maxCapacity,
  confirmedCount,
  paymentAmount,
  pricingTiers,
}: {
  eventTitle: string
  eventDate: Date | null
  publicLink: string
  maxCapacity: number | null
  confirmedCount: number
  paymentAmount: number
  pricingTiers: { upTo: number | null; price: number }[] | null
}) {
  function handleClick() {
    const lines: string[] = [
      `🏑 *${eventTitle}*`,
      "",
    ]

    if (eventDate) {
      lines.push(`📅 ${formatDate(eventDate)}`)
    }

    if (pricingTiers && pricingTiers.length > 0) {
      const sorted = [...pricingTiers].sort((a, b) => (a.upTo ?? Infinity) - (b.upTo ?? Infinity))
      lines.push(`💰 Precios:`)
      for (const tier of sorted) {
        lines.push(`  • ${tier.upTo ? `Primeros ${tier.upTo}` : "Resto"}: ${formatCurrency(tier.price)}`)
      }
    } else if (paymentAmount > 0) {
      lines.push(`💰 ${formatCurrency(paymentAmount)}`)
    }

    if (maxCapacity) {
      const remaining = maxCapacity - confirmedCount
      if (remaining > 0) {
        lines.push(`📢 ¡Quedan ${remaining} lugares!`)
      } else {
        lines.push(`⚠️ Cupo completo`)
      }
    }

    lines.push("", `✅ Anotate acá:`, publicLink)

    const message = lines.join("\n")
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank")
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="mt-3 w-full text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
      onClick={handleClick}
    >
      <MessageCircleIcon className="w-4 h-4 mr-2" />
      Enviar convocatoria por WhatsApp
    </Button>
  )
}
