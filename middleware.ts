import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { COOKIE_NAME, verifySession } from "@/lib/auth"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    const cookie = request.cookies.get(COOKIE_NAME)?.value
    if (!cookie || !(await verifySession(cookie))) {
      return NextResponse.redirect(new URL("/admin/login", request.url))
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/admin/:path*"],
}
