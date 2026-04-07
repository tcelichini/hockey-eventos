"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PlusIcon, TrashIcon } from "lucide-react"
import type { DateTier } from "@/db/schema"

type Props = {
  value: DateTier[] | null
  onChange: (tiers: DateTier[] | null) => void
}

const DEFAULT_TIERS: DateTier[] = [
  { until: "", price: 0 },
  { until: null, price: 0 },
]

export default function DateTiersEditor({ value, onChange }: Props) {
  const [tiers, setTiers] = useState<DateTier[]>(value ?? DEFAULT_TIERS)

  useEffect(() => {
    if (value) setTiers(value)
  }, [value])

  function update(updated: DateTier[]) {
    setTiers(updated)
    onChange(updated)
  }

  function addTier() {
    // Inserta un nuevo tramo con fecha antes del catch-all
    const withoutCatchAll = tiers.filter((t) => t.until !== null)
    const catchAll = tiers.find((t) => t.until === null) ?? { until: null, price: 0 }
    update([...withoutCatchAll, { until: "", price: 0 }, catchAll])
  }

  function removeTier(index: number) {
    const updated = tiers.filter((_, i) => i !== index)
    update(updated)
  }

  function updateTier(index: number, field: "until" | "price", val: string) {
    const updated = tiers.map((t, i) => {
      if (i !== index) return t
      if (field === "price") return { ...t, price: parseFloat(val) || 0 }
      return { ...t, until: val || null }
    })
    update(updated)
  }

  const numbered = tiers.filter((t) => t.until !== null)
  const catchAllIndex = tiers.findIndex((t) => t.until === null)

  return (
    <div className="space-y-3 bg-gray-50 rounded-xl p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700">Tramos por fecha de pago</p>
      </div>

      <p className="text-xs text-gray-400">
        El precio se aplica según la fecha en que el asistente realiza el pago. El último tramo ("Resto") aplica después de todas las fechas.
      </p>

      {/* Tramos con fecha */}
      <div className="space-y-2">
        {tiers.map((tier, i) => {
          const isCatchAll = tier.until === null
          return (
            <div key={i} className="flex items-center gap-2">
              <div className="flex-1">
                {isCatchAll ? (
                  <div className="h-9 flex items-center px-3 rounded-md border border-gray-200 bg-white text-sm text-gray-400">
                    Resto (después de todas las fechas)
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    <p className="text-xs text-gray-400">Paga hasta el</p>
                    <Input
                      type="date"
                      value={tier.until ?? ""}
                      onChange={(e) => updateTier(i, "until", e.target.value)}
                      className="h-9"
                    />
                  </div>
                )}
              </div>

              <div className="w-28">
                <p className="text-xs text-gray-400">Precio (ARS)</p>
                <Input
                  type="number"
                  min="0"
                  step="100"
                  value={tier.price || ""}
                  onChange={(e) => updateTier(i, "price", e.target.value)}
                  placeholder="0"
                  className="h-9"
                />
              </div>

              {!isCatchAll && (
                <button
                  type="button"
                  onClick={() => removeTier(i)}
                  className="mt-4 p-1.5 text-gray-300 hover:text-red-400 transition-colors"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              )}
              {isCatchAll && <div className="w-7" />}
            </div>
          )
        })}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addTier}
        className="w-full text-xs"
      >
        <PlusIcon className="w-3.5 h-3.5 mr-1" />
        Agregar tramo por fecha
      </Button>
    </div>
  )
}