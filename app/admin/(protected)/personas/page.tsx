import Link from "next/link"
import { ArrowLeftIcon } from "lucide-react"
import { getPeopleDirectory } from "@/lib/people-db"
import PeopleManager from "@/components/people-manager"

export default async function PersonasPage() {
  const people = await getPeopleDirectory()

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/admin" className="text-gray-400 hover:text-gray-600 transition">
          <ArrowLeftIcon className="w-5 h-5" />
        </Link>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Personas</h2>
          <p className="text-xs text-gray-400">
            Quién es quién en los eventos que piden celular. El celular y el nombre real solo se ven acá.
          </p>
        </div>
      </div>

      <PeopleManager people={people} />
    </div>
  )
}
