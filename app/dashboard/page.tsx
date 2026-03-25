import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'

type SessionSummary = {
  id: string
  createdAt: string
  playerCount: number
  gameCount: number
  winners: string[]
  extraWinners: number
}

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

  // Fetch recent sessions and compute winners
  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, created_at, player_count')
    .eq('host_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5)

  const sessionIds = sessions?.map(s => s.id) ?? []

  const [{ data: allGames }, { data: allVotes }] = await Promise.all([
    supabase
      .from('session_games')
      .select('id, session_id, title')
      .in('session_id', sessionIds),
    supabase
      .from('votes')
      .select('session_id, session_game_id, vote')
      .in('session_id', sessionIds),
  ])

  const summaries: SessionSummary[] = (sessions ?? []).map(session => {
    const games = allGames?.filter(g => g.session_id === session.id) ?? []
    const votes = allVotes?.filter(v => v.session_id === session.id) ?? []

    const tallies: Record<string, { yes: number; maybe: number }> = {}
    for (const v of votes) {
      if (!tallies[v.session_game_id]) tallies[v.session_game_id] = { yes: 0, maybe: 0 }
      if (v.vote === 'yes') tallies[v.session_game_id].yes++
      if (v.vote === 'maybe') tallies[v.session_game_id].maybe++
    }

    const scored = games
      .map(g => ({ title: g.title, yes: tallies[g.id]?.yes ?? 0, maybe: tallies[g.id]?.maybe ?? 0 }))
      .sort((a, b) => b.yes - a.yes || b.maybe - a.maybe)

    const top = scored[0]
    const allWinners = (top && top.yes > 0)
      ? scored.filter(g => g.yes === top.yes && g.maybe === top.maybe).map(g => g.title)
      : []

    return {
      id: session.id,
      createdAt: session.created_at,
      playerCount: session.player_count,
      gameCount: games.length,
      winners: allWinners.slice(0, 3),
      extraWinners: Math.max(0, allWinners.length - 3),
    }
  })

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
            className="relative overflow-hidden block w-full text-center py-3 bg-green-600 hover:bg-green-700 rounded-xl font-semibold transition-colors"
          >
            <span className="relative z-10">Start a New Game Night Session</span>
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-5xl text-white/10 pointer-events-none select-none leading-none">🎲</span>
          </Link>
        )}

        {/* Recent sessions */}
        {summaries.length > 0 && (
          <div className="mt-8">
            <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wide mb-3">
              Recent Sessions
            </h2>
            <div className="space-y-3">
              {summaries.map(s => {
                const date = new Date(s.createdAt).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric',
                })
                const winnerLine = s.winners.length === 0
                  ? 'No votes recorded'
                  : `🏆 ${s.winners.join(' · ')}${s.extraWinners > 0 ? ` +${s.extraWinners}` : ''}`
                return (
                  <div key={s.id} className="relative overflow-hidden bg-gray-800 rounded-xl p-4 flex items-center justify-between gap-3">
                    <span className="absolute right-16 top-1/2 -translate-y-1/2 text-5xl text-white/5 pointer-events-none select-none leading-none">🏆</span>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{winnerLine}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {date} · {s.playerCount > 0 ? `${s.playerCount} players` : 'players TBD'} · {s.gameCount} games
                      </p>
                    </div>
                    <Link
                      href={`/sessions/${s.id}/results`}
                      className="text-sm text-indigo-400 hover:underline flex-shrink-0"
                    >
                      View →
                    </Link>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
