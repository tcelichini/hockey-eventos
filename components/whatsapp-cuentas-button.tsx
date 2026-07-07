"use client"

import { Button } from "@/components/ui/button"
import { MessageCircleIcon } from "lucide-react"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(value)
}

export default function WhatsAppCuentasButton({
  debtors,
}: {
  debtors: { name: string; amount: number }[]
}) {
  if (debtors.length === 0) return null

  function handleClick() {
    const total = debtors.reduce((sum, d) => sum + d.amount, 0)
    const lines = [
      "💰 *Cuentas pendientes*",
      "",
      ...debtors.map((d) => `• ${d.name} - ${formatCurrency(d.amount)}`),
      "",
      `Total pendiente: *${formatCurrency(total)}*`,
    ]
    const message = lines.join("\n")
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank")
  }

  return (
    <Button variant="outline" size="sm" onClick={handleClick} className="text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700">
      <MessageCircleIcon className="w-4 h-4 mr-1" />
      Enviar por WhatsApp
    </Button>
  )
}
