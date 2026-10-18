export const venues = ['krx', 'nxt', 'nyse', 'nasdaq'] as const
export type Venue = typeof venues[number]
export type CalendarStatus = 'open' | 'closed' | 'unknown'
export interface CalendarRow {
  date: string
  venue: Venue
  status: CalendarStatus
  sessions: { code: string; start: string; end: string; tz: string }[]
  special: string | null
  sources: { id: string; url: string; quote: string }[]
  reason: string | null
  notes: string[]
}
export interface CalendarManifest {
  schema_version: 1
  generation_id: string
  created_at: string
  files: { path: string; year: number; sha256: string }[]
  scopes: { venue: Venue; year: number; included: boolean; validity: 'valid' | 'stale' | 'held'; last_checked_at: string; reason: string | null }[]
}
export type CalendarView = { status: 'loading' | 'missing' | 'error' } |
  { status: 'ready'; manifest: CalendarManifest; rows: CalendarRow[] }

const record = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null
const timestamp = (v: unknown): v is string => typeof v === 'string' && Number.isFinite(Date.parse(v))
const nullableText = (v: unknown) => v === null || typeof v === 'string'
const venue = (v: unknown) => venues.includes(v as Venue)
export const isOld = (checkedAt: string, now = Date.now()) => now - Date.parse(checkedAt) > 48 * 60 * 60 * 1000
export const sourceHref = (url: string) => /^https?:\/\//.test(url) ? url : undefined

function validManifest(v: unknown): v is CalendarManifest {
  return record(v) && v.schema_version === 1 && typeof v.generation_id === 'string' && timestamp(v.created_at) &&
    Array.isArray(v.files) && v.files.length > 0 && v.files.every(f => record(f) && Number.isInteger(f.year) &&
      f.path === `calendar-${f.year}.json` && typeof f.sha256 === 'string' && /^[a-f0-9]{64}$/.test(f.sha256)) &&
    new Set(v.files.map(f => f.year)).size === v.files.length &&
    Array.isArray(v.scopes) && v.scopes.every(s => record(s) && venue(s.venue) && Number.isInteger(s.year) &&
      typeof s.included === 'boolean' && ['valid', 'stale', 'held'].includes(String(s.validity)) &&
      timestamp(s.last_checked_at) && nullableText(s.reason))
}

function validRows(v: unknown, year: number): v is CalendarRow[] {
  return Array.isArray(v) && v.every(r => record(r) && typeof r.date === 'string' &&
    new RegExp(`^${year}\\d{4}$`).test(r.date) && venue(r.venue) && ['open', 'closed', 'unknown'].includes(String(r.status)) &&
    nullableText(r.special) && nullableText(r.reason) && Array.isArray(r.notes) && r.notes.every(n => typeof n === 'string') &&
    Array.isArray(r.sessions) && r.sessions.every(s => record(s) && ['code', 'start', 'end', 'tz'].every(k => typeof s[k] === 'string')) &&
    Array.isArray(r.sources) && r.sources.every(s => record(s) && typeof s.id === 'string' &&
      typeof s.url === 'string' && typeof s.quote === 'string'))
}

// Formatting only: no holiday, session, or status decisions belong in this reader.
export async function loadCalendar(root: string, signal?: AbortSignal): Promise<CalendarView> {
  try {
    const response = await fetch(`${root}manifest.json`, { cache: 'no-store', signal })
    if (response.status === 404) return { status: 'missing' }
    if (!response.ok) return { status: 'error' }
    const manifest: unknown = await response.json()
    if (!validManifest(manifest)) return { status: 'error' }
    const years = await Promise.all(manifest.files.map(async file => {
      const response = await fetch(`${root}${file.path}`, { cache: 'no-store', signal })
      if (!response.ok) throw new Error('Unavailable calendar')
      const bytes = await response.arrayBuffer()
      const digest = await crypto.subtle.digest('SHA-256', bytes)
      const hash = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('')
      if (hash !== file.sha256) throw new Error('Invalid calendar')
      const rows: unknown = JSON.parse(new TextDecoder().decode(bytes))
      if (!validRows(rows, file.year)) throw new Error('Invalid calendar')
      return rows
    }))
    return { status: 'ready', manifest, rows: years.flat() }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    return { status: 'error' }
  }
}
