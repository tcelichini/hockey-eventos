import { ArrowRightLeft } from "lucide-react"

type ExpenseData = { responsible: string; amount: string }
type AttendeeData = { full_name: string; price_paid?: string | null }

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(amount)
}

function normalize(name: string) {
  return name.trim().toLowerCase()
}

function calculateSettlement(expenses: ExpenseData[], attendees: AttendeeData[]) {
  const attendeeKeys = new Set(attendees.map(a => normalize(a.full_name)))

  const participantCount = attendees.length
  if (participantCount === 0) return null

  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
  const perPerson = total / participantCount

  // Calculate how much each person paid
  const paid = new Map<string, number>()
  for (const e of expenses) {
    const key = normalize(e.responsible)
    paid.set(key, (paid.get(key) || 0) + Number(e.amount))
  }

  const buyers: { name: string; paid: number; isExternal: boolean }[] = []
  paid.forEach((paidAmount, key) => {
    if (paidAmount > 0) {
      const attendee = attendees.find(a => normalize(a.full_name) === key)
      const displayName = attendee?.full_name || expenses.find(e => normalize(e.responsible) === key)?.responsible || key
      buyers.push({ name: displayName, paid: paidAmount, isExternal: !attendeeKeys.has(key) })
    }
  })

  return { total, perPerson, buyers, participantCount }
}

export default function ExpenseSettlement({
  expenses,
  attendees,
}: {
  expenses: ExpenseData[]
  attendees: AttendeeData[]
  paymentAmount?: number
}) {
  const result = calculateSettlement(expenses, attendees)
  if (!result || result.total === 0) return null

  return (
    <div className="mt-4 border border-[#002060]/15 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-[#002060]/5 px-4 py-3 flex items-center gap-2">
        <ArrowRightLeft className="w-4 h-4 text-[#002060]" />
        <h4 className="font-bold text-[#002060] text-sm">Resumen de saldos</h4>
      </div>

      <div className="px-4 py-3 space-y-4">
        {/* Per-person share */}
        <div className="text-center py-2 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-400 uppercase tracking-wide">Cuota por persona</p>
          <p className="text-lg font-bold text-[#002060]">
            {formatCurrency(result.perPerson)}
          </p>
          <p className="text-xs text-gray-400">
            {formatCurrency(result.total)} ÷ {result.participantCount} personas
          </p>
        </div>

        {/* Buyers - who paid for what */}
        {result.buyers.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs text-gray-400 uppercase tracking-wide">Compraron</p>
            {result.buyers.map((b) => (
              <div key={b.name} className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700">
                  {b.name}
                  {b.isExternal && <span className="text-xs text-gray-400 font-normal ml-1">(no asistente)</span>}
                </span>
                <span className="font-semibold text-[#00A651]">{formatCurrency(b.paid)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
