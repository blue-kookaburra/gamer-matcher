'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
        <h1 className="text-2xl font-bold mb-1">Import Game Collection</h1>
        <p className="text-gray-400 mb-6 text-sm">
          Choose how to import your BoardGameGeek collection.
        </p>

        {/* Tab toggle */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => { setTab('csv'); setGames([]); setError('') }}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              tab === 'csv' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            Upload CSV
          </button>
          <button
            onClick={() => { setTab('username'); setGames([]); setError('') }}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
              tab === 'username' ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
            }`}
          >
            BGG Username
          </button>
        </div>

        {/* CSV upload tab */}
        {tab === 'csv' && (
          <div className="mb-6">
            <p className="text-gray-400 text-sm mb-3">
              Export your collection from BGG: go to <strong>My Collection</strong> → <strong>Export</strong> → download the CSV file, then upload it here.
            </p>
            <label className="block">
              <span className="sr-only">Choose CSV file</span>
              <input
                type="file"
                accept=".csv"
                onChange={handleCSVUpload}
                disabled={fetching}
                className="block w-full text-sm text-gray-300
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-lg file:border-0
                  file:text-sm file:font-semibold
                  file:bg-indigo-600 file:text-white
                  hover:file:bg-indigo-700
                  file:cursor-pointer file:disabled:opacity-50"
              />
            </label>
            {fetching && <p className="text-gray-400 text-sm mt-3">Parsing CSV...</p>}
          </div>
        )}

        {/* Username tab */}
        {tab === 'username' && (
          <div className="mb-6">
            <p className="text-gray-400 text-sm mb-3">
              Your BGG collection must be set to <strong>public</strong>.
            </p>
            <form onSubmit={handlePreview} className="flex gap-3">
              <input
                type="text"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Your BGG username"
                required
                className="flex-1 px-4 py-2 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-indigo-500"
              />
              <button
                type="submit"
                disabled={fetching}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-lg font-semibold transition-colors"
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
              <p className="text-gray-300 text-sm">{games.length} games found</p>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-5 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg font-semibold text-sm transition-colors"
              >
                {saving ? 'Saving...' : 'Use This Collection'}
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {games.map(game => (
                <div key={game.bggId} className="bg-gray-800 rounded-lg p-3 flex flex-col gap-2">
                  {game.imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={game.imageUrl}
                      alt={game.title}
                      className="w-full aspect-square object-contain rounded"
                    />
                  )}
                  <p className="text-sm font-medium leading-tight">{game.title}</p>
                  <p className="text-xs text-gray-400">
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
