type GameInput = {
  bggId: string
  title: string
  complexity: number
}

// Call Claude Haiku directly to generate descriptors based on title + complexity.
// Claude's training data covers most popular board games well enough to generate
// accurate tags without needing additional BGG API calls.
async function callClaude(games: GameInput[]): Promise<Map<string, string[]>> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return new Map()

  const gamesText = games
    .map(g => `ID: ${g.bggId} | "${g.title}" (complexity ${g.complexity.toFixed(1)}/5)`)
    .join('\n')

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `For each board game below, give exactly 3 short descriptors (1-3 words each) that capture its feel, style, or standout trait. Use board game community vocabulary where it fits — e.g. "euro", "point salad", "take-that", "engine builder", "filler", "social deduction", "gateway", "party", "abstract", "coop", "heavy", "beautiful", "casual", "thinky". Return ONLY valid JSON with the game ID as the key:

${gamesText}

Return format: {"id1": ["tag","tag","tag"], "id2": ["tag","tag","tag"]}`,
        },
      ],
    }),
  })

  if (!res.ok) return new Map()

  const data = await res.json()
  const text: string = data.content?.[0]?.text ?? ''

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return new Map()
    const parsed = JSON.parse(jsonMatch[0])
    return new Map(
      Object.entries(parsed).map(([k, v]) => [k, (v as string[]).slice(0, 3)])
    )
  } catch {
    return new Map()
  }
}

const BATCH_SIZE = 20

// Generate descriptors for a list of games using Claude's training knowledge.
// Processes in batches of 20. Returns a map of bggId → string[3].
export async function generateDescriptors(
  games: GameInput[]
): Promise<Map<string, string[]>> {
  const eligible = games.filter(g => !g.bggId.startsWith('custom-'))
  if (eligible.length === 0) return new Map()

  const results = new Map<string, string[]>()

  for (let i = 0; i < eligible.length; i += BATCH_SIZE) {
    const batch = eligible.slice(i, i + BATCH_SIZE)
    const batchResults = await callClaude(batch)
    batchResults.forEach((v, k) => results.set(k, v))
  }

  return results
}
