"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { PencilIcon, Trash2Icon, CheckIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type Expense = {
  id: string
  description: string
  responsible: string
  amount: string
  notes: string | null
}

function formatCurrency(amount: string | number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(Number(amount))
}

function ExpenseRow({ expense }: { expense: Expense }) {
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [description, setDescription] = useState(expense.description)
  const [responsible, setResponsible] = useState(expense.responsible)
  const [amount, setAmount] = useState(expense.amount)
  const [notes, setNotes] = useState(expense.notes || "")
  const router = useRouter()

  async function handleSave() {
    setLoading(true)
    const res = await fetch(`/api/expenses/${expense.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ description, responsible, amount: parseFloat(amount), notes: notes || null }),
    })
    if (res.ok) {
      setEditing(false)
      router.refresh()
    }
    setLoading(false)
  }

  async function handleDelete() {
    setLoading(true)
    const res = await fetch(`/api/expenses/${expense.id}`, { method: "DELETE" })
    if (res.ok) {
      router.refresh()
    }
    setLoading(false)
  }

  if (editing) {
    return (
      <div className="py-3 space-y-2 border-b border-gray-100 last:border-0">
        <div className="grid grid-cols-2 gap-2">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descripción" className="text-sm h-8" />
          <Input value={responsible} onChange={(e) => setResponsible(e.target.value)} placeholder="Responsable" className="text-sm h-8" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" step="0.01" placeholder="Monto" className="text-sm h-8" />
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas (opcional)" className="text-sm h-8" />
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="h-7 text-xs px-3 bg-[#002060] hover:bg-[#001435]" onClick={handleSave} disabled={loading}>
            <CheckIcon className="w-3 h-3 mr-1" />
            {loading ? "..." : "Guardar"}
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs px-3" onClick={() => setEditing(false)} disabled={loading}>
            <XIcon className="w-3 h-3 mr-1" />
            Cancelar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-start justify-between gap-2 text-sm py-2 border-b border-gray-100 last:border-0 group">
      <div className="min-w-0">
        <span className="font-medium text-gray-700">{description}</span>
        <span className="text-gray-400"> · {responsible}</span>
        {notes && <span className="text-gray-400 text-xs"> ({notes})</span>}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <span className="font-medium text-gray-700">{formatCurrency(amount)}</span>
        <button
          onClick={() => setEditing(true)}
          className="ml-1 p-1 rounded text-gray-300 hover:text-[#002060] hover:bg-gray-100 transition-colors"
          title="Editar"
        >
          <PencilIcon className="w-3.5 h-3.5" />
        </button>
        {confirming ? (
          <>
            <button
              onClick={handleDelete}
              disabled={loading}
              className="p-1 rounded text-red-500 hover:bg-red-50 transition-colors text-xs font-medium"
            >
              {loading ? "..." : "Sí"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="p-1 rounded text-gray-400 hover:bg-gray-100 transition-colors text-xs"
            >
              No
            </button>
          </>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="p-1 rounded text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
            title="Eliminar"
          >
            <Trash2Icon className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

export default function PublicExpenseList({ expenses }: { expenses: Expense[] }) {
  if (expenses.length === 0) return null

  return (
    <div className="space-y-0">
      {expenses.map((expense) => (
        <ExpenseRow key={expense.id} expense={expense} />
      ))}
    </div>
  )
}
