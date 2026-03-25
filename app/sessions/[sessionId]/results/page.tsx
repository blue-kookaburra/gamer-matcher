'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

type RankedGame = {
  gameId: string
  title: string
  imageUrl: string
  minPlayers: number
  maxPlayers: number
  playTime: number
  yesCount: number
  maybeCount: number
  noCount: number
}

export default function ResultsPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = use(params)
  const router = useRouter()
  const [games, setGames] = useState<RankedGame[]>([])
  const [loading, setLoading] = useState(true)
  const [isHost, setIsHost] = useState(false)
  const [revoting, setRevoting] = useState(false)

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/sessions/${sessionId}/results`)
      const data = await res.json()
      setGames(data.games ?? [])
      setLoading(false)
    }
    load()
  }, [sessionId])

  useEffect(() => {
    const supabase = createClient()

    async function checkHost() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: session } = await supabase
        .from('sessions')
        .select('host_id')
        .eq('id', sessionId)
        .single()
      setIsHost(session?.host_id === user.id)
    }
    checkHost()

    // All participants on this page redirect when the host triggers a re-vote
    const channel = supabase
      .channel(`revote:${sessionId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}` },
        payload => {
          if (payload.new.status === 'revoting') {
            router.push(`/sessions/${sessionId}/vote`)
          }
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [sessionId, router])

  async function handleRevote() {
    setRevoting(true)
    const winnerIds = winners.map(w => w.gameId)
    await fetch(`/api/sessions/${sessionId}/revote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gameIds: winnerIds }),
    })
    // Redirect is triggered by the realtime listener above for all participants
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-gray-400">Loading results...</p>
      </div>
    )
  }

  const topYes = games[0]?.yesCount ?? 0
  const topMaybe = games[0]?.maybeCount ?? 0
  const winners = games.filter(g => g.yesCount === topYes && g.maybeCount === topMaybe)
  const rest = games.filter(g => !(g.yesCount === topYes && g.maybeCount === topMaybe))

  return (
    <div className="min-h-screen bg-gray-950 text-white px-4 py-8">
      <div className="max-w-md mx-auto">
        <h1 className="font-display text-2xl font-bold text-center tracking-tight mb-1">Results</h1>
        <p className="text-gray-500 text-center text-sm mb-8">Ranked by yes votes</p>

        {/* Single winner */}
        {winners.length === 1 && (
          <div className="bg-indigo-950 border-2 border-indigo-500 rounded-2xl overflow-hidden mb-6">
            <div className="bg-indigo-600 text-center py-2 text-sm font-bold tracking-wide">
              🏆 TONIGHT&apos;S GAME
            </div>
            {winners[0].imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={winners[0].imageUrl}
                alt={winners[0].title}
                className="w-full h-56 object-contain bg-gray-900"
              />
            )}
            <div className="p-4">
              <h2 className="font-serif text-xl font-bold mb-1">{winners[0].title}</h2>
              <p className="text-gray-400 text-sm mb-3">
                {winners[0].minPlayers}–{winners[0].maxPlayers} players · {winners[0].playTime} min
              </p>
              <VoteCounts yes={winners[0].yesCount} maybe={winners[0].maybeCount} no={winners[0].noCount} />
            </div>
          </div>
        )}

        {/* Tied winners — all in one box */}
        {winners.length > 1 && (
          <div className="bg-indigo-950 border-2 border-indigo-500 rounded-2xl overflow-hidden mb-6">
            <div className="bg-indigo-600 text-center py-2 text-sm font-bold tracking-wide">
              🏆 IT&apos;S A TIE!
            </div>
            {winners.map(winner => (
              <div key={winner.gameId} className="border-t border-indigo-800/50 first:border-t-0">
                {winner.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={winner.imageUrl}
                    alt={winner.title}
                    className="w-full h-40 object-contain bg-gray-900"
                  />
                )}
                <div className="p-4">
                  <h2 className="font-serif text-xl font-bold mb-1">{winner.title}</h2>
                  <p className="text-gray-400 text-sm mb-3">
                    {winner.minPlayers}–{winner.maxPlayers} players · {winner.playTime} min
                  </p>
                  <VoteCounts yes={winner.yesCount} maybe={winner.maybeCount} no={winner.noCount} />
                </div>
              </div>
            ))}
            {isHost && (
              <div className="px-4 pb-4 border-t border-indigo-800/50">
                <button
                  onClick={handleRevote}
                  disabled={revoting}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl text-sm font-semibold transition-colors mt-3"
                >
                  {revoting ? 'Starting re-vote...' : '🔁 Re-vote with just these winners'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Rest of the ranked list */}
        {rest.length > 0 && (
          <div className="space-y-2 mb-8">
            <h3 className="font-display text-xs font-semibold uppercase tracking-widest text-gray-500 mb-3">Also ranked</h3>
            {rest.map((game, i) => (
              <div key={game.gameId} className="bg-gray-900 border border-white/5 rounded-xl p-3 flex gap-3 items-center">
                <span className="font-display font-black text-gray-600 w-5 text-center text-sm">{i + 2}</span>
                {game.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={game.imageUrl}
                    alt={game.title}
                    className="w-14 h-14 object-contain rounded bg-gray-800 flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-serif font-medium text-sm leading-tight truncate">{game.title}</p>
                  <p className="text-gray-500 text-xs mt-0.5">
                    {game.minPlayers}–{game.maxPlayers}p · {game.playTime}min
                  </p>
                  <VoteCounts yes={game.yesCount} maybe={game.maybeCount} no={game.noCount} small />
                </div>
              </div>
            ))}
          </div>
        )}

        <Link
          href="/dashboard"
          className="block w-full text-center py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-display font-bold btn-glow"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  )
}

function VoteCounts({
  yes,
  maybe,
  no,
  small = false,
}: {
  yes: number
  maybe: number
  no: number
  small?: boolean
}) {
  const cls = small ? 'text-xs' : 'text-sm'
  return (
    <div className={`flex gap-3 ${cls}`}>
      <span className="text-green-400 font-semibold">✓ {yes}</span>
      <span className="text-gray-400">~ {maybe}</span>
      <span className="text-red-400">✗ {no}</span>
    </div>
  )
}
