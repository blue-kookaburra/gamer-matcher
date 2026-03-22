import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  const supabase = await createClient()

  const body = await request.json()
  const { participantId, bggGameId, vote } = body

  if (!participantId || !bggGameId || !vote) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  // Verify this participant belongs to this session
  const { data: participant } = await supabase
    .from('participants')
    .select('id, session_id')
    .eq('id', participantId)
    .eq('session_id', sessionId)
    .single()

  if (!participant) {
    return NextResponse.json({ error: 'Participant not found in this session' }, { status: 403 })
  }

  // Resolve bgg_game_id → session_games UUID
  const { data: sessionGame } = await supabase
    .from('session_games')
    .select('id')
    .eq('session_id', sessionId)
    .eq('bgg_game_id', bggGameId)
    .single()

  if (!sessionGame) {
    return NextResponse.json({ error: 'Game not found in this session' }, { status: 404 })
  }

  // Save the vote (upsert handles retries; onConflict matches the unique constraint)
  const { error: voteError } = await supabase
    .from('votes')
    .upsert(
      { session_id: sessionId, participant_id: participantId, session_game_id: sessionGame.id, vote },
      { onConflict: 'participant_id,session_game_id' }
    )

  if (voteError) {
    return NextResponse.json({ error: voteError.message, details: voteError }, { status: 500 })
  }

  // Count how many votes this participant has submitted
  const { count: voteCount } = await supabase
    .from('votes')
    .select('*', { count: 'exact', head: true })
    .eq('participant_id', participantId)
    .eq('session_id', sessionId)

  // Count eligible games — respects player_count filter same as the vote page
  const { data: sessionRow } = await supabase
    .from('sessions')
    .select('player_count')
    .eq('id', sessionId)
    .single()

  const playerCount = sessionRow?.player_count ?? 0

  let eligibleQuery = supabase
    .from('session_games')
    .select('id')
    .eq('session_id', sessionId)

  if (playerCount > 0) {
    eligibleQuery = eligibleQuery
      .lte('min_players', playerCount)
      .gte('max_players', playerCount)
  }

  const { data: eligibleGames } = await eligibleQuery
  const gameCount = eligibleGames?.length ?? 0

  const myDone = (voteCount ?? 0) >= (gameCount ?? 0)

  // Mark participant as finished if they've voted on all games
  if (myDone) {
    await supabase
      .from('participants')
      .update({ finished_at: new Date().toISOString() })
      .eq('id', participantId)
  }

  // Check if all participants in the session are done
  const { count: finishedCount } = await supabase
    .from('participants')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', sessionId)
    .not('finished_at', 'is', null)

  const { count: totalParticipants } = await supabase
    .from('participants')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', sessionId)

  const allDone = (finishedCount ?? 0) >= (totalParticipants ?? 1)

  return NextResponse.json({ myDone, allDone })
}
