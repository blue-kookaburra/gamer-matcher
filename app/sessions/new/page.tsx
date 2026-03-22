'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { BGGGame } from '@/lib/bgg'

export default function NewSessionPage() {
  const router = useRouter()
  const [games, setGames] = useState<BGGGame[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [maxGames, setMaxGames] = useState(20)
  const [playerCountFilter, setPlayerCountFilter] = useState<number | ''>('')
  const [complexityFilters, setComplexityFilters] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    async function loadCollection() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/auth/login'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('bgg_username, bgg_source')
        .eq('id', user.id)
        .single()

      if (!profile?.bgg_username && profile?.bgg_source !== 'csv') {
        router.push('/bgg/connect')
        return
      }

      const url = profile.bgg_username
        ? `/api/bgg/collection?username=${encodeURIComponent(profile.bgg_username)}`
        : '/api/bgg/games'

      const res = await fetch(url)
      const data = await res.json()

      if (!res.ok) { setError(data.error); setLoading(false); return }

      setGames(data.games)
      // Select all games by default
      setSelected(new Set(data.games.map((g: BGGGame) => g.bggId)))
      setLoading(false)
    }

    loadCollection()
  }, [router])

  function toggleGame(bggId: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(bggId) ? next.delete(bggId) : next.add(bggId)
      return next
    })
  }

  const visibleGames = games.filter(game => {
    if (playerCountFilter !== '') {
      const n = Number(playerCountFilter)
      if (game.minPlayers > n || game.maxPlayers < n) return false
    }
    if (complexityFilters.size > 0) {
      const c = game.complexity
      const band = c === 0 || c < 1.5 ? 'easy' : c < 2.5 ? 'medium' : 'hard'
      if (!complexityFilters.has(band)) return false
    }
    return true
  })

  function selectAll() { setSelected(new Set(visibleGames.map(g => g.bggId))) }
  function selectNone() {
    setSelected(prev => {
      const next = new Set(prev)
      visibleGames.forEach(g => next.delete(g.bggId))
      return next
    })
  }

  async function handleCreate() {
    if (selected.size === 0) { setError('Select at least one game.'); return }
    setCreating(true)
    setError('')

    const selectedGames = visibleGames.filter(g => selected.has(g.bggId))

    const res = await fetch('/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ games: selectedGames, maxGames }),
    })

    const data = await res.json()
    if (!res.ok) { setError(data.error); setCreating(false); return }

    router.push(`/sessions/${data.sessionId}/lobby`)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
        <p className="text-gray-400">Loading your collection...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-1">New Game Night Session</h1>
        <p className="text-gray-400 text-sm mb-6">
          Choose which games to include. Only games that support the right player count will show during voting.
        </p>

        {/* Max games slider */}
        <div className="bg-gray-800 rounded-xl p-4 mb-6">
          <label className="block text-sm font-medium mb-2">
            Max games to vote on: <span className="text-indigo-400 font-bold">{maxGames}</span>
          </label>
          <input
            type="range"
            min={5}
            max={Math.min(50, selected.size || 50)}
            value={maxGames}
            onChange={e => setMaxGames(Number(e.target.value))}
            className="w-full accent-indigo-500"
          />
          <p className="text-xs text-gray-400 mt-1">Games are shown in random order up to this limit.</p>
        </div>

        {/* Filters */}
        <div className="bg-gray-800 rounded-xl p-4 mb-6 space-y-4">
          {/* Player count */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-300 w-28 flex-shrink-0">Players</span>
            <input
              type="number"
              min={1}
              max={20}
              placeholder="Any"
              value={playerCountFilter}
              onChange={e => setPlayerCountFilter(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-20 px-3 py-1.5 rounded-lg bg-gray-700 text-white border border-gray-600 focus:outline-none focus:border-indigo-500 text-sm"
            />
            {playerCountFilter !== '' && (
              <button onClick={() => setPlayerCountFilter('')} className="text-xs text-gray-400 hover:text-white">
                Clear
              </button>
            )}
          </div>

          {/* Complexity */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-gray-300 w-28 flex-shrink-0">Complexity</span>
            <div className="flex gap-2">
              {(['easy', 'medium', 'hard'] as const).map(band => {
                const labels = { easy: 'Easy', medium: 'Medium', hard: 'Hard' }
                const active = complexityFilters.has(band)
                return (
                  <button
                    key={band}
                    onClick={() => {
                      setComplexityFilters(prev => {
                        const next = new Set(prev)
                        next.has(band) ? next.delete(band) : next.add(band)
                        return next
                      })
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                      active
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                  >
                    {labels[band]}
                  </button>
                )
              })}
            </div>
            {complexityFilters.size > 0 && (
              <button onClick={() => setComplexityFilters(new Set())} className="text-xs text-gray-400 hover:text-white">
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Game selection */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm text-gray-300">
              {visibleGames.filter(g => selected.has(g.bggId)).length} of {visibleGames.length} selected
            </p>
            {visibleGames.length < games.length && (
              <p className="text-xs text-gray-500">{games.length - visibleGames.length} games hidden by filters</p>
            )}
          </div>
          <div className="flex gap-3 text-sm">
            <button onClick={selectAll} className="text-indigo-400 hover:underline">Select all</button>
            <button onClick={selectNone} className="text-gray-400 hover:underline">Clear</button>
          </div>
        </div>

        {error && (
          <div className="bg-red-900/40 border border-red-700 rounded-lg px-4 py-3 text-red-300 text-sm mb-4">
            {error}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-8">
          {visibleGames.map(game => {
            const isSelected = selected.has(game.bggId)
            return (
              <button
                key={game.bggId}
                onClick={() => toggleGame(game.bggId)}
                className={`rounded-lg p-3 text-left border-2 transition-colors ${
                  isSelected
                    ? 'border-indigo-500 bg-indigo-950'
                    : 'border-gray-700 bg-gray-800 opacity-50'
                }`}
              >
                {game.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={game.imageUrl} alt={game.title} className="w-full aspect-square object-contain rounded mb-2" />
                )}
                <p className="text-sm font-medium leading-tight">{game.title}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {game.minPlayers}–{game.maxPlayers}p · {game.playTime}min
                </p>
                {game.complexity > 0 && (
                  <p className="text-xs text-gray-500 mt-0.5">★ {game.complexity.toFixed(1)}/5</p>
                )}
              </button>
            )
          })}
        </div>

        <button
          onClick={handleCreate}
          disabled={creating || selected.size === 0}
          className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-xl font-semibold transition-colors"
        >
          {creating ? 'Creating session...' : 'Create Session'}
        </button>
      </div>
    </div>
  )
}
