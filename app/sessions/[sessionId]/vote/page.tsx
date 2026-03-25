'use client'

import { useState, useEffect, useCallback, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import { motion, useMotionValue, useTransform, AnimatePresence } from 'framer-motion'
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
        pid = p?.id ?? null
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
      <div className="flex-1 flex items-center justify-center w-full py-6">
        <div className="relative w-full max-w-sm">
          {/* Next card peeking behind */}
          {index + 1 < games.length && (
            <div className="absolute inset-x-0 bottom-0 h-full bg-gray-800 rounded-2xl scale-95 translate-y-2 opacity-60" />
          )}

          <AnimatePresence>
            <SwipeCard
              key={game.gameId}
              game={game}
              onVote={submitVote}
            />
          </AnimatePresence>
        </div>
      </div>

      {/* Vote buttons — wider pills with ghost symbol */}
      <div className="flex gap-3 w-full max-w-sm pb-2">
        <button
          onClick={() => submitVote('no')}
          className="relative flex-1 h-14 rounded-2xl bg-red-950/80 border border-red-800/50 flex items-center justify-center overflow-hidden transition-colors hover:bg-red-950"
          title="No"
        >
          <span className="relative z-10 text-red-300 font-semibold text-sm tracking-wide">✗ No</span>
          <span className="absolute right-3 text-6xl text-red-500/10 leading-none pointer-events-none select-none">✗</span>
        </button>

        <button
          onClick={() => submitVote('maybe')}
          className="relative w-16 h-14 rounded-2xl bg-gray-800 border border-gray-700/50 flex items-center justify-center overflow-hidden flex-shrink-0 transition-colors hover:bg-gray-700"
          title="Maybe"
        >
          <span className="relative z-10 text-gray-300 font-semibold text-sm">~</span>
          <span className="absolute right-2 text-5xl text-gray-500/10 leading-none pointer-events-none select-none">~</span>
        </button>

        <button
          onClick={() => submitVote('yes')}
          className="relative flex-1 h-14 rounded-2xl bg-green-950/80 border border-green-800/50 flex items-center justify-center overflow-hidden transition-colors hover:bg-green-950"
          title="Yes"
        >
          <span className="relative z-10 text-green-300 font-semibold text-sm tracking-wide">✓ Yes</span>
          <span className="absolute right-3 text-6xl text-green-500/10 leading-none pointer-events-none select-none">✓</span>
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
      className="relative bg-gray-800 rounded-2xl overflow-hidden cursor-grab active:cursor-grabbing shadow-xl select-none"
      style={{ x, rotate }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.8}
      onDragEnd={handleDragEnd}
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
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-gray-800 pointer-events-none" />
      </div>

      {/* Title sits in the fade zone */}
      <div className="px-4 pb-5 -mt-10 relative z-10">
        <h2 className="font-serif italic text-2xl font-bold leading-tight mb-1">{game.title}</h2>
        <p className="text-gray-400 text-sm">
          {game.minPlayers}–{game.maxPlayers} players · {game.playTime} min
        </p>
        {game.complexity > 0 && (
          <p className="text-gray-500 text-xs mt-0.5">
            Complexity {game.complexity.toFixed(1)}/5
          </p>
        )}
      </div>

      {/* Swipe hint */}
      <p className="absolute bottom-3 right-4 text-xs text-gray-600">swipe or tap buttons</p>
    </motion.div>
  )
}
