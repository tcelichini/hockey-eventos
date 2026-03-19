"use client"

import { useState } from "react"
import { ChevronDownIcon } from "lucide-react"

export default function CollapsibleSection({
  icon,
  title,
  badge,
  defaultOpen = false,
  children,
}: {
  icon: React.ReactNode
  title: string
  badge?: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="bg-white mx-3 px-5 py-5 space-y-3 border-t border-gray-100">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full text-left"
      >
        {icon}
        <h3 className="font-bold text-[#002060] text-sm">{title}</h3>
        {badge && <span className="ml-auto mr-2">{badge}</span>}
        <ChevronDownIcon
          className={`w-4 h-4 text-gray-400 transition-transform duration-200 shrink-0 ${open ? "" : "-rotate-90"} ${badge ? "" : "ml-auto"}`}
        />
      </button>
      {open && <div>{children}</div>}
    </div>
  )
}
