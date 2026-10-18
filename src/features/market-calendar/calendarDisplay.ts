import type { CalendarRow, Venue } from './loadCalendar.ts'

// Display transformations only; keep the published rows unchanged.
export function sortSessions(sessions: CalendarRow['sessions']) {
  return [...sessions].sort((a, b) => a.start.localeCompare(b.start))
}

export function groupSources(sources: CalendarRow['sources']) {
  const groups = new Map<string, { id: string; url: string; quotes: string[] }>()
  for (const source of sources) {
    const group = groups.get(source.id)
    if (!group) groups.set(source.id, { id: source.id, url: source.url, quotes: [source.quote] })
    else if (!group.quotes.includes(source.quote)) group.quotes.push(source.quote)
  }
  return [...groups.values()]
}

type SessionNameKey = 'openingAuction' | 'regularSession' | 'closingAuction' | 'preMarket' | 'mainMarket' | 'afterMarket'
const sessionNames: Partial<Record<string, SessionNameKey>> = {
  'krx:opening_auction': 'openingAuction',
  'krx:regular': 'regularSession',
  'krx:closing_auction': 'closingAuction',
  'nxt:pre': 'preMarket',
  'nxt:main': 'mainMarket',
  'nxt:after': 'afterMarket',
  'nyse:regular': 'regularSession',
  'nasdaq:regular': 'regularSession',
}

export const sessionNameKey = (venue: Venue, code: string) => sessionNames[`${venue}:${code}`]
