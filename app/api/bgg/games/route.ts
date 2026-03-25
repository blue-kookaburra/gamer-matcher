import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { BGGGame } from '@/lib/bgg'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('bgg_games')
    .select('*')
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: 'Failed to load games.' }, { status: 500 })

  const games: BGGGame[] = (data ?? []).map(row => ({
    bggId: row.bgg_id,
    title: row.title,
    imageUrl: row.image_url ?? '',
    description: '',
    minPlayers: row.min_players ?? 1,
    maxPlayers: row.max_players ?? 99,
    playTime: row.play_time ?? 0,
    complexity: row.complexity ?? 0,
    isExpansion: row.is_expansion ?? false,
  }))

  return NextResponse.json({ games })
}
