import { db } from "@/db"
import { events, attendees as attendeesTable, expenses } from "@/db/schema"
import { eq, and } from "drizzle-orm"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeftIcon } from "lucide-react"
import ExpenseSettlement from "@/components/expense-settlement"

export default async function ResumenPage({ params }: { params: { slug: string } }) {
  const [event] = await db.select().from(events).where(eq(events.slug, params.slug)).limit(1)
  if (!event) notFound()

  const confirmedAttendees = await db
    .select({ full_name: attendeesTable.full_name, price_paid: attendeesTable.price_paid })
    .from(attendeesTable)
    .where(and(eq(attendeesTable.event_id, event.id), eq(attendeesTable.status, "confirmed")))

  const expenseList = await db
    .select()
    .from(expenses)
    .where(eq(expenses.event_id, event.id))
    .orderBy(expenses.created_at)

  return (
    <div className="min-h-screen bg-[#001435]">
      <div className="max-w-md mx-auto">

        {/* Header */}
        <div className="px-4 pt-5 pb-3 flex items-center gap-3">
          <Link href={`/e/${event.slug}`} className="text-white/60 hover:text-white transition-colors">
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-white font-bold text-base leading-tight">{event.title}</h1>
            <p className="text-white/40 text-xs">Resumen de saldos</p>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white mx-3 rounded-2xl px-5 py-5">
          {expenseList.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <p className="text-4xl">📭</p>
              <p className="text-gray-500 text-sm">No hay gastos cargados todavía.</p>
              <Link href={`/e/${event.slug}`} className="text-xs text-[#002060] underline">
                Volver al evento
              </Link>
            </div>
          ) : (
            <ExpenseSettlement
              expenses={expenseList.map(e => ({ responsible: e.responsible, amount: e.amount! }))}
              attendees={confirmedAttendees}
              paymentAmount={Number(event.payment_amount)}
            />
          )}
        </div>

        {/* Footer branding */}
        <div className="mx-3 mt-0 rounded-b-2xl bg-[#002060] px-5 py-3 flex items-center justify-center gap-2">
          <div className="w-5 h-5 bg-[#00A651] rounded-full flex items-center justify-center">
            <span className="text-white text-[9px] font-black">SM</span>
          </div>
          <p className="text-white/50 text-xs">San Martín · Plantel Superior</p>
        </div>

      </div>
    </div>
  )
}
