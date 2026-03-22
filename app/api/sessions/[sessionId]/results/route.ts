import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  const supabase = await createClient()

  // Fetch all games in this session with their vote tallies
  const { data: sessionGames } = await supabase
    .from('session_games')
    .select('id, bgg_game_id, title, image_url, min_players, max_players, play_time')
    .eq('session_id', sessionId)
    .order('display_order')

  if (!sessionGames) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  // Fetch votes keyed by session_game_id (UUID)
  const { data: votes } = await supabase
    .from('votes')
    .select('session_game_id, vote')
    .eq('session_id', sessionId)

  // Tally votes per session_game UUID
  const tallies: Record<string, { yes: number; maybe: number; no: number }> = {}
  for (const v of votes ?? []) {
    if (!tallies[v.session_game_id]) tallies[v.session_game_id] = { yes: 0, maybe: 0, no: 0 }
    tallies[v.session_game_id][v.vote as 'yes' | 'maybe' | 'no']++
  }

  // Build ranked game list — match tally by UUID, expose bgg_game_id for display
  const ranked = sessionGames
    .map(g => ({
      gameId: g.bgg_game_id,
      title: g.title,
      imageUrl: g.image_url ?? '',
      minPlayers: g.min_players ?? 1,
      maxPlayers: g.max_players ?? 99,
      playTime: g.play_time ?? 0,
      yesCount: tallies[g.id]?.yes ?? 0,
      maybeCount: tallies[g.id]?.maybe ?? 0,
      noCount: tallies[g.id]?.no ?? 0,
    }))
    .sort((a, b) => b.yesCount - a.yesCount || b.maybeCount - a.maybeCount)

  return NextResponse.json({ games: ranked })
}
