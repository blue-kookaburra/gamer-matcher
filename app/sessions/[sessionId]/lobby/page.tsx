'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { QRCodeSVG } from 'qrcode.react'

type Participant = { id: string; name: string; is_host: boolean }

export default function LobbyPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params)
  const router = useRouter()
  const [participants, setParticipants] = useState<Participant[]>([])
  const [joinUrl, setJoinUrl] = useState('')
  const [code, setCode] = useState('')
  const [starting, setStarting] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    async function init() {
      // Get the session code
      const { data: session } = await supabase
        .from('sessions')
        .select('code')
        .eq('id', sessionId)
        .single()

      if (session) {
        setCode(session.code)
        setJoinUrl(`${window.location.origin}/join/${session.code}`)
      }

      // Load current participants
      const { data } = await supabase
        .from('participants')
        .select('id, name, is_host')
        .eq('session_id', sessionId)
        .order('joined_at')

      setParticipants(data ?? [])

      // Subscribe to new participants joining in real time
      const channel = supabase
        .channel(`lobby:${sessionId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'participants', filter: `session_id=eq.${sessionId}` },
          payload => {
            setParticipants(prev => [...prev, payload.new as Participant])
          }
        )
        .subscribe()

      return () => { supabase.removeChannel(channel) }
    }

    init()
  }, [sessionId])

  async function handleStart() {
    setStarting(true)
    const res = await fetch(`/api/sessions/${sessionId}/start`, { method: 'POST' })
    if (res.ok) {
      router.push(`/sessions/${sessionId}/vote`)
    } else {
      setStarting(false)
    }
  }

  const guestCount = participants.filter(p => !p.is_host).length

  return (
    <div className="min-h-screen bg-gray-950 text-white px-4 py-8">
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-white transition-colors">
            ← Back to Dashboard
          </Link>
          <Link href="/profile" className="text-gray-500 hover:text-white transition-colors" title="Profile">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
          </Link>
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight mb-1">Game Night Lobby</h1>
        <p className="text-gray-500 text-sm mb-8">Share the QR code or join code with your friends.</p>

        {/* QR code */}
        {joinUrl && (
          <div className="bg-white rounded-2xl p-6 flex flex-col items-center mb-6 shadow-lg shadow-black/40">
            <QRCodeSVG value={joinUrl} size={200} />
            <p className="font-display text-gray-900 font-black text-3xl tracking-widest mt-5">{code}</p>
            <p className="text-gray-400 text-xs mt-1">{joinUrl}</p>
          </div>
        )}

        {/* Participants list */}
        <div className="bg-gray-900 border border-white/5 rounded-xl p-4 mb-6">
          <h2 className="font-display text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">
            Players — <span className="text-indigo-400">{participants.length}</span>
          </h2>
          <ul className="space-y-2">
            {participants.map(p => (
              <li key={p.id} className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 rounded-full bg-green-400 inline-block flex-shrink-0" />
                {p.name}
                {p.is_host && <span className="text-xs text-gray-600">(host)</span>}
              </li>
            ))}
          </ul>
          {guestCount === 0 && (
            <p className="text-gray-600 text-sm mt-2">Waiting for players to join...</p>
          )}
        </div>

        {/* Start button */}
        <button
          onClick={handleStart}
          disabled={starting || guestCount === 0}
          className="relative overflow-hidden w-full py-4 bg-green-600 hover:bg-green-700 disabled:opacity-40 rounded-xl font-display font-bold tracking-wide transition-colors"
        >
          <span className="relative z-10">
            {starting ? 'Starting...' : `Start Voting — ${participants.length} player${participants.length !== 1 ? 's' : ''}`}
          </span>
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-5xl text-white/10 pointer-events-none select-none leading-none">🎮</span>
        </button>
        {guestCount === 0 && (
          <p className="text-center text-gray-600 text-xs mt-2">Need at least 1 guest to start</p>
        )}
      </div>
    </div>
  )
}
