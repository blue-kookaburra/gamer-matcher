import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { code, name } = await request.json() as { code: string; name: string }

  if (!code || !name?.trim()) {
    return NextResponse.json({ error: 'Code and name are required' }, { status: 400 })
  }

  // Look up the session by join code
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('id, status')
    .eq('code', code.toUpperCase())
    .single()

  if (sessionError || !session) {
    return NextResponse.json({ error: 'Session not found. Check your code and try again.' }, { status: 404 })
  }

  if (session.status !== 'waiting') {
    return NextResponse.json({ error: 'This session has already started.' }, { status: 400 })
  }

  // Attach user_id if the guest is signed in (e.g. anonymous auth)
  const { data: { user } } = await supabase.auth.getUser()

  // Add the guest as a participant
  const { data: participant, error: participantError } = await supabase
    .from('participants')
    .insert({
      session_id: session.id,
      name: name.trim(),
      is_host: false,
      ...(user ? { user_id: user.id } : {}),
    })
    .select()
    .single()

  if (participantError || !participant) {
    return NextResponse.json({ error: 'Failed to join session' }, { status: 500 })
  }

  return NextResponse.json({ sessionId: session.id, participantId: participant.id })
}
