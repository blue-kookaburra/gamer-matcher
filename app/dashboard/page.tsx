import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Fetch host's profile to check if BGG username is connected
  const { data: profile } = await supabase
    .from('profiles')
    .select('bgg_username, bgg_source')
    .eq('id', user.id)
    .single()

  async function handleLogout() {
    'use server'
    const supabase = await createClient()
    await supabase.auth.signOut()
    redirect('/auth/login')
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white px-4 py-8">
      <div className="max-w-lg mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">Gamer Matcher</h1>
          <form action={handleLogout}>
            <button className="text-sm text-gray-400 hover:text-white transition-colors">
              Log out
            </button>
          </form>
        </div>

        {/* BGG connection status */}
        <div className="bg-gray-800 rounded-xl p-5 mb-4">
          <h2 className="font-semibold text-lg mb-1">BoardGameGeek Collection</h2>
          {profile?.bgg_username ? (
            <div className="flex items-center justify-between">
              <p className="text-gray-300 text-sm">
                Connected as <span className="text-indigo-400 font-medium">{profile.bgg_username}</span>
              </p>
              <Link href="/bgg/connect" className="text-sm text-indigo-400 hover:underline">Change</Link>
            </div>
          ) : profile?.bgg_source === 'csv' ? (
            <div className="flex items-center justify-between">
              <p className="text-gray-300 text-sm">Collection loaded from CSV</p>
              <Link href="/bgg/connect" className="text-sm text-indigo-400 hover:underline">Change</Link>
            </div>
          ) : (
            <div>
              <p className="text-gray-400 text-sm mb-3">Import your BGG collection to get started.</p>
              <Link
                href="/bgg/connect"
                className="inline-block px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm font-semibold transition-colors"
              >
                Import Collection
              </Link>
            </div>
          )}
        </div>

        {/* New session button — only show if a collection is connected */}
        {(profile?.bgg_username || profile?.bgg_source === 'csv') && (
          <Link
            href="/sessions/new"
            className="block w-full text-center py-3 bg-green-600 hover:bg-green-700 rounded-xl font-semibold transition-colors"
          >
            Start a New Game Night Session
          </Link>
        )}
      </div>
    </div>
  )
}
