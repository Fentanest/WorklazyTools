import type { CalendarRow, Venue } from './loadCalendar.ts'
import type { TranslationResources } from '../../i18n/resources.ts'
import publicationCopy from './publicationCopy.json' with { type: 'json' }

type CalendarTextKey = keyof TranslationResources['features']['marketCalendar']
const normalizeCopy = (value: string) => value.normalize('NFC').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim()
const exactCopy = Object.fromEntries(Object.entries(publicationCopy.exact).map(([value, key]) => [normalizeCopy(value), key])) as Record<string, CalendarTextKey>
const prefixCopy = Object.entries(publicationCopy.prefix) as [string, CalendarTextKey][]
const patternCopy = publicationCopy.patterns.map(({ pattern, key }) => [new RegExp(pattern, 'u'), key] as [RegExp, CalendarTextKey])
export type PublicationContext = 'special' | 'reason' | 'note' | 'scope'
const contextCopy: Record<PublicationContext, CalendarTextKey> = {
  special: 'specialPublicationDetail', reason: 'reasonPublicationDetail', note: 'notePublicationDetail', scope: 'scopePublicationDetail',
}

function mappedPublicationKey(value: string): CalendarTextKey | undefined {
  const normalized = normalizeCopy(value)
  return (Object.hasOwn(exactCopy, normalized) ? exactCopy[normalized] : undefined) ??
    prefixCopy.find(([prefix]) => normalized.startsWith(prefix))?.[1] ??
    patternCopy.find(([pattern]) => pattern.test(normalized))?.[1]
}

export const hasPublicationTextMapping = (value: string) => mappedPublicationKey(value) !== undefined

// Translate publisher wording only. Never infer or override a published status.
// Future wording keeps a contextual source-reading instruction; never guess a
// holiday/status or display Korean publisher text as English UI copy.
export function publicationTextKey(value: string, context: PublicationContext = 'note'): CalendarTextKey {
  return mappedPublicationKey(value) ?? contextCopy[context]
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
