import { DateTime } from 'luxon'
import { sourceHref, type CalendarRow, type Venue } from './loadCalendar.ts'
import type { TranslationResources } from '../../i18n/resources.ts'
import publicationCopy from './publicationCopy.json' with { type: 'json' }

export type CalendarTextKey = keyof TranslationResources['features']['marketCalendar']
const normalizeCopy = (value: string) => value.normalize('NFC').replace(/[‘’]/g, "'").replace(/\s+/g, ' ').trim().toLowerCase()
const exactCopy = Object.fromEntries(Object.entries(publicationCopy.exact).map(([value, key]) => [normalizeCopy(value), key])) as Record<string, CalendarTextKey | null>
const prefixCopy = Object.entries(publicationCopy.prefix).map(([prefix, key]) => [normalizeCopy(prefix), key] as [string, CalendarTextKey | null])
const patternCopy = publicationCopy.patterns.map(({ pattern, key }) => [new RegExp(pattern, 'iu'), key] as [RegExp, CalendarTextKey | null])

// null is an explicit decision to hide a publisher-process record. undefined
// means it has not been reviewed; publication coverage must reject that case.
export function publicationTextKey(value: string): CalendarTextKey | null | undefined {
  const normalized = normalizeCopy(value)
  if (Object.hasOwn(exactCopy, normalized)) return exactCopy[normalized]
  const prefix = prefixCopy.find(([prefix]) => normalized.startsWith(prefix))
  if (prefix) return prefix[1]
  if (normalized.startsWith('특수일:')) return publicationTextKey(normalized.slice(4).trim())
  return patternCopy.find(([pattern]) => pattern.test(normalized))?.[1]
}
export const hasPublicationTextMapping = (value: string) => publicationTextKey(value) !== undefined

type Translate = (key: CalendarTextKey, values?: Record<string, string | number>) => string
export const displayClock = (value: string) => value.replace(/^(\d{2}:\d{2}):00$/, '$1')

export function dateCopyKeys(row: CalendarRow): CalendarTextKey[] {
  if (row.status === 'unknown') return []
  const keys = [row.special, row.reason, ...row.notes].filter((v): v is string => Boolean(v)).map(publicationTextKey).filter((v): v is CalendarTextKey => typeof v === 'string')
  if (row.status === 'closed' && row.sources.some(source => source.url === 'urn:market-calendar:rule:weekend')) keys.push('weekend')
  return [...new Set(keys)].filter(key => row.status === 'open' || !['earlyClose', 'noPreMarket', 'yearOpen'].includes(key))
}

export function dateDescriptions(row: CalendarRow | undefined, text: Translate): string[] {
  if (!row || row.status === 'unknown') return [text('unknown')]
  const keys = dateCopyKeys(row)
  const descriptions = keys.flatMap(key => {
    if (key === 'earlyClose') {
      if (row.status !== 'open') return []
      const end = row.sessions.find(s => s.code === 'regular' || s.code === 'main')?.end
      const zone = text(row.venue === 'nyse' || row.venue === 'nasdaq' ? 'newYorkTime' : 'koreaTime')
      return [end ? text('earlyCloseAt', { time: displayClock(end), zone }) : text('earlyClose')]
    }
    if (key === 'noPreMarket' && row.status !== 'open') return []
    const reason = text(key)
    return [row.status === 'closed' && key !== 'yearOpen' ? text('closedFor', { reason }) : reason]
  })
  return descriptions.length ? [...new Set(descriptions)] : [text(row.status === 'closed' ? 'closedDetail' : 'openDetail')]
}

export function formatLastUpdated(value: string, language: string): string | null {
  const date = DateTime.fromISO(value, { setZone: true }).setZone('Asia/Seoul').setLocale(language.startsWith('ko') ? 'ko' : 'en')
  if (!date.isValid) return null
  return language.startsWith('ko') ? date.toFormat('yyyy년 M월 d일 a h:mm') + ' (한국 시간)' : date.toFormat("MMM d, yyyy, h:mm a 'KST'")
}

export function koreaSessionRange(date: string, session: CalendarRow['sessions'][number], language: string): string | null {
  if (session.tz === 'Asia/Seoul') return null
  const isoDate = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`
  const start = DateTime.fromISO(`${isoDate}T${session.start}`, { zone: session.tz })
  let end = DateTime.fromISO(`${isoDate}T${session.end}`, { zone: session.tz })
  if (!start.isValid || !end.isValid) return null
  if (end < start) end = end.plus({ days: 1 })
  const precision = start.second || end.second ? 'HH:mm:ss' : 'HH:mm'
  const ko = language.startsWith('ko'), pattern = ko ? `M월 d일 ${precision}` : `MMM d, ${precision}`
  const from = start.setZone('Asia/Seoul').setLocale(ko ? 'ko' : 'en'), to = end.setZone('Asia/Seoul').setLocale(ko ? 'ko' : 'en')
  return `${from.toFormat(pattern)}–${to.toFormat(from.hasSame(to, 'day') ? precision : pattern)}`
}

export function officialSources(sources: CalendarRow['sources']) {
  const result = new Map<string, { url: string; quotes: string[] }>()
  for (const source of sources) {
    const url = sourceHref(source.url)
    if (!url) continue
    const item = result.get(url) ?? { url, quotes: [] }
    if (!item.quotes.includes(source.quote)) item.quotes.push(source.quote)
    result.set(url, item)
  }
  return [...result.values()]
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
