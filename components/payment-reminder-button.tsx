"use client"

import { MessageCircleIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(value)
}

export default function PaymentReminderButton({
  unpaidList,
  eventTitle,
}: {
  unpaidList: { name: string; amount: number }[]
  eventTitle: string
}) {
  function handleClick() {
    const total = unpaidList.reduce((sum, a) => sum + a.amount, 0)
    const lines = unpaidList.map(a => `• ${a.name} - ${formatCurrency(a.amount)}`)

    const message = [
      `📢 *${eventTitle}* - Recordatorio de pago`,
      "",
      `Faltan pagar (${unpaidList.length}):`,
      ...lines,
      "",
      `💰 Total pendiente: *${formatCurrency(total)}*`,
    ].join("\n")

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
      Enviar recordatorio por WhatsApp
    </Button>
  )
}
