"use client"

import { Button } from "@/components/ui/button"
import { MessageCircleIcon } from "lucide-react"

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(value)
}

export default function WhatsAppCuentasButton({
  debtors,
  publicLink,
}: {
  debtors: { name: string; amount: number }[]
  publicLink: string
}) {
  if (debtors.length === 0) return null

  function handleClick() {
    const total = debtors.reduce((sum, d) => sum + d.amount, 0)
    const lines = [
      "📢 *Cuenta corriente* - Recordatorio de pago",
      "",
      `Deben pagar (${debtors.length}):`,
      ...debtors.map((d) => `• ${d.name} - ${formatCurrency(d.amount)}`),
      "",
      `💰 Total pendiente: *${formatCurrency(total)}*`,
      "",
      "👉 Elegí tu nombre, mirá qué eventos debés y subí el comprobante de cada uno acá:",
      publicLink,
    ]
    const message = lines.join("\n")
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank")
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      className="w-full text-green-600 border-green-200 hover:bg-green-50 hover:text-green-700"
    >
      <MessageCircleIcon className="w-4 h-4 mr-2" />
      Enviar recordatorio por WhatsApp
    </Button>
  )
}
