import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Only the session host can trigger a re-vote
  const { data: session } = await supabase
    .from('sessions')
    .select('host_id')
    .eq('id', sessionId)
    .single()
  if (!session || session.host_id !== user.id)
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { gameIds } = await request.json() as { gameIds: string[] }

  // Remove all games that aren't part of the tie
  await supabase
    .from('session_games')
    .delete()
    .eq('session_id', sessionId)
    .not('bgg_game_id', 'in', `(${gameIds.join(',')})`)

  // Clear all existing votes so everyone votes fresh
  await supabase.from('votes').delete().eq('session_id', sessionId)

  // Reset finished_at so all participants can vote again
  await supabase
    .from('participants')
    .update({ finished_at: null })
    .eq('session_id', sessionId)

  // Setting status to 'revoting' triggers the real-time listener on the results page,
  // redirecting all participants back to the vote page
  await supabase
    .from('sessions')
    .update({ status: 'revoting' })
    .eq('id', sessionId)

  return NextResponse.json({ ok: true })
}
