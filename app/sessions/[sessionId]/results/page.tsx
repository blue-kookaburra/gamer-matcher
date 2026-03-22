'use client'

import { useState, useEffect, use } from 'react'
import Link from 'next/link'

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
  const [games, setGames] = useState<RankedGame[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/sessions/${sessionId}/results`)
      const data = await res.json()
      setGames(data.games ?? [])
      setLoading(false)
    }
    load()
  }, [sessionId])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-gray-400">Loading results...</p>
      </div>
    )
  }

  const winner = games[0]
  const rest = games.slice(1)

  return (
    <div className="min-h-screen bg-gray-950 text-white px-4 py-8">
      <div className="max-w-md mx-auto">
        <h1 className="text-2xl font-bold text-center mb-1">Results</h1>
        <p className="text-gray-400 text-center text-sm mb-8">Ranked by yes votes</p>

        {/* Winner */}
        {winner && (
          <div className="bg-indigo-950 border-2 border-indigo-500 rounded-2xl overflow-hidden mb-6">
            <div className="bg-indigo-600 text-center py-2 text-sm font-bold tracking-wide">
              🏆 TONIGHT&apos;S GAME
            </div>
            {winner.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={winner.imageUrl}
                alt={winner.title}
                className="w-full h-56 object-contain bg-gray-900"
              />
            )}
            <div className="p-4">
              <h2 className="text-xl font-bold mb-1">{winner.title}</h2>
              <p className="text-gray-400 text-sm mb-3">
                {winner.minPlayers}–{winner.maxPlayers} players · {winner.playTime} min
              </p>
              <VoteCounts yes={winner.yesCount} maybe={winner.maybeCount} no={winner.noCount} />
            </div>
          </div>
        )}

        {/* Rest of the ranked list */}
        {rest.length > 0 && (
          <div className="space-y-3 mb-8">
            <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wide">Also ranked</h3>
            {rest.map((game, i) => (
              <div key={game.gameId} className="bg-gray-800 rounded-xl p-3 flex gap-3 items-center">
                <span className="text-gray-500 font-bold w-5 text-center">{i + 2}</span>
                {game.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={game.imageUrl}
                    alt={game.title}
                    className="w-14 h-14 object-contain rounded bg-gray-900 flex-shrink-0"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm leading-tight truncate">{game.title}</p>
                  <p className="text-gray-400 text-xs mt-0.5">
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
          className="block w-full text-center py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-semibold transition-colors"
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
