import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { customAlphabet } from 'nanoid'
import type { BGGGame } from '@/lib/bgg'

// Generates a short, readable 6-character session code (no ambiguous chars like 0/O, 1/I)
const generateCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6)

export async function POST(request: Request) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { games, maxGames } = await request.json() as {
    games: BGGGame[]
    maxGames: number
  }

  if (!games || games.length === 0) {
    return NextResponse.json({ error: 'No games provided' }, { status: 400 })
  }

  // Create the session
  const code = generateCode()
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .insert({ host_id: user.id, code, max_games: maxGames, player_count: 0 })
    .select()
    .single()

  if (sessionError || !session) {
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
  }

  // Insert selected games with a randomized display order
  const shuffled = [...games].sort(() => Math.random() - 0.5).slice(0, maxGames)
  const sessionGames = shuffled.map((game, index) => ({
    session_id: session.id,
    bgg_game_id: game.bggId,
    title: game.title,
    image_url: game.imageUrl,
    min_players: game.minPlayers,
    max_players: game.maxPlayers,
    play_time: game.playTime,
    complexity: game.complexity,
    display_order: index,
  }))

  const { error: gamesError } = await supabase.from('session_games').insert(sessionGames)

  if (gamesError) {
    return NextResponse.json({ error: 'Failed to save games' }, { status: 500 })
  }

  // Add the host as a participant
  await supabase.from('participants').insert({
    session_id: session.id,
    name: 'Host',
    is_host: true,
    user_id: user.id,
  })

  return NextResponse.json({ sessionId: session.id, code })
}
