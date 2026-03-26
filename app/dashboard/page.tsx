import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import Logo from '@/app/components/Logo'

type SessionSummary = {
  id: string
  createdAt: string
  playerCount: number
  gameCount: number
  winners: string[]
  extraWinners: number
}

type TopGame = {
  title: string
  count: number
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Fetch host's profile to check if BGG collection is connected
  const { data: profile } = await supabase
    .from('profiles')
    .select('bgg_username, bgg_source')
    .eq('id', user.id)
    .single()

  // Fetch all session IDs for this host (needed for stats + recent list)
  const { data: allSessionRows } = await supabase
    .from('sessions')
    .select('id, created_at, player_count')
    .eq('host_id', user.id)
    .order('created_at', { ascending: false })

  const totalSessions = allSessionRows?.length ?? 0
  const allSessionIds = allSessionRows?.map(s => s.id) ?? []
  const recentSessions = allSessionRows?.slice(0, 5) ?? []
  const recentSessionIds = recentSessions.map(s => s.id)

  // Fetch games + votes for recent sessions (for history panel)
  // Fetch all session_games for top-games stat + library counts in parallel
  const [
    { data: recentGames },
    { data: recentVotes },
    { data: allSessionGames },
    { data: libraryCounts },
  ] = await Promise.all([
    supabase
      .from('session_games')
      .select('id, session_id, title')
      .in('session_id', recentSessionIds),
    supabase
      .from('votes')
      .select('session_id, session_game_id, vote')
      .in('session_id', recentSessionIds),
    supabase
      .from('session_games')
      .select('bgg_game_id, title')
      .in('session_id', allSessionIds),
    supabase
      .from('bgg_games')
      .select('is_expansion')
      .eq('user_id', user.id),
  ])

  // Compute recent session summaries
  const summaries: SessionSummary[] = recentSessions.map(session => {
    const games = recentGames?.filter(g => g.session_id === session.id) ?? []
    const votes = recentVotes?.filter(v => v.session_id === session.id) ?? []

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

  // Compute top 5 most-selected games across all sessions
  const gameCounts: Record<string, { title: string; count: number }> = {}
  for (const g of allSessionGames ?? []) {
    if (!gameCounts[g.bgg_game_id]) gameCounts[g.bgg_game_id] = { title: g.title, count: 0 }
    gameCounts[g.bgg_game_id].count++
  }
  const topGames: TopGame[] = Object.values(gameCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // Game library counts
  const baseCount = libraryCounts?.filter(g => !g.is_expansion).length ?? 0
  const expansionCount = libraryCounts?.filter(g => g.is_expansion).length ?? 0

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
        <div className="flex items-center justify-between mb-2">
          <Logo className="h-8" />
          <div className="flex items-center gap-4">
            <Link href="/profile" className="text-gray-500 hover:text-white transition-colors" title="Profile">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
              </svg>
            </Link>
            <form action={handleLogout}>
              <button className="text-xs font-display font-semibold uppercase tracking-wider text-gray-500 hover:text-white transition-colors">
                Log out
              </button>
            </form>
          </div>
        </div>
        <h1 className="font-display text-3xl font-black tracking-tight mb-6">Dashboard</h1>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          {/* Sessions hosted */}
          <div className="bg-gray-900 border border-white/5 rounded-2xl p-4 text-center flex flex-col items-center justify-center">
            <p className="font-display text-4xl font-black text-white leading-none">{totalSessions}</p>
            <p className="text-xs text-gray-500 mt-2 uppercase tracking-widest font-semibold font-display">Sessions hosted</p>
          </div>

          {/* Most selected games */}
          <div className="bg-gray-900 border border-white/5 rounded-2xl p-4">
            <p className="text-xs text-gray-500 mb-2 uppercase tracking-widest font-semibold font-display">Most selected</p>
            {totalSessions >= 5 ? (
              <ul className="space-y-1.5">
                {topGames.map(g => (
                  <li key={g.title} className="text-sm text-gray-200 truncate leading-tight">{g.title}</li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray-600 leading-relaxed">
                Host {5 - totalSessions} more session{5 - totalSessions !== 1 ? 's' : ''} to unlock
              </p>
            )}
          </div>
        </div>

        {/* New session CTA — prominent at top if collection is connected */}
        {(profile?.bgg_username || profile?.bgg_source === 'csv') ? (
          <Link
            href="/sessions/new"
            className="flex flex-col items-center justify-center gap-3 w-full py-8 rounded-2xl font-display font-bold tracking-wide btn-gradient mb-6"
          >
            <span className="text-4xl">🎲</span>
            <span className="text-lg">Let the Gaming Begin</span>
          </Link>
        ) : (
          <div className="bg-gray-900 border border-white/5 rounded-2xl p-5 mb-6">
            <p className="text-gray-300 text-sm mb-3">Import your BoardGameGeek collection to get started.</p>
            <Link
              href="/bgg/connect"
              className="inline-block px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-sm font-semibold btn-glow"
            >
              Import Collection
            </Link>
          </div>
        )}

        {/* Recent sessions */}
        {summaries.length > 0 && (
          <div className="mb-6">
            <h2 className="font-display text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
              Recent Sessions
            </h2>
            <div className="space-y-2">
              {summaries.map(s => {
                const date = new Date(s.createdAt).toLocaleDateString('en-US', {
                  month: 'short', day: 'numeric',
                })
                const winnerLine = s.winners.length === 0
                  ? 'No votes recorded'
                  : `${s.winners.join(' · ')}${s.extraWinners > 0 ? ` +${s.extraWinners}` : ''}`
                return (
                  <div key={s.id} className="relative overflow-hidden bg-gray-900 border border-white/5 rounded-xl p-4 flex items-center justify-between gap-3">
                    <span className="absolute right-14 top-1/2 -translate-y-1/2 text-4xl text-white/4 pointer-events-none select-none leading-none">🏆</span>
                    <div className="min-w-0">
                      <p className="font-medium text-sm truncate">{winnerLine}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {date} · {s.playerCount > 0 ? `${s.playerCount} players` : 'players TBD'} · {s.gameCount} games
                      </p>
                    </div>
                    <Link
                      href={`/sessions/${s.id}/results`}
                      className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors flex-shrink-0"
                    >
                      View →
                    </Link>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Game library — at bottom */}
        {(profile?.bgg_username || profile?.bgg_source === 'csv') && (
          <div className="bg-gray-900 border border-orange-500/40 rounded-2xl p-5">
            <h2 className="font-display font-semibold text-xs uppercase tracking-widest text-gray-400 mb-2">Game Library</h2>
            {profile?.bgg_username ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-300">
                    Connected as <span className="text-indigo-400 font-medium">{profile.bgg_username}</span>
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {baseCount} game{baseCount !== 1 ? 's' : ''}{expansionCount > 0 ? ` and ${expansionCount} expansion${expansionCount !== 1 ? 's' : ''}` : ''}
                  </p>
                </div>
                <Link href="/bgg/connect" className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors">Change</Link>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-300">Collection loaded from CSV</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {baseCount} game{baseCount !== 1 ? 's' : ''}{expansionCount > 0 ? ` and ${expansionCount} expansion${expansionCount !== 1 ? 's' : ''}` : ''}
                  </p>
                </div>
                <Link href="/bgg/connect" className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors">Change</Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
