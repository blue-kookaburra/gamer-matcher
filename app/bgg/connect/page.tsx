'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { BGGGame } from '@/lib/bgg'

export default function ConnectBGGPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'username' | 'csv'>('csv')
  const [username, setUsername] = useState('')
  const [games, setGames] = useState<BGGGame[]>([])
  const [error, setError] = useState('')
  const [fetching, setFetching] = useState(false)
  const [saving, setSaving] = useState(false)

  // Username path: fetch and preview the collection
  async function handlePreview(e: React.FormEvent) {
    e.preventDefault()
    setFetching(true)
    setError('')
    setGames([])

    const res = await fetch(`/api/bgg/collection?username=${encodeURIComponent(username)}`)
    const data = await res.json()

    if (!res.ok) {
      setError(data.error)
      setFetching(false)
      return
    }

    setGames(data.games)
    setFetching(false)
  }

  // CSV path: upload file and parse collection
  async function handleCSVUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setFetching(true)
    setError('')
    setGames([])

    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch('/api/bgg/csv-upload', { method: 'POST', body: formData })
    const data = await res.json()

    if (!res.ok) {
      setError(data.error)
      setFetching(false)
      return
    }

    setGames(data.games)
    setFetching(false)
  }

  // Save the collection source to the user's profile
  async function handleSave() {
    setSaving(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      router.push('/auth/login')
      return
    }

    if (tab === 'username') {
      await supabase
        .from('profiles')
        .update({ bgg_username: username, bgg_source: 'username' })
        .eq('id', user.id)
    } else {
      // CSV games are already saved by the upload route; just record the source
      await supabase
        .from('profiles')
        .update({ bgg_username: null, bgg_source: 'csv' })
        .eq('id', user.id)
    }

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white px-4 py-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link href="/profile" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-white transition-colors">
            ← Back to Profile
          </Link>
          <Link href="/profile" className="text-gray-500 hover:text-white transition-colors" title="Profile">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
            </svg>
          </Link>
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight mb-1">Import Game Collection</h1>
        <p className="text-gray-500 mb-6 text-sm">
          Choose how to import your BoardGameGeek collection.
        </p>

        {/* Tab toggle */}
        <div className="flex gap-2 mb-6 bg-gray-900 border border-white/5 rounded-xl p-1">
          <button
            onClick={() => { setTab('csv'); setGames([]); setError('') }}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-display font-semibold transition-colors ${
              tab === 'csv' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Upload CSV
          </button>
          <button
            onClick={() => { setTab('username'); setGames([]); setError('') }}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-display font-semibold transition-colors ${
              tab === 'username' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            BGG Username
          </button>
        </div>

        {/* CSV upload tab */}
        {tab === 'csv' && (
          <div className="mb-6">
            <p className="text-gray-500 text-sm mb-3">
              Export your collection from BGG: go to <strong className="text-gray-300">My Collection</strong> → <strong className="text-gray-300">Export</strong> → download the CSV file, then upload it here.
            </p>
            <label className="block">
              <span className="sr-only">Choose CSV file</span>
              <input
                type="file"
                accept=".csv"
                onChange={handleCSVUpload}
                disabled={fetching}
                className="block w-full text-sm text-gray-400
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-lg file:border-0
                  file:text-sm file:font-semibold
                  file:bg-indigo-600 file:text-white
                  hover:file:bg-indigo-700
                  file:cursor-pointer file:disabled:opacity-50"
              />
            </label>
            {fetching && <p className="text-gray-500 text-sm mt-3">Parsing CSV...</p>}
          </div>
        )}

        {/* Username tab */}
        {tab === 'username' && (
          <div className="mb-6">
            <p className="text-gray-500 text-sm mb-3">
              Your BGG collection must be set to <strong className="text-gray-300">public</strong>.
            </p>
            <form onSubmit={handlePreview} className="flex gap-3">
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Your BGG username"
                required
                className="flex-1 px-4 py-2.5 rounded-lg bg-gray-900 text-white border border-white/8 focus:outline-none focus:border-indigo-500 transition-colors"
              />
              <button
                type="submit"
                disabled={fetching}
                className="px-5 py-2 rounded-lg font-semibold btn-gradient"
              >
                {fetching ? 'Loading...' : 'Preview'}
              </button>
            </form>
          </div>
        )}

        {error && (
          <div className="bg-red-900/40 border border-red-700 rounded-lg px-4 py-3 text-red-300 text-sm mb-6">
            {error}
          </div>
        )}

        {/* Collection preview */}
        {games.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <p className="text-gray-500 text-sm">{games.length} games found</p>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 rounded-lg font-semibold text-sm btn-gradient"
              >
                {saving ? 'Saving...' : 'Use This Collection'}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {games.map(game => (
                <div key={game.bggId} className="bg-gray-900 border border-white/5 rounded-lg p-3 flex flex-col gap-2">
                  {game.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={game.imageUrl}
                      alt={game.title}
                      className="w-full aspect-square object-contain rounded"
                    />
                  )}
                  <p className="text-sm font-medium leading-tight">{game.title}</p>
                  <p className="text-xs text-gray-500">
                    {game.minPlayers}–{game.maxPlayers} players · {game.playTime}min
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
