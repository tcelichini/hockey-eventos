import { db } from "@/db"
import { events, attendees } from "@/db/schema"
import { eq } from "drizzle-orm"
import { notFound } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"

async function recordDecline(eventId: string) {
  await db.insert(attendees).values({
    event_id: eventId,
    full_name: "Anónimo",
    status: "declined",
    payment_status: "pending",
  })
}

export default async function DeclinePage({ params }: { params: { slug: string } }) {
  const [event] = await db.select().from(events).where(eq(events.slug, params.slug)).limit(1)
  if (!event) notFound()

  await recordDecline(event.id)

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="max-w-sm mx-auto text-center space-y-4">
        <div className="text-6xl">👋</div>
        <h1 className="text-2xl font-bold text-gray-900">¡Gracias por avisar!</h1>
        <p className="text-gray-500">
          Anotamos que no podés ir al <strong>{event.title}</strong>. ¡Para la próxima!
        </p>
        <Link href={`/e/${event.slug}`}>
          <Button variant="outline" className="mt-4">
            Volver al evento
          </Button>
        </Link>
      </div>
    </div>
  )
}
