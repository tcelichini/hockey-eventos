"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PlusIcon, TrashIcon } from "lucide-react"
import type { PricingTier } from "@/db/schema"

interface PricingTiersEditorProps {
  value: PricingTier[] | null
  onChange: (tiers: PricingTier[] | null) => void
}

export default function PricingTiersEditor({ value, onChange }: PricingTiersEditorProps) {
  const [enabled, setEnabled] = useState(!!value && value.length > 0)

  function handleToggle(checked: boolean) {
    setEnabled(checked)
    if (checked) {
      onChange([
        { upTo: 20, price: 0 },
        { upTo: null, price: 0 },
      ])
    } else {
      onChange(null)
    }
  }

  function updateTier(index: number, field: "upTo" | "price", val: string) {
    if (!value) return
    const updated = [...value]
    if (field === "upTo") {
      updated[index] = { ...updated[index], upTo: val ? parseInt(val) : null }
    } else {
      updated[index] = { ...updated[index], price: val ? parseFloat(val) : 0 }
    }
    onChange(updated)
  }

  function addTier() {
    if (!value) return
    const numbered = value.filter((t) => t.upTo !== null)
    const lastUpTo = numbered.length > 0 ? Math.max(...numbered.map((t) => t.upTo!)) : 0
    const newTier: PricingTier = { upTo: lastUpTo + 10, price: 0 }
    // Insert before the catch-all (last) tier
    const catchAllIndex = value.findIndex((t) => t.upTo === null)
    const updated = [...value]
    updated.splice(catchAllIndex, 0, newTier)
    onChange(updated)
  }

  function removeTier(index: number) {
    if (!value || value.length <= 2) return
    // Don't allow removing the catch-all tier
    if (value[index].upTo === null) return
    onChange(value.filter((_, i) => i !== index))
  }

  if (!enabled) {
    return (
      <label className="flex items-center gap-2 py-2 cursor-pointer">
        <input type="checkbox" checked={false} onChange={(e) => handleToggle(e.target.checked)} className="rounded" />
        <span className="text-sm text-gray-500">Usar precios por tramo</span>
      </label>
    )
  }

  const tiers = value || []
  const sorted = [...tiers].sort((a, b) => {
    if (a.upTo === null) return 1
    if (b.upTo === null) return -1
    return a.upTo - b.upTo
  })

  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" checked={true} onChange={(e) => handleToggle(e.target.checked)} className="rounded" />
        <span className="text-sm font-medium">Precios por tramo</span>
      </label>

      <div className="space-y-2 pl-1">
        {sorted.map((tier, sortedIdx) => {
          const realIdx = tiers.indexOf(tier)
          const isCatchAll = tier.upTo === null

          return (
            <div key={realIdx} className="flex items-center gap-2">
              {isCatchAll ? (
                <div className="w-[140px] flex items-center">
                  <span className="text-sm text-gray-500 px-3">Resto</span>
                </div>
              ) : (
                <div className="w-[140px] flex items-center gap-1">
                  <span className="text-xs text-gray-400 shrink-0">Hasta</span>
                  <Input
                    type="number"
                    min="1"
                    value={tier.upTo ?? ""}
                    onChange={(e) => updateTier(realIdx, "upTo", e.target.value)}
                    className="h-8 text-sm"
                    placeholder="N"
                  />
                </div>
              )}
              <div className="flex items-center gap-1 flex-1">
                <span className="text-xs text-gray-400 shrink-0">$</span>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={tier.price || ""}
                  onChange={(e) => updateTier(realIdx, "price", e.target.value)}
                  className="h-8 text-sm"
                  placeholder="Precio"
                />
              </div>
              {!isCatchAll && tiers.length > 2 ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 text-gray-400 hover:text-red-500"
                  onClick={() => removeTier(realIdx)}
                >
                  <TrashIcon className="w-3.5 h-3.5" />
                </Button>
              ) : (
                <div className="w-8" />
              )}
            </div>
          )
        })}
      </div>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="text-xs"
        onClick={addTier}
      >
        <PlusIcon className="w-3.5 h-3.5 mr-1" />
        Agregar tramo
      </Button>
    </div>
  )
}
