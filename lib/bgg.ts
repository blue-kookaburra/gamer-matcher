import { XMLParser } from 'fast-xml-parser'
import Papa from 'papaparse'

export type BGGGame = {
  bggId: string
  title: string
  imageUrl: string
  description: string
  minPlayers: number
  maxPlayers: number
  playTime: number       // minutes
  complexity: number     // BGG weight rating 1-5
}

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' })

// Parses the BGG /collection XML response into a clean array of games
export function parseCollection(xml: string): BGGGame[] {
  const parsed = parser.parse(xml)
  const items = parsed?.items?.item

  if (!items) return []

  // BGG returns a single object (not array) when there's only 1 game
  const itemArray = Array.isArray(items) ? items : [items]

  return itemArray
    .filter((item: any) => item?.status?.['@_own'] === '1') // only owned games
    .filter((item: any) => item['@_subtype'] !== 'boardgameexpansion') // exclude expansions
    .map((item: any) => {
      const stats = item.stats
      const rating = stats?.rating

      return {
        bggId: String(item['@_objectid']),
        title: item.name?.['#text'] ?? item.name ?? 'Unknown',
        imageUrl: item.image ?? '',
        description: '', // collection endpoint doesn't include description — fetched separately if needed
        minPlayers: Number(stats?.['@_minplayers']) || 1,
        maxPlayers: Number(stats?.['@_maxplayers']) || 99,
        playTime: Number(stats?.['@_playingtime']) || 0,
        complexity: Number(rating?.averageweight?.['@_value']) || 0,
      }
    })
    .filter((g: BGGGame) => g.title !== 'Unknown')
}

// Parses a BGG collection CSV export into the same BGGGame shape
export function parseCollectionCSV(csvText: string): BGGGame[] {
  const result = Papa.parse(csvText, { header: true, skipEmptyLines: true })
  const rows = result.data as Record<string, string>[]

  return rows
    .filter(row => row.own === '1')
    .filter(row => row.subtype !== 'boardgameexpansion') // exclude expansions
    .map(row => ({
      bggId: row.objectid ?? '',
      title: row.objectname ?? 'Unknown',
      imageUrl: row.thumbnail ?? '',
      description: '',
      minPlayers: Number(row.minplayers) || 1,
      maxPlayers: Number(row.maxplayers) || 99,
      playTime: Number(row.playingtime) || 0,
      complexity: Number(row.averageweight) || 0,
    }))
    .filter(g => g.bggId && g.title !== 'Unknown')
}
