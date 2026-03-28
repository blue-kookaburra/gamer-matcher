import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateDescriptors } from '@/lib/descriptors'

type GameInput = { bggId: string; title: string; complexity: number }

export async function POST(request: Request) {
  const supabase = await createClient()

  const { games } = await request.json() as { games: GameInput[] }
  const eligible = (games ?? []).filter(g => !g.bggId.startsWith('custom-'))
  if (eligible.length === 0) return NextResponse.json({ descriptors: {} })

  const bggIds = eligible.map(g => g.bggId)

  // Check the shared cache first — readable by anyone (guests included)
  const { data: cached } = await supabase
    .from('game_descriptors')
    .select('bgg_id, descriptors')
    .in('bgg_id', bggIds)

  const result: Record<string, string[]> = {}
  const cachedIds = new Set<string>()
  for (const row of cached ?? []) {
    result[row.bgg_id] = row.descriptors
    cachedIds.add(row.bgg_id)
  }

  // Generation requires auth — guests get cache-only
  const missingGames = eligible.filter(g => !cachedIds.has(g.bggId))

  if (missingGames.length > 0) {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ descriptors: result })

    const generated = await generateDescriptors(missingGames)

    if (generated.size > 0) {
      const rows = Array.from(generated.entries()).map(([bgg_id, descriptors]) => ({
        bgg_id,
        descriptors,
      }))
      await supabase
        .from('game_descriptors')
        .upsert(rows, { onConflict: 'bgg_id' })

      generated.forEach((v, k) => { result[k] = v })
    }
  }

  return NextResponse.json({ descriptors: result })
}
