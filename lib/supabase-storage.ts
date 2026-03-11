import { createClient } from "@supabase/supabase-js"

export function getStorageClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key)
}

export const BUCKET = "event-banners"

export function getPublicUrl(path: string): string {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  return `${url}/storage/v1/object/public/${BUCKET}/${path}`
}
