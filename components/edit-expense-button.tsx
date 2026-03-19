"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { PencilIcon, CheckIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

type ExpenseData = {
  id: string
  description: string
  responsible: string
  amount: string
  notes: string | null
}

export default function EditExpenseButton({ expense }: { expense: ExpenseData }) {
  const [editing, setEditing] = useState(false)
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

  function handleCancel() {
    setDescription(expense.description)
    setResponsible(expense.responsible)
    setAmount(expense.amount)
    setNotes(expense.notes || "")
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="space-y-2 w-full">
        <div className="grid grid-cols-2 gap-2">
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descripción" className="text-sm h-8" />
          <Input value={responsible} onChange={(e) => setResponsible(e.target.value)} placeholder="Responsable" className="text-sm h-8" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" step="0.01" placeholder="Monto" className="text-sm h-8" />
          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas" className="text-sm h-8" />
        </div>
        <div className="flex gap-1">
          <Button size="sm" className="h-7 text-xs px-2" onClick={handleSave} disabled={loading}>
            <CheckIcon className="w-3 h-3 mr-1" />
            {loading ? "..." : "Guardar"}
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={handleCancel} disabled={loading}>
            <XIcon className="w-3 h-3 mr-1" />
            Cancelar
          </Button>
        </div>
      </div>
    )
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 w-7 p-0 text-gray-400 hover:text-blue-500 hover:bg-blue-50"
      onClick={() => setEditing(true)}
      title="Editar gasto"
    >
      <PencilIcon className="w-3.5 h-3.5" />
    </Button>
  )
}
