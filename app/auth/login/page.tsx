'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      if (rememberMe) {
        localStorage.removeItem('no_persist')
      } else {
        localStorage.setItem('no_persist', '1')
        sessionStorage.setItem('session_active', '1')
      }
      // Force a full page reload so the server picks up the new session cookie
      window.location.href = '/dashboard'
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-sm">
        <p className="font-display text-xs font-semibold uppercase tracking-widest text-gray-500 text-center mb-2">Tabletop Tally</p>
        <h1 className="font-display text-3xl font-black text-white text-center mb-1">Welcome back</h1>
        <p className="text-gray-500 text-sm text-center mb-8">Sign in to your host account</p>

        <div className="bg-gray-900 border border-white/5 rounded-2xl p-6">
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-display font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-lg bg-gray-800 text-white border border-white/8 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-display font-semibold uppercase tracking-wider text-gray-500 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-lg bg-gray-800 text-white border border-white/8 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                className="w-4 h-4 accent-indigo-500"
              />
              <span className="text-sm text-gray-400">Remember me</span>
            </label>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 text-white font-semibold rounded-lg btn-gradient"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>

        <p className="text-center text-gray-500 mt-5 text-sm">
          No account?{' '}
          <Link href="/auth/signup" className="text-indigo-400 hover:text-indigo-300 transition-colors">Create one</Link>
        </p>
      </div>
    </div>
  )
}
