"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export default function LoginPage() {
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError("")

    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    })

    if (res.ok) {
      router.push("/admin")
    } else {
      setError("Contraseña incorrecta")
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#001435] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-[#002060] border-4 border-[#00A651] rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <span className="text-white font-black text-2xl tracking-tight">SM</span>
          </div>
          <h1 className="text-white font-black text-3xl tracking-wide uppercase">San Martín</h1>
          <p className="text-[#00A651] text-sm font-semibold uppercase tracking-widest mt-1">Hockey · Plantel Superior</p>
        </div>

        {/* Form */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password" className="text-white/80 text-sm">
                Contraseña del panel admin
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoFocus
                className="bg-white/10 border-white/20 text-white placeholder:text-white/30 focus:border-[#00A651] focus:ring-[#00A651]"
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-[#00A651] hover:bg-[#009045] disabled:opacity-50 text-white font-bold rounded-lg transition-colors text-sm uppercase tracking-wide"
            >
              {loading ? "Entrando..." : "Ingresar"}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
