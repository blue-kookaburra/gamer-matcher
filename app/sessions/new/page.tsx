'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { BGGGame } from '@/lib/bgg'

export default function NewSessionPage() {
  const router = useRouter()
  const [games, setGames] = useState<BGGGame[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [maxGames, setMaxGames] = useState(10)
  const [playerCountFilter, setPlayerCountFilter] = useState<number | ''>('')
  const [complexityFilters, setComplexityFilters] = useState<Set<string>>(new Set())
  const [playtimeFilters, setPlaytimeFilters] = useState<Set<string>>(new Set())
  const [excludeExpansions, setExcludeExpansions] = useState(true)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [descriptorMap, setDescriptorMap] = useState<Record<string, string[]>>({})
  const [descriptorsLoading, setDescriptorsLoading] = useState(false)
  const [showCustomForm, setShowCustomForm] = useState(false)
  const [customTitle, setCustomTitle] = useState('')
  const [customMin, setCustomMin] = useState('')
  const [customMax, setCustomMax] = useState('')
  const [customComplexity, setCustomComplexity] = useState('')

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

      // Fetch descriptors in the background — games are usable immediately
      setDescriptorsLoading(true)
      fetch('/api/bgg/descriptors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          games: data.games.map((g: BGGGame) => ({
            bggId: g.bggId,
            title: g.title,
            complexity: g.complexity,
          })),
        }),
      })
        .then(r => r.json())
        .then(d => setDescriptorMap(d.descriptors ?? {}))
        .finally(() => setDescriptorsLoading(false))
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
    if (excludeExpansions && game.isExpansion) return false
    if (playerCountFilter !== '') {
      const n = Number(playerCountFilter)
      if (game.minPlayers > n || game.maxPlayers < n) return false
    }
    if (complexityFilters.size > 0) {
      const c = game.complexity
      const band = c === 0 || c < 1.5 ? 'easy' : c < 2.5 ? 'medium' : 'hard'
      if (!complexityFilters.has(band)) return false
    }
    if (playtimeFilters.size > 0) {
      const t = game.playTime
      if (t === 0) return false // unknown play time — exclude when filtering
      const slot = t <= 30 ? 'sweet' : t <= 60 ? 'entree' : 'main'
      if (!playtimeFilters.has(slot)) return false
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

  function addCustomGame(e: React.FormEvent) {
    e.preventDefault()
    if (!customTitle.trim()) return
    const game: BGGGame = {
      bggId: `custom-${Date.now()}`,
      title: customTitle.trim(),
      imageUrl: '',
      description: '',
      minPlayers: customMin ? Number(customMin) : 1,
      maxPlayers: customMax ? Number(customMax) : 99,
      playTime: 0,
      complexity: customComplexity ? Number(customComplexity) : 0,
      isExpansion: false,
    }
    setGames(prev => [...prev, game])
    setSelected(prev => new Set([...prev, game.bggId]))
    setCustomTitle('')
    setCustomMin('')
    setCustomMax('')
    setCustomComplexity('')
    setShowCustomForm(false)
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
        <h1 className="font-display text-2xl font-bold tracking-tight mb-1">Which games are on the ballot?</h1>
        <p className="text-gray-400 text-sm mb-6">
          Choose which games to include. Only games that support the right player count will show during voting.
        </p>

        {/* Max games slider */}
        {(() => {
          const maxTop = Math.min(50, selected.size || 50)
          const fillPct = Math.round(((maxGames - 5) / Math.max(maxTop - 5, 1)) * 100)
          return (
            <div className="bg-gray-900 border border-white/5 rounded-xl p-4 mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Max games to vote on: <span className="text-indigo-400 font-bold">{maxGames}</span>
              </label>
              <input
                type="range"
                min={5}
                max={maxTop}
                value={maxGames}
                onChange={e => setMaxGames(Number(e.target.value))}
                className="w-full gradient-range"
                style={{ background: `linear-gradient(to right, #ff6b35, #ffaa00 ${fillPct}%, #1e1e2a ${fillPct}%)` }}
              />
              <p className="text-xs text-gray-400 mt-1">Games are shown in random order up to this limit.</p>
            </div>
          )
        })()}

        {/* Filters */}
        <div className="bg-gray-900 border border-white/5 rounded-xl p-4 mb-6 space-y-4">
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

          {/* Playtime */}
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-gray-300 w-28 flex-shrink-0">Playtime</span>
            <div className="flex gap-2 flex-wrap">
              {([
                { key: 'sweet', label: '🍬 Sweet Treat', hint: '≤30m' },
                { key: 'entree', label: '🍽 Entrée', hint: '31–60m' },
                { key: 'main', label: '🍖 Main', hint: '>60m' },
              ] as const).map(({ key, label, hint }) => {
                const active = playtimeFilters.has(key)
                return (
                  <button
                    key={key}
                    onClick={() => {
                      setPlaytimeFilters(prev => {
                        const next = new Set(prev)
                        next.has(key) ? next.delete(key) : next.add(key)
                        return next
                      })
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                      active
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                    }`}
                    title={hint}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            {playtimeFilters.size > 0 && (
              <button onClick={() => setPlaytimeFilters(new Set())} className="text-xs text-gray-400 hover:text-white">
                Clear
              </button>
            )}
          </div>

          {/* Expansions */}
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-300 w-28 flex-shrink-0">Expansions</span>
            <button
              onClick={() => setExcludeExpansions(prev => !prev)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                excludeExpansions
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {excludeExpansions ? 'Hiding expansions' : 'Showing expansions'}
            </button>
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
            const isCustom = game.bggId.startsWith('custom-')
            const playersLabel = (game.minPlayers === 1 && game.maxPlayers === 99)
              ? 'Any players'
              : `${game.minPlayers}–${game.maxPlayers}p`
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
                <div className="flex flex-wrap gap-x-2 gap-y-0.5 mt-1">
                  <span className="flex items-center gap-0.5 text-xs text-gray-300">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                    {playersLabel}
                  </span>
                  {game.playTime > 0 && (
                    <span className="flex items-center gap-0.5 text-xs text-gray-300">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>
                      {game.playTime}m
                    </span>
                  )}
                  {game.complexity > 0 && (
                    <span className="flex items-center gap-0.5 text-xs text-gray-400">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M20.57 14.86L22 13.43 20.57 12 17 15.57 8.43 7 12 3.43 10.57 2 9.14 3.43 7.71 2 5.57 4.14 4.14 2.71 2.71 4.14l1.43 1.43L2 7.71l1.43 1.43L2 10.57 3.43 12 7 8.43 15.57 17 12 20.57 13.43 22l1.43-1.43L16.29 22l2.14-2.14 1.43 1.43 1.43-1.43-1.43-1.43L22 16.29l-1.43-1.43z"/></svg>
                      {game.complexity.toFixed(1)}
                    </span>
                  )}
                </div>
                {isCustom && <p className="text-xs text-indigo-400 mt-0.5">Custom</p>}
                {descriptorMap[game.bggId]?.length > 0 ? (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {descriptorMap[game.bggId].map(tag => (
                      <span key={tag} className="px-1.5 py-0.5 rounded bg-gray-700 text-gray-300 text-[10px]">
                        {tag}
                      </span>
                    ))}
                  </div>
                ) : descriptorsLoading && !isCustom ? (
                  <p className="text-[10px] text-gray-600 mt-1">···</p>
                ) : null}
              </button>
            )
          })}

          {/* Add custom game card */}
          {!showCustomForm ? (
            <button
              onClick={() => setShowCustomForm(true)}
              className="rounded-lg p-3 border-2 border-dashed border-gray-700 bg-gray-800/40 hover:border-indigo-500 hover:bg-indigo-950/20 transition-colors flex flex-col items-center justify-center min-h-[100px] gap-1"
            >
              <span className="text-2xl text-gray-600">+</span>
              <p className="text-xs text-gray-500">Add custom game</p>
            </button>
          ) : (
            <form onSubmit={addCustomGame} className="rounded-lg p-3 border-2 border-indigo-500 bg-indigo-950/30 space-y-2">
              <input
                type="text"
                value={customTitle}
                onChange={e => setCustomTitle(e.target.value)}
                placeholder="Title *"
                required
                autoFocus
                className="w-full px-2 py-1 rounded bg-gray-700 text-white text-xs border border-gray-600 focus:outline-none focus:border-indigo-500"
              />
              <div className="flex gap-1">
                <input
                  type="number"
                  value={customMin}
                  onChange={e => setCustomMin(e.target.value)}
                  placeholder="Min p."
                  min={1}
                  max={20}
                  className="w-1/2 px-2 py-1 rounded bg-gray-700 text-white text-xs border border-gray-600 focus:outline-none focus:border-indigo-500"
                />
                <input
                  type="number"
                  value={customMax}
                  onChange={e => setCustomMax(e.target.value)}
                  placeholder="Max p."
                  min={1}
                  max={20}
                  className="w-1/2 px-2 py-1 rounded bg-gray-700 text-white text-xs border border-gray-600 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <input
                type="number"
                value={customComplexity}
                onChange={e => setCustomComplexity(e.target.value)}
                placeholder="Complexity (1–5)"
                min={1}
                max={5}
                step={0.1}
                className="w-full px-2 py-1 rounded bg-gray-700 text-white text-xs border border-gray-600 focus:outline-none focus:border-indigo-500"
              />
              <div className="flex gap-1">
                <button
                  type="submit"
                  className="flex-1 py-1 bg-indigo-600 hover:bg-indigo-700 rounded text-xs font-semibold transition-colors"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => { setShowCustomForm(false); setCustomTitle(''); setCustomMin(''); setCustomMax(''); setCustomComplexity('') }}
                  className="flex-1 py-1 bg-gray-700 hover:bg-gray-600 rounded text-xs transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>

        <button
          onClick={handleCreate}
          disabled={creating || selected.size === 0}
          className="w-full py-4 rounded-xl font-display font-bold tracking-wide btn-gradient"
        >
          {creating ? 'Rolling...' : "Let's roll!"}
        </button>
      </div>
    </div>
  )
}
