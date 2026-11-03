import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { TranslationResources } from '../../i18n/resources'
import type { CalendarRow } from './loadCalendar'
import { groupSources, officialSources } from './calendarDisplay'
import { citedArticles, fallbackRule, isKrxRule, KRX_RULES_HOME, savedExcerpts, type SourceCatalog } from './sourceExcerpts'

function useSourceText() {
  const { t } = useTranslation('features')
  return (key: keyof TranslationResources['features']['marketCalendar'], values?: Record<string, string | number>) => t(`marketCalendar.${key}`, values)
}
function RuleSource({ source, catalog }: { source: ReturnType<typeof groupSources>[number]; catalog: SourceCatalog | null }) {
  const text = useSourceText()
  const saved = catalog?.sources.find(rule => rule.id === source.id)
  const name = saved?.title ?? fallbackRule(source.id)?.title ?? text('unknownRuleName')
  const excerpts = savedExcerpts(saved, source.quotes)
  const articles = [...new Set([...citedArticles(source.quotes), ...excerpts.map(excerpt => excerpt.article)])]
  const revision = source.quotes.find(quote => quote.startsWith('[') && quote.length <= 300)
  const reference = `${name} · ${articles.length ? articles.join(' · ') : revision ?? text('revisionReference')}`
  const [copy, setCopy] = useState<{ reference: string; ok: boolean } | null>(null)
  return <div className="mcal-rule-source space-y-2">
    <p lang="ko" data-mcal-original="true" className="font-semibold break-words">{reference}</p>
    <p className="text-sm text-muted-foreground">{text('krxFind')}</p>
    <div className="flex flex-wrap items-center gap-3">
      <a href={KRX_RULES_HOME} target="_blank" rel="noopener noreferrer">{text('krxService')} ↗</a>
      <button type="button" className="mcal-control" aria-label={text('copyReferenceLabel', { reference })} onClick={async () => {
        try { await navigator.clipboard.writeText(reference); setCopy({ reference, ok: true }) }
        catch { setCopy({ reference, ok: false }) }
      }}>{text('copyReference')}</button>
    </div>
    {copy?.reference === reference && <p role="status" className="text-sm">{text(copy.ok ? 'referenceCopied' : 'referenceCopyFailed')}</p>}
    {saved && excerpts.length > 0 && <details>
      <summary>{text('savedCopy')}</summary>
      <div className="mcal-saved-copy space-y-3 py-3">
        <p className="text-sm text-muted-foreground">{text('originalText')}</p>
        <dl className="space-y-1 text-sm">
          <div><dt>{text('bookId')}</dt><dd>{saved.bookid}</dd></div>
          <div><dt>{text('collectedAt')}</dt><dd><time dateTime={saved.fetched_at}>{saved.fetched_at}</time></dd></div>
          <div><dt>{text('savedHash')}</dt><dd><code className="break-all">{saved.raw_sha256}</code></dd></div>
        </dl>
        {saved.representation === 'session_redacted' && <p className="text-sm text-muted-foreground">{text('redactedCopy')}</p>}
        {excerpts.map(excerpt => <section key={excerpt.article}>
          <h4 lang="ko" data-mcal-original="true" className="font-semibold">{excerpt.article}</h4>
          <pre lang="ko" data-mcal-original="true" className="whitespace-pre-wrap break-words text-sm font-sans">{excerpt.text}</pre>
        </section>)}
      </div>
    </details>}
  </div>
}
function NormalSource({ source }: { source: ReturnType<typeof officialSources>[number] }) {
  const text = useSourceText()
  return <div>
    <a href={source.url} target="_blank" rel="noopener noreferrer">{text('sources')} ↗</a>
    <details><summary>{text('quote')}</summary><blockquote data-mcal-original="true">{source.quotes[0]}</blockquote></details>
  </div>
}
export function CalendarSources({ sources, catalog }: { sources: CalendarRow['sources']; catalog: SourceCatalog | null }) {
  const text = useSourceText()
  const rules = groupSources(sources.filter(source => isKrxRule(source.url)))
  const normal = officialSources(sources.filter(source => !isKrxRule(source.url)))
  const items = [
    ...rules.map(source => <RuleSource key={source.id} source={source} catalog={catalog} />),
    ...normal.map(source => <NormalSource key={source.url} source={source} />),
  ]
  if (!items.length) return null
  return <div className="mcal-sources space-y-3">
    {items[0]}
    {items.length > 1 && <details><summary>{text('moreSources')}</summary>
      <ul className="space-y-4 py-3">{items.slice(1).map((item, i) => <li key={i}>{item}</li>)}</ul>
    </details>}
  </div>
}
