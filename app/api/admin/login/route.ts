import { NextRequest, NextResponse } from "next/server"
import { checkAdminPassword, signSession, COOKIE_NAME } from "@/lib/auth"

export async function POST(request: NextRequest) {
  const { password } = await request.json()

  if (!checkAdminPassword(password)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const sessionValue = await signSession()
  const response = NextResponse.json({ ok: true })
  response.cookies.set(COOKIE_NAME, sessionValue, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  })

  return response
}
