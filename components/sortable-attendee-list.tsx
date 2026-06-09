"use client"

import { useState } from "react"
import { Badge } from "@/components/ui/badge"
import Link from "next/link"
import MarkPaidButton from "@/components/mark-paid-button"
import DeleteAttendeeButton from "@/components/delete-attendee-button"
import ToggleInferioresButton from "@/components/toggle-inferiores-button"
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"

type SortField = "name" | "confirmed" | "paid"
type SortDirection = "asc" | "desc"

export type AttendeeItem = {
  id: string
  full_name: string
  payment_status: string
  payment_proof_url: string | null
  combo_id: string | null
  price: number
  priceFormatted: string
  paidViaCombo: boolean
  createdAtISO: string | null
  createdAtFormatted: string | null
  proofUploadedAtISO: string | null
  proofUploadedAtFormatted: string | null
  isInferiores?: boolean
  coveredByExpenses?: boolean
}

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: "name", label: "Nombre" },
  { value: "confirmed", label: "Confirmación" },
  { value: "paid", label: "Pago" },
]

function sortAttendees(list: AttendeeItem[], field: SortField, dir: SortDirection): AttendeeItem[] {
  const sorted = [...list]
  const mult = dir === "asc" ? 1 : -1

  sorted.sort((a, b) => {
    switch (field) {
      case "name":
        return mult * a.full_name.localeCompare(b.full_name, "es")
      case "confirmed": {
        const ta = a.createdAtISO ? new Date(a.createdAtISO).getTime() : 0
        const tb = b.createdAtISO ? new Date(b.createdAtISO).getTime() : 0
        return mult * (ta - tb)
      }
      case "paid": {
        const pa = a.proofUploadedAtISO ? new Date(a.proofUploadedAtISO).getTime() : Infinity
        const pb = b.proofUploadedAtISO ? new Date(b.proofUploadedAtISO).getTime() : Infinity
        return mult * (pa - pb)
      }
    }
  })

  return sorted
}

export default function SortableAttendeeList({ attendees, hasInferioresPrice }: { attendees: AttendeeItem[]; hasInferioresPrice?: boolean }) {
  const [sortField, setSortField] = useState<SortField>("name")
  const [sortDir, setSortDir] = useState<SortDirection>("asc")

  const sorted = sortAttendees(attendees, sortField, sortDir)

  function handleFieldChange(field: SortField) {
    if (field === sortField) {
      setSortDir(d => d === "asc" ? "desc" : "asc")
    } else {
      setSortField(field)
      setSortDir("asc")
    }
  }

  const DirIcon = sortDir === "asc" ? ArrowUp : ArrowDown

  return (
    <div>
      <div className="flex items-center gap-1.5 pb-3 flex-wrap">
        <ArrowUpDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        {SORT_OPTIONS.map(opt => (
          <button
            key={opt.value}
            onClick={() => handleFieldChange(opt.value)}
            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              sortField === opt.value
                ? "bg-gray-900 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {opt.label}
            {sortField === opt.value && <DirIcon className="w-3 h-3" />}
          </button>
        ))}
      </div>

      <div className="divide-y">
        {sorted.map((attendee) => (
          <div key={attendee.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 sm:gap-3">
            <div className="min-w-0">
              <p className="font-medium text-gray-900">{attendee.full_name}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {attendee.priceFormatted}{attendee.paidViaCombo && <span className="text-purple-500"> (vía combo)</span>} · {attendee.createdAtFormatted}
                {attendee.proofUploadedAtFormatted && (
                  <> · <span className="text-green-600">Pagó {attendee.proofUploadedAtFormatted}</span></>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {hasInferioresPrice && (
                <ToggleInferioresButton attendeeId={attendee.id} isInferiores={!!attendee.isInferiores} />
              )}
              {attendee.paidViaCombo && attendee.combo_id && !attendee.coveredByExpenses && (
                <Link href={`/admin/combos/${attendee.combo_id}`}>
                  <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-200 cursor-pointer text-[10px]">
                    Combo
                  </Badge>
                </Link>
              )}
              {attendee.coveredByExpenses ? (
                <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
                  Gastó
                </Badge>
              ) : attendee.payment_proof_url ? (
                <a href={attendee.payment_proof_url} target="_blank" rel="noopener noreferrer">
                  <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200 cursor-pointer">
                    Comprobante
                  </Badge>
                </a>
              ) : null}
              {attendee.payment_status === "paid" ? (
                <>
                  <Badge className="bg-green-100 text-green-700 hover:bg-green-100">Pagó</Badge>
                  <MarkPaidButton attendeeId={attendee.id} isPaid={true} />
                </>
              ) : (
                <>
                  <Badge variant="secondary">Pendiente</Badge>
                  <MarkPaidButton attendeeId={attendee.id} isPaid={false} />
                </>
              )}
              <DeleteAttendeeButton attendeeId={attendee.id} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
