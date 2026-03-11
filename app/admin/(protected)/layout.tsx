import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { verifySession, COOKIE_NAME } from "@/lib/auth"
import LogoutButton from "@/components/logout-button"
import Link from "next/link"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const session = cookieStore.get(COOKIE_NAME)?.value

  if (!session || !(await verifySession(session))) {
    redirect("/admin/login")
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-[#002060] px-4 py-3 flex items-center justify-between shadow-md">
        <Link href="/admin" className="flex items-center gap-3">
          <div className="w-8 h-8 bg-[#00A651] rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0">
            SM
          </div>
          <div>
            <h1 className="font-bold text-white leading-tight tracking-wide">San Martín</h1>
            <p className="text-[#00A651] text-[11px] font-medium uppercase tracking-widest">Panel Admin · Hockey</p>
          </div>
        </Link>
        <LogoutButton />
      </header>
      <main className="max-w-4xl mx-auto px-4 py-6">{children}</main>
    </div>
  )
}
