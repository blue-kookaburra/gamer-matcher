'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Logo from '@/app/components/Logo'

export default function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)
  const router = useRouter()
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [joining, setJoining] = useState(false)
  const [waiting, setWaiting] = useState(false)
  const [sessionId, setSessionId] = useState<string | null>(null)

  // Once joined, subscribe to session status changes so we navigate when host starts
  useEffect(() => {
    if (!sessionId) return

    const supabase = createClient()

    const channel = supabase
      .channel(`session-status:${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` },
        payload => {
          if (payload.new.status === 'voting') {
            router.push(`/sessions/${sessionId}/vote`)
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [sessionId, router])

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault()
    setJoining(true)
    setError('')

    // Sign in anonymously so the guest has a real auth.uid() for RLS
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInAnonymously()
    if (authError) {
      // Non-fatal: proceed without an auth session (voting RLS may still work via participantId)
      console.warn('Anonymous sign-in unavailable:', authError.message)
    }

    const res = await fetch('/api/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: code.toUpperCase(), name }),
    })

    const data = await res.json()

    if (!res.ok) {
      setError(data.error)
      setJoining(false)
      return
    }

    // Store participantId in localStorage so we can submit votes later (no account needed)
    localStorage.setItem('participantId', data.participantId)
    localStorage.setItem('participantName', name)

    setSessionId(data.sessionId)
    setWaiting(true)
    setJoining(false)
  }

  if (waiting) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center px-4 text-center">
        <div className="text-5xl mb-6 animate-pulse">🎲</div>
        <h1 className="font-display text-2xl font-bold mb-2">You&apos;re in!</h1>
        <p className="text-gray-500">Waiting for the host to start the session...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        <div className="flex justify-center mb-6"><Logo className="h-[120px]" /></div>
        <p className="text-gray-400 text-sm mb-1">Joining session</p>
        <p className="font-display font-black text-4xl text-indigo-400 tracking-widest mb-1">{code.toUpperCase()}</p>
        <p className="text-gray-500 text-sm mb-8">Enter your name to join</p>

        <form onSubmit={handleJoin} className="space-y-4">
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Your name"
            required
            maxLength={30}
            className="w-full px-4 py-3 rounded-xl bg-gray-900 text-white border border-white/8 focus:outline-none focus:border-indigo-500 text-lg text-center transition-colors"
          />

          {error && <p className="text-red-400 text-sm text-center">{error}</p>}

          <button
            type="submit"
            disabled={joining || !name.trim()}
            className="w-full py-3 rounded-xl font-semibold text-lg btn-gradient"
          >
            {joining ? 'Joining...' : 'Join Game Night'}
          </button>
        </form>
      </div>
    </div>
  )
}
