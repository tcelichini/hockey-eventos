export async function notifyAdminWhatsApp(message: string): Promise<void> {
  const phone = process.env.CALLMEBOT_PHONE
  const apikey = process.env.CALLMEBOT_APIKEY

  if (!phone || !apikey) return

  try {
    const url = `https://api.callmebot.com/whatsapp.php?phone=${encodeURIComponent(phone)}&text=${encodeURIComponent(message)}&apikey=${encodeURIComponent(apikey)}`
    await fetch(url, { signal: AbortSignal.timeout(5000) })
  } catch {
    console.error("WhatsApp notification failed (non-blocking)")
  }
}
