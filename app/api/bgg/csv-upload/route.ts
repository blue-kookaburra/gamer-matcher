import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseCollectionCSV } from '@/lib/bgg'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const csvText = await file.text()
  const games = parseCollectionCSV(csvText)

  if (games.length === 0) {
    return NextResponse.json(
      { error: 'No owned games found in CSV. Make sure you exported your owned collection from BGG.' },
      { status: 400 }
    )
  }

  // Replace any previously uploaded collection
  await supabase.from('bgg_games').delete().eq('user_id', user.id)

  const rows = games.map(g => ({
    user_id: user.id,
    bgg_id: g.bggId,
    title: g.title,
    image_url: g.imageUrl,
    min_players: g.minPlayers,
    max_players: g.maxPlayers,
    play_time: g.playTime,
    complexity: g.complexity,
    is_expansion: g.isExpansion,
  }))

  const { error } = await supabase.from('bgg_games').insert(rows)
  if (error) return NextResponse.json({ error: 'Failed to save games.' }, { status: 500 })

  return NextResponse.json({ games })
}
