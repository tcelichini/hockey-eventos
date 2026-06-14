"use client"

import { useState } from "react"
import { Input } from "@/components/ui/input"

export function parseCurrencyInput(raw: string): number {
  // "140.000" -> 140000 (dot = thousands separator in AR)
  // "140.000,50" -> 140000.50
  // "1500,50" -> 1500.50
  // "140000" -> 140000
  const cleaned = raw.replace(/\./g, "").replace(",", ".")
  const num = parseFloat(cleaned)
  return isNaN(num) ? 0 : num
}

function formatPreview(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

interface Props {
  name: string
  id?: string
  defaultValue?: string | number
  placeholder?: string
  required?: boolean
  className?: string
}

export default function CurrencyInput({ name, id, defaultValue, placeholder, required, className }: Props) {
  const initialNum = defaultValue ? Number(defaultValue) : 0
  const [display, setDisplay] = useState(initialNum ? String(initialNum) : "")
  const [numeric, setNumeric] = useState(initialNum)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    setDisplay(raw)
    setNumeric(parseCurrencyInput(raw))
  }

  return (
    <>
      <Input
        type="text"
        inputMode="numeric"
        id={id}
        name={name}
        value={display}
        onChange={handleChange}
        placeholder={placeholder}
        required={required}
        className={className}
      />
      {numeric > 0 && (
        <p className="text-xs text-green-600">
          = {formatPreview(numeric)}
        </p>
      )}
    </>
  )
}
