"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { PencilIcon, CheckIcon, XIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import ExpenseReceiptUpload from "@/components/expense-receipt-upload"
import DeleteExpenseButton from "@/components/delete-expense-button"

type ExpenseData = {
  id: string
  description: string
  responsible: string
  amount: string
  notes: string | null
  payment_alias: string | null
  receipt_url: string | null
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(value)
}

export default function ExpenseItem({ expense, attendeeNames }: { expense: ExpenseData; attendeeNames?: string[] }) {
  const isExternalInitially = attendeeNames ? !attendeeNames.some(n => n.trim().toLowerCase() === expense.responsible.trim().toLowerCase()) : false
  const [editing, setEditing] = useState(false)
  const [loading, setLoading] = useState(false)
  const [description, setDescription] = useState(expense.description)
  const [responsible, setResponsible] = useState(expense.responsible)
  const [amount, setAmount] = useState(expense.amount)
  const [notes, setNotes] = useState(expense.notes || "")
  const [paymentAlias, setPaymentAlias] = useState(expense.payment_alias || "")
  const [receiptUrl, setReceiptUrl] = useState<string | null>(expense.receipt_url)
  const [isExternal, setIsExternal] = useState(isExternalInitially)
  const router = useRouter()

  async function handleSave() {
    setLoading(true)
    const res = await fetch(`/api/expenses/${expense.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description,
        responsible,
        amount: parseFloat(amount),
        notes: notes || null,
        payment_alias: paymentAlias || null,
        receipt_url: receiptUrl,
      }),
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
    setPaymentAlias(expense.payment_alias || "")
    setReceiptUrl(expense.receipt_url)
    setEditing(false)
  }

  if (editing) {
    return (
      <div className="py-3">
        <div className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descripción" className="text-sm h-8" />
            {attendeeNames ? (
              isExternal ? (
                <div className="flex gap-1">
                  <Input value={responsible} onChange={(e) => setResponsible(e.target.value)} placeholder="Nombre de quien pagó" className="text-sm h-8 flex-1" />
                  <button
                    type="button"
                    onClick={() => { setIsExternal(false); setResponsible("") }}
                    className="text-xs text-gray-400 hover:text-gray-600 px-2 shrink-0"
                    title="Volver a lista de asistentes"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <select
                  value={responsible}
                  onChange={(e) => {
                    if (e.target.value === "__external__") {
                      setIsExternal(true)
                      setResponsible("")
                    } else {
                      setResponsible(e.target.value)
                    }
                  }}
                  className="text-sm h-8 rounded-md border border-input bg-background px-3 w-full"
                >
                  <option value="" disabled>Seleccioná quién pagó</option>
                  {attendeeNames.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                  <option value="__external__">Otra persona (no asistente)</option>
                </select>
              )
            ) : (
              <Input value={responsible} onChange={(e) => setResponsible(e.target.value)} placeholder="Responsable" className="text-sm h-8" />
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" step="0.01" placeholder="Monto" className="text-sm h-8" />
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notas" className="text-sm h-8" />
          </div>
          <Input value={paymentAlias} onChange={(e) => setPaymentAlias(e.target.value)} placeholder="Alias / CBU" className="text-sm h-8" />
          <ExpenseReceiptUpload url={receiptUrl} onChange={setReceiptUrl} />
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
      </div>
    )
  }

  return (
    <div className="py-3 space-y-1">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-medium text-gray-900">{expense.description}</span>
            <span className="font-medium text-gray-700 text-sm">{formatCurrency(Number(expense.amount))}</span>
          </div>
          <p className="text-xs text-gray-400 mt-0.5">
            {expense.responsible}
            {expense.notes && ` · ${expense.notes}`}
          </p>
          {expense.payment_alias && (
            <p className="text-xs text-blue-600 mt-0.5">
              Transferir a: <span className="font-mono">{expense.payment_alias}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {expense.receipt_url && (
            <a href={expense.receipt_url} target="_blank" rel="noopener noreferrer">
              <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 cursor-pointer text-xs">
                Comprobante
              </Badge>
            </a>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 text-gray-400 hover:text-blue-500 hover:bg-blue-50"
            onClick={() => setEditing(true)}
            title="Editar gasto"
          >
            <PencilIcon className="w-3.5 h-3.5" />
          </Button>
          <DeleteExpenseButton expenseId={expense.id} />
        </div>
      </div>
    </div>
  )
}
