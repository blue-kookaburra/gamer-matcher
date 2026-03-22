import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  const { sessionId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Get current participant count and update player_count on the session
  const { count } = await supabase
    .from('participants')
    .select('*', { count: 'exact', head: true })
    .eq('session_id', sessionId)

  const { error } = await supabase
    .from('sessions')
    .update({ status: 'voting', player_count: count ?? 0 })
    .eq('id', sessionId)
    .eq('host_id', user.id) // only the host can start

  if (error) return NextResponse.json({ error: 'Failed to start session' }, { status: 500 })

  return NextResponse.json({ ok: true })
}
