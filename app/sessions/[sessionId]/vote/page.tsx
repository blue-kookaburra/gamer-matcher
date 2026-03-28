'use client'

import { useState, useEffect, useCallback, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import { motion, animate, useMotionValue, useTransform, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'

type SessionGame = {
  id: string
  gameId: string
  title: string
  imageUrl: string
  minPlayers: number
  maxPlayers: number
  playTime: number
  complexity: number
}

export default function VotePage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params)
  const router = useRouter()
  const [games, setGames] = useState<SessionGame[]>([])
  const [index, setIndex] = useState(0)
  const [participantId, setParticipantId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [waiting, setWaiting] = useState(false)
  const [error, setError] = useState('')
  const votingRef = useRef(false)

  useEffect(() => {
    async function init() {
      const supabase = createClient()

      const { data: { user } } = await supabase.auth.getUser()
      let pid: string | null = null

      if (user) {
        const { data: p } = await supabase
          .from('participants')
          .select('id')
          .eq('session_id', sessionId)
          .eq('user_id', user.id)
          .single()
        pid = p?.id ?? localStorage.getItem('participantId')
      } else {
        pid = localStorage.getItem('participantId')
      }

      setParticipantId(pid)

      const [{ data: sessionData }, { data: gamesData }] = await Promise.all([
        supabase.from('sessions').select('player_count').eq('id', sessionId).single(),
        supabase
          .from('session_games')
          .select('id, bgg_game_id, title, image_url, min_players, max_players, play_time, complexity')
          .eq('session_id', sessionId)
          .order('display_order'),
      ])

      const playerCount = sessionData?.player_count ?? 0

      const filtered = (gamesData ?? [])
        .filter(g => {
          if (playerCount === 0) return true
          return (g.min_players ?? 1) <= playerCount && (g.max_players ?? 99) >= playerCount
        })
        .map(g => ({
          id: g.id,
          gameId: g.bgg_game_id,
          title: g.title,
          imageUrl: g.image_url ?? '',
          minPlayers: g.min_players ?? 1,
          maxPlayers: g.max_players ?? 99,
          playTime: g.play_time ?? 0,
          complexity: g.complexity ?? 0,
        }))

      setGames(filtered)
      setLoading(false)
    }

    init()
  }, [sessionId])

  const startWaiting = useCallback(() => {
    setWaiting(true)
    const supabase = createClient()

    async function checkAndNavigate() {
      const { data } = await supabase
        .from('sessions')
        .select('status')
        .eq('id', sessionId)
        .single()
      if (data?.status === 'done') {
        router.push(`/sessions/${sessionId}/results`)
      }
    }

    const channel = supabase
      .channel(`session-done:${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` },
        payload => {
          if (payload.new.status === 'done') {
            router.push(`/sessions/${sessionId}/results`)
          }
        }
      )
      .subscribe(status => {
        // Catch-up: if session was already done before subscription was ready
        if (status === 'SUBSCRIBED') checkAndNavigate()
      })

    // Polling fallback — fires every 3 s in case realtime doesn't work
    const poll = setInterval(checkAndNavigate, 3000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(poll)
    }
  }, [sessionId, router])

  async function submitVote(vote: 'yes' | 'maybe' | 'no') {
    if (votingRef.current || !participantId || index >= games.length) return
    votingRef.current = true

    const game = games[index]
    setIndex(prev => prev + 1)
    votingRef.current = false

    try {
      const res = await fetch(`/api/sessions/${sessionId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ participantId, bggGameId: game.gameId, vote }),
      })

      const data = await res.json()
      if (!res.ok) { setError(`Vote failed: ${data.error ?? 'unknown error'}`); return }
      if (data.allDone) router.push(`/sessions/${sessionId}/results`)
      else if (data.myDone) startWaiting()
    } catch {
      // ignore mid-session network errors
    }
  }

  if (loading) {
    return (
      <div className="h-[100dvh] bg-gray-950 text-white flex items-center justify-center">
        <p className="text-gray-400">Loading games...</p>
      </div>
    )
  }

  if (waiting) {
    return (
      <div className="h-[100dvh] bg-gray-950 text-white flex flex-col items-center justify-center px-4 text-center">
        <div className="text-5xl mb-6 animate-pulse">⏳</div>
        <h1 className="font-display text-2xl font-bold mb-2">All done!</h1>
        <p className="text-gray-500">Waiting for everyone else to finish voting...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-[100dvh] bg-gray-950 text-white flex flex-col items-center justify-center px-4 text-center gap-4">
        <p className="text-red-400">{error}</p>
        <button onClick={() => setError('')} className="px-4 py-2 bg-gray-700 rounded-lg text-sm">
          Try again
        </button>
      </div>
    )
  }

  if (index >= games.length) {
    return (
      <div className="h-[100dvh] bg-gray-950 text-white flex items-center justify-center">
        <p className="text-gray-400">Finishing up...</p>
      </div>
    )
  }

  const game = games[index]
  const progress = Math.round((index / games.length) * 100)

  return (
    <div className="h-[100dvh] bg-gray-950 text-white flex flex-col items-center justify-between px-4 pt-4 pb-3">
      {/* Progress bar */}
      <div className="w-full max-w-sm flex-shrink-0">
        <div className="flex justify-between text-xs text-gray-500 mb-2">
          <span className="font-display font-semibold">{index} of {games.length}</span>
          <span>{progress}%</span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-1">
          <div
            className="h-1 rounded-full transition-all duration-300 btn-gradient"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Card stack */}
      <div className="flex-1 flex items-center justify-center w-full py-2 min-h-0">
        <div className="relative w-full max-w-sm">
          <AnimatePresence>
            <SwipeCard
              key={game.gameId}
              game={game}
              onVote={submitVote}
            />
          </AnimatePresence>
        </div>
      </div>

      {/* Vote buttons */}
      <div className="flex gap-2 w-full max-w-sm flex-shrink-0">
        <button
          onClick={() => submitVote('no')}
          className="relative flex-1 h-14 rounded-2xl bg-red-950/80 border border-red-900/60 flex items-center justify-center overflow-hidden transition-colors hover:bg-red-950"
          title="No"
        >
          <span className="relative z-10 text-red-300 font-display font-semibold text-sm tracking-wide">✗ No</span>
          <span className="absolute right-3 text-5xl text-red-500/8 leading-none pointer-events-none select-none">✗</span>
        </button>

        <button
          onClick={() => submitVote('maybe')}
          className="relative w-14 h-14 rounded-2xl bg-gray-800 border border-white/8 flex items-center justify-center overflow-hidden flex-shrink-0 transition-colors hover:bg-gray-700"
          title="Maybe"
        >
          <span className="relative z-10 text-gray-400 font-semibold text-base">~</span>
        </button>

        <button
          onClick={() => submitVote('yes')}
          className="relative flex-1 h-14 rounded-2xl bg-green-950/80 border border-green-900/60 flex items-center justify-center overflow-hidden transition-colors hover:bg-green-950"
          title="Yes"
        >
          <span className="relative z-10 text-green-300 font-display font-semibold text-sm tracking-wide">✓ Yes</span>
          <span className="absolute right-3 text-5xl text-green-500/8 leading-none pointer-events-none select-none">✓</span>
        </button>
      </div>
    </div>
  )
}

function SwipeCard({
  game,
  onVote,
}: {
  game: SessionGame
  onVote: (vote: 'yes' | 'maybe' | 'no') => void
}) {
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const rotate = useTransform(x, [-150, 150], [-12, 12])
  const yesOpacity = useTransform(x, [30, 100], [0, 1])
  const noOpacity = useTransform(x, [-100, -30], [1, 0])
  const maybeOpacity = useTransform(y, [-30, -100], [0, 1])
  function handleDragEnd(_: unknown, info: { offset: { x: number; y: number } }) {
    if (info.offset.y < -80) {
      animate(y, -600, { duration: 0.15 }).then(() => onVote('maybe'))
    } else if (info.offset.x > 80) {
      animate(x, 600, { duration: 0.15 }).then(() => onVote('yes'))
    } else if (info.offset.x < -80) {
      animate(x, -600, { duration: 0.15 }).then(() => onVote('no'))
    } else {
      // No threshold met — spring back to center manually
      animate(x, 0, { type: 'spring', stiffness: 300, damping: 25 })
      animate(y, 0, { type: 'spring', stiffness: 300, damping: 25 })
    }
  }

  return (
    <motion.div
      className="relative bg-gray-900 rounded-2xl overflow-hidden cursor-grab active:cursor-grabbing shadow-2xl shadow-black/60 select-none"
      style={{ x, y, rotate }}
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0 } }}
      transition={{ duration: 0.15 }}
      drag
      dragMomentum={false}
      onDragEnd={handleDragEnd}
    >
      {/* YES overlay */}
      <motion.div
        className="absolute inset-0 bg-green-500/30 z-10 flex items-start justify-end p-5 pointer-events-none"
        style={{ opacity: yesOpacity }}
      >
        <span className="text-green-300 font-black text-3xl border-2 border-green-400 rounded-lg px-3 py-1 rotate-[-12deg]">
          YES
        </span>
      </motion.div>

      {/* NO overlay */}
      <motion.div
        className="absolute inset-0 bg-red-500/30 z-10 flex items-start justify-start p-5 pointer-events-none"
        style={{ opacity: noOpacity }}
      >
        <span className="text-red-300 font-black text-3xl border-2 border-red-400 rounded-lg px-3 py-1 rotate-[12deg]">
          NOPE
        </span>
      </motion.div>

      {/* MAYBE overlay */}
      <motion.div
        className="absolute inset-0 bg-yellow-500/20 z-10 flex items-center justify-center pointer-events-none"
        style={{ opacity: maybeOpacity }}
      >
        <span className="text-yellow-200 font-black text-3xl border-2 border-yellow-400 rounded-lg px-3 py-1">
          MAYBE
        </span>
      </motion.div>

      {/* Game image with gradient fade into card */}
      <div className="relative w-full h-52 flex-shrink-0">
        {game.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={game.imageUrl}
            alt={game.title}
            className="w-full h-full object-cover pointer-events-none"
            draggable={false}
          />
        ) : (
          <div className="w-full h-full bg-gray-900 flex items-center justify-center text-5xl">
            🎲
          </div>
        )}
        {/* Gradient fade: image bleeds into card background */}
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-gray-900 pointer-events-none" />
      </div>

      {/* Title sits in the fade zone */}
      <div className="px-4 pb-5 -mt-10 relative z-10">
        <h2 className="text-2xl font-bold leading-tight mb-2">{game.title}</h2>
        <div className="flex gap-3">
          <span className="flex items-center gap-1 text-gray-300 text-sm">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
            {game.minPlayers}–{game.maxPlayers}
          </span>
          {game.playTime > 0 && (
            <span className="flex items-center gap-1 text-gray-300 text-sm">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
              {game.playTime}m
            </span>
          )}
          {game.complexity > 0 && (
            <span className="flex items-center gap-1 text-gray-400 text-sm">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29l-1.43-1.43z"/></svg>
              {game.complexity.toFixed(1)}
            </span>
          )}
        </div>
      </div>

      {/* Swipe hint */}
      <p className="absolute bottom-3 right-4 text-xs text-gray-600">swipe or tap buttons</p>
    </motion.div>
  )
}
