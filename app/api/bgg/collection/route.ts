import { NextResponse } from 'next/server'
import { parseCollection } from '@/lib/bgg'

// Proxies the BGG collection API (browser can't call BGG directly due to CORS)
// BGG sometimes returns 202 on first request — we retry up to 3 times with a 5s delay
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const username = searchParams.get('username')?.trim()

  if (!username) {
    return NextResponse.json({ error: 'username is required' }, { status: 400 })
  }

  const url = `https://boardgamegeek.com/xmlapi2/collection?username=${encodeURIComponent(username)}&own=1&stats=1`

  let xml: string | null = null

  // Retry loop — BGG returns 202 while it generates the collection
  for (let attempt = 0; attempt < 3; attempt++) {
    const response = await fetch(url, { next: { revalidate: 0 } })

    if (response.status === 202) {
      // BGG is still generating — wait 5 seconds then retry
      if (attempt < 2) await new Promise(res => setTimeout(res, 5000))
      continue
    }

    if (!response.ok) {
      const body = await response.text().catch(() => '')
      console.error(`BGG returned ${response.status}:`, body.slice(0, 300))
      return NextResponse.json(
        { error: `BGG returned status ${response.status}. Make sure your username is correct and your collection is public.` },
        { status: 404 }
      )
    }

    xml = await response.text()
    break
  }

  if (!xml) {
    return NextResponse.json(
      { error: 'BGG is still processing your collection. Wait a few seconds and try again.' },
      { status: 503 }
    )
  }

  // Check for BGG's XML error response (e.g. user not found)
  if (xml.includes('<error>')) {
    return NextResponse.json(
      { error: 'BGG username not found or collection is private.' },
      { status: 404 }
    )
  }

  const games = parseCollection(xml)
  return NextResponse.json({ games })
}
