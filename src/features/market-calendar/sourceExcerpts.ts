import { matchesSourceExcerptSchema } from './sourceExcerptSchema.ts'
import names from './krxRuleNames.json' with { type: 'json' }

export const KRX_RULES_HOME = 'https://rule.krx.co.kr/out/index.do'
export interface RuleExcerpt { article: string; text: string }
export interface SavedRule {
  id: string; bookid: string; title: string; fetched_at: string
  raw_sha256: string; text_sha256: string; representation: 'original' | 'session_redacted'
  excerpts: RuleExcerpt[]
}
export interface SourceCatalog { schema_version: 1; generation_id: string; sources: SavedRule[] }
const hash = (value: unknown): value is string => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value)
export const fallbackRule = (id: string) => (names as Record<string, { title: string; bookid: string }>)[id]
export function isKrxRule(url: string) {
  try { const parsed = new URL(url); return parsed.protocol === 'https:' && parsed.hostname === 'rule.krx.co.kr' }
  catch { return false }
}
export function citedArticles(quotes: string[]) {
  return [...new Set(quotes.flatMap(quote => quote.match(/^제[0-9]+조(?:의[0-9]+)?\([^\n)]+\)/gm) ?? []))]
}
export function savedExcerpts(rule: SavedRule | undefined, quotes: string[]) {
  return rule?.excerpts.filter(excerpt => quotes.some(quote => quote.trim() && excerpt.text.includes(quote))) ?? []
}
export function validCatalog(value: unknown, generation: string): value is SourceCatalog {
  if (!matchesSourceExcerptSchema(value)) return false
  const catalog = value as SourceCatalog
  return catalog.generation_id === generation &&
    new Set(catalog.sources.map(source => source.id)).size === catalog.sources.length &&
    catalog.sources.every(source => source.id.endsWith(`-${source.bookid}`) &&
      new Set(source.excerpts.map(excerpt => excerpt.article)).size === source.excerpts.length &&
      source.excerpts.every(excerpt => /^제[0-9]+조(?:의[0-9]+)?\([^\n)]+\)$/.test(excerpt.article) && excerpt.text.startsWith(excerpt.article)))
}

// Optional availability has no effect on calendar validity or its existing reader.
export async function loadSourceExcerpts(root: string, generation: string, signal?: AbortSignal): Promise<SourceCatalog | null> {
  try {
    const checksum = await fetch(`${root}sources-v1.sha256`, { cache: 'no-store', signal })
    if (!checksum.ok) return null
    const checksumText = await checksum.text()
    if (checksumText.length > 128 || !hash(checksumText.trim())) return null
    const response = await fetch(`${root}sources-v1.json`, { cache: 'no-store', signal })
    if (!response.ok || Number(response.headers.get('content-length')) > 512 * 1024) return null
    const bytes = await response.arrayBuffer()
    if (bytes.byteLength > 512 * 1024) return null
    const digest = await crypto.subtle.digest('SHA-256', bytes)
    const actual = [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')
    if (actual !== checksumText.trim()) return null
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes))
    return validCatalog(value, generation) ? value : null
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    return null
  }
}
