"use client"

import { useState } from "react"
import { ChevronDownIcon } from "lucide-react"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

export default function CollapsibleCard({
  title,
  defaultOpen = true,
  headerRight,
  children,
}: {
  title: string
  defaultOpen?: boolean
  headerRight?: React.ReactNode
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none"
        onClick={() => setOpen(!open)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ChevronDownIcon
              className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${open ? "" : "-rotate-90"}`}
            />
            <CardTitle className="text-base">{title}</CardTitle>
          </div>
          {headerRight && (
            <div onClick={(e) => e.stopPropagation()}>
              {headerRight}
            </div>
          )}
        </div>
      </CardHeader>
      {open && <CardContent>{children}</CardContent>}
    </Card>
  )
}
