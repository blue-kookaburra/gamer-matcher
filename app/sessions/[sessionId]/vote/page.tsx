'use client'

import { useState, useEffect, useCallback, use } from 'react'
import { useRouter } from 'next/navigation'
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'

type SessionGame = {
  id: string       // UUID primary key of session_games row — used for vote submission
  gameId: string   // bgg_game_id — used for display/dedup
  title: string
  imageUrl: string
  minPlayers: number
  maxPlayers: number
  playTime: number
}

export default function VotePage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params)
  const router = useRouter()
  const [games, setGames] = useState<SessionGame[]>([])
  const [index, setIndex] = useState(0)
  const [participantId, setParticipantId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [waiting, setWaiting] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function init() {
      const supabase = createClient()

      // Resolve participant ID — host is authenticated, guests use localStorage
      const { data: { user } } = await supabase.auth.getUser()
      let pid: string | null = null

      if (user) {
        const { data: p } = await supabase
          .from('participants')
          .select('id')
          .eq('session_id', sessionId)
          .eq('user_id', user.id)
          .single()
        pid = p?.id ?? null
      } else {
        pid = localStorage.getItem('participantId')
      }

      setParticipantId(pid)

      // Load games for this session
      const { data } = await supabase
        .from('session_games')
        .select('id, bgg_game_id, title, image_url, min_players, max_players, play_time')
        .eq('session_id', sessionId)
        .order('display_order')

      setGames(
        (data ?? []).map(g => ({
          id: g.id,
          gameId: g.bgg_game_id,
          title: g.title,
          imageUrl: g.image_url ?? '',
          minPlayers: g.min_players ?? 1,
          maxPlayers: g.max_players ?? 99,
          playTime: g.play_time ?? 0,
        }))
      )

      setLoading(false)
    }

    init()
  }, [sessionId])

  // Subscribe to participant updates when in waiting state
  const startWaiting = useCallback(() => {
    setWaiting(true)
    const supabase = createClient()

    const channel = supabase
      .channel(`voting:${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'participants', filter: `session_id=eq.${sessionId}` },
        async () => {
          const { data } = await supabase
            .from('participants')
            .select('finished_at')
            .eq('session_id', sessionId)

          const allDone = data?.every(p => p.finished_at !== null)
          if (allDone) router.push(`/sessions/${sessionId}/results`)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [sessionId, router])

  async function submitVote(vote: 'yes' | 'maybe' | 'no') {
    if (submitting || !participantId || index >= games.length) return
    setSubmitting(true)

    const game = games[index]
    setIndex(prev => prev + 1)

    const res = await fetch(`/api/sessions/${sessionId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participantId, bggGameId: game.gameId, vote }),
    })

    const data = await res.json()
    setSubmitting(false)

    if (!res.ok) {
      setError(`Vote failed: ${data.error ?? 'unknown error'}`)
      return
    }

    if (data.allDone) {
      router.push(`/sessions/${sessionId}/results`)
    } else if (data.myDone) {
      startWaiting()
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-gray-400">Loading games...</p>
      </div>
    )
  }

  if (waiting) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center px-4 text-center">
        <div className="text-6xl mb-6 animate-pulse">⏳</div>
        <h1 className="text-2xl font-bold mb-2">All done!</h1>
        <p className="text-gray-400">Waiting for everyone else to finish voting...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center px-4 text-center gap-4">
        <p className="text-red-400">{error}</p>
        <button onClick={() => setError('')} className="px-4 py-2 bg-gray-700 rounded-lg text-sm">
          Try again
        </button>
      </div>
    )
  }

  if (index >= games.length) {
    // Briefly visible while the last API call is in-flight
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-gray-400">Finishing up...</p>
      </div>
    )
  }

  const game = games[index]
  const progress = Math.round((index / games.length) * 100)

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-between px-4 py-8">
      {/* Progress bar */}
      <div className="w-full max-w-sm">
        <div className="flex justify-between text-xs text-gray-400 mb-1">
          <span>{index} of {games.length}</span>
          <span>{progress}%</span>
        </div>
        <div className="w-full bg-gray-800 rounded-full h-1.5">
          <div
            className="bg-indigo-500 h-1.5 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Card stack */}
      <div className="flex-1 flex items-center justify-center w-full">
        <div className="relative w-full max-w-sm" style={{ height: '420px' }}>
          {/* Next card peeking behind */}
          {index + 1 < games.length && (
            <div className="absolute inset-0 bg-gray-800 rounded-2xl scale-95 translate-y-2 opacity-60" />
          )}

          {/* Current card */}
          <AnimatePresence mode="wait">
            <SwipeCard
              key={game.gameId}
              game={game}
              onVote={submitVote}
            />
          </AnimatePresence>
        </div>
      </div>

      {/* Vote buttons */}
      <div className="flex gap-6 items-center pb-4">
        <button
          onClick={() => submitVote('no')}
          disabled={submitting}
          className="w-16 h-16 rounded-full bg-red-600 hover:bg-red-700 disabled:opacity-50 flex items-center justify-center text-2xl shadow-lg transition-colors"
          title="No"
        >
          ✗
        </button>
        <button
          onClick={() => submitVote('maybe')}
          disabled={submitting}
          className="w-12 h-12 rounded-full bg-gray-600 hover:bg-gray-500 disabled:opacity-50 flex items-center justify-center text-xl shadow-lg transition-colors"
          title="Maybe"
        >
          ~
        </button>
        <button
          onClick={() => submitVote('yes')}
          disabled={submitting}
          className="w-16 h-16 rounded-full bg-green-600 hover:bg-green-700 disabled:opacity-50 flex items-center justify-center text-2xl shadow-lg transition-colors"
          title="Yes"
        >
          ✓
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
  const rotate = useTransform(x, [-150, 150], [-12, 12])
  const yesOpacity = useTransform(x, [30, 100], [0, 1])
  const noOpacity = useTransform(x, [-100, -30], [1, 0])

  function handleDragEnd(_: unknown, info: { offset: { x: number } }) {
    if (info.offset.x > 80) onVote('yes')
    else if (info.offset.x < -80) onVote('no')
  }

  return (
    <motion.div
      className="absolute inset-0 bg-gray-800 rounded-2xl overflow-hidden cursor-grab active:cursor-grabbing shadow-xl select-none"
      style={{ x, rotate }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.8}
      onDragEnd={handleDragEnd}
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.9, opacity: 0 }}
      transition={{ duration: 0.15 }}
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

      {/* Game image */}
      {game.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={game.imageUrl}
          alt={game.title}
          className="w-full h-56 object-contain bg-gray-900 pointer-events-none"
          draggable={false}
        />
      ) : (
        <div className="w-full h-56 bg-gray-900 flex items-center justify-center text-5xl">
          🎲
        </div>
      )}

      {/* Game info */}
      <div className="p-4">
        <h2 className="text-lg font-bold leading-tight mb-1">{game.title}</h2>
        <p className="text-gray-400 text-sm">
          {game.minPlayers}–{game.maxPlayers} players · {game.playTime} min
        </p>
      </div>

      {/* Swipe hint */}
      <p className="absolute bottom-3 right-4 text-xs text-gray-600">swipe or tap buttons</p>
    </motion.div>
  )
}
