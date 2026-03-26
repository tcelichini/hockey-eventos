import { ArrowRightLeft } from "lucide-react"

type ExpenseData = { responsible: string; amount: string }
type AttendeeData = { full_name: string }

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", minimumFractionDigits: 0 }).format(amount)
}

function normalize(name: string) {
  return name.trim().toLowerCase()
}

function calculateSettlement(expenses: ExpenseData[], attendees: AttendeeData[]) {
  // Build set of all participants (confirmed attendees + anyone who paid an expense)
  const participantMap = new Map<string, string>() // normalized -> display name

  for (const a of attendees) {
    participantMap.set(normalize(a.full_name), a.full_name)
  }
  for (const e of expenses) {
    const key = normalize(e.responsible)
    if (!participantMap.has(key)) {
      participantMap.set(key, e.responsible)
    }
  }

  const participantCount = participantMap.size
  if (participantCount === 0) return null

  // Calculate total and per-person share
  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
  const perPerson = total / participantCount

  // Calculate how much each person paid
  const paid = new Map<string, number>()
  participantMap.forEach((_, key) => {
    paid.set(key, 0)
  })
  for (const e of expenses) {
    const key = normalize(e.responsible)
    paid.set(key, (paid.get(key) || 0) + Number(e.amount))
  }

  // Calculate balances (positive = overpaid, negative = underpaid)
  const balances: { name: string; paid: number; balance: number }[] = []
  participantMap.forEach((displayName, key) => {
    const paidAmount = paid.get(key) || 0
    balances.push({ name: displayName, paid: paidAmount, balance: paidAmount - perPerson })
  })
  balances.sort((a, b) => b.balance - a.balance) // creditors first

  // Only show people who actually paid something (bought stuff)
  const buyers = balances.filter(b => b.paid > 0)

  return { total, perPerson, buyers, participantCount }
}

export default function ExpenseSettlement({ expenses, attendees }: { expenses: ExpenseData[]; attendees: AttendeeData[] }) {
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
                <span className="font-medium text-gray-700">{b.name}</span>
                <span className="font-semibold text-[#00A651]">{formatCurrency(b.paid)}</span>
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  )
}
