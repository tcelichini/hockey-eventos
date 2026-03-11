export const COOKIE_NAME = "admin_session"
const SESSION_VALUE = "admin:authenticated"

async function getKey(): Promise<CryptoKey> {
  const secret = process.env.ADMIN_SECRET || "fallback-dev-secret-change-in-prod"
  const keyData = new TextEncoder().encode(secret)
  return crypto.subtle.importKey("raw", keyData, { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"])
}

export async function signSession(): Promise<string> {
  const key = await getKey()
  const data = new TextEncoder().encode(SESSION_VALUE)
  const signature = await crypto.subtle.sign("HMAC", key, data)
  const hex = Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
  return `${SESSION_VALUE}.${hex}`
}

export async function verifySession(cookie: string): Promise<boolean> {
  try {
    const dotIndex = cookie.indexOf(".")
    if (dotIndex === -1) return false
    const value = cookie.slice(0, dotIndex)
    const hexSig = cookie.slice(dotIndex + 1)
    if (value !== SESSION_VALUE) return false

    const key = await getKey()
    const sigBytes = new Uint8Array(hexSig.match(/.{2}/g)!.map((b) => parseInt(b, 16)))
    const data = new TextEncoder().encode(SESSION_VALUE)
    return await crypto.subtle.verify("HMAC", key, sigBytes, data)
  } catch {
    return false
  }
}

export function checkAdminPassword(input: string): boolean {
  const password = (process.env.ADMIN_PASSWORD || "").trim()
  return input.trim() === password && password.length > 0
}
