import type { CalendarRow, Venue } from './loadCalendar.ts'
import type { TranslationResources } from '../../i18n/resources.ts'
import publicationCopy from './publicationCopy.json' with { type: 'json' }

type CalendarTextKey = keyof TranslationResources['features']['marketCalendar']
const exactCopy = publicationCopy.exact as Record<string, CalendarTextKey>
const prefixCopy = Object.entries(publicationCopy.prefix) as [string, CalendarTextKey][]

// Translate publisher wording only. Never infer or override a published status.
// Unknown future wording uses a localized notice instead of leaking internal codes.
export function publicationTextKey(value: string): CalendarTextKey {
  return (Object.hasOwn(exactCopy, value) ? exactCopy[value] : undefined) ??
    prefixCopy.find(([prefix]) => value.startsWith(prefix))?.[1] ?? 'publicationUntranslated'
}

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
