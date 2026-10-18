import { useEffect, useLayoutEffect, useState } from 'react'
import { setAdIneligible } from '../../app/adEligibility'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { PageHeader, SectionCard } from '../../components/ui'
import { UtilityPage } from '../../components/UtilitySurface'
import { ToolGuideWrapper } from '../../components/ToolGuideWrapper'
import type { TranslationResources } from '../../i18n/resources'
import { loadCalendar, isOld, venues, type Venue, type CalendarView } from './loadCalendar'
import { dateCopyKeys, dateDescriptions, displayClock, formatLastUpdated, koreaSessionRange, officialSources, sessionNameKey, sortSessions } from './calendarDisplay'
import { calendarSelectionSearch, moveCalendarSelection, readCalendarSelection, type CalendarSelection } from './calendarSelection'
import './market-calendar.css'

export function MarketCalendarPage() {
  const { t, i18n } = useTranslation('features')
  const text = (key: keyof TranslationResources['features']['marketCalendar'], values?: Record<string, string | number>) => t(`marketCalendar.${key}`, values)
  const [view, setView] = useState<CalendarView>({ status: 'loading' })
  const [defaultDate] = useState(() => new Date())
  const [parameters, setParameters] = useSearchParams()
  const selection = readCalendarSelection(parameters, defaultDate)
  const { venue, year: yearChoice, month, day } = selection
  const [reload, setReload] = useState(0)
  // Refresh the elapsed-time warning even when this page stays open.
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(timer)
  }, [])
  useEffect(() => {
    const controller = new AbortController()
    setView({ status: 'loading' })
    void loadCalendar(`${import.meta.env.BASE_URL}data/market-calendar/v1/`, controller.signal)
      .then(result => { if (!controller.signal.aborted) setView(result) })
      .catch(() => { if (!controller.signal.aborted) setView({ status: 'error' }) })
    return () => controller.abort()
  }, [reload])

  const manifest = view.status === 'ready' ? view.manifest : null
  const years = manifest?.files.map(file => file.year) ?? []
  const year = years.includes(yearChoice) ? yearChoice : years[0] ?? yearChoice
  // Commit the public selection to the URL in the same navigation that renders
  // its unavailable marker. The common ad document replacement retains this URL.
  const select = (next: Partial<CalendarSelection>) => setParameters(calendarSelectionSearch({ ...selection, year, ...next }), { replace: true })
  const scope = manifest?.scopes.find(s => s.venue === venue && s.year === year)
  const rows = view.status === 'ready' ? view.rows.filter(r => r.venue === venue && r.date.startsWith(`${year}${String(month).padStart(2, '0')}`)) : []
  const adIneligible = view.status !== 'ready' || !scope?.included || rows.length === 0
  useLayoutEffect(() => {
    setAdIneligible('marketCalendarUnpublished', adIneligible)
    return () => setAdIneligible('marketCalendarUnpublished', false)
  }, [adIneligible])
  const byDay = new Map(rows.map(row => [Number(row.date.slice(6)), row]))
  const selected = byDay.get(day)
  const descriptions = dateDescriptions(selected, text)
  const sources = officialSources(selected?.sources ?? [])
  const updated = manifest ? formatLastUpdated(manifest.created_at, i18n.language) : null
  const warnings = [...new Set([
    (!scope || !scope.included || scope.validity === 'held') ? text('pendingScope') : scope.validity === 'stale' ? text('stale') : null,
    scope && isOld(scope.last_checked_at, now) ? text('old') : null,
  ].filter((value): value is string => Boolean(value)))]
  const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const offset = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  const weekdays = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(i18n.language, { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 0, 4 + i))))
  const monthTitle = new Intl.DateTimeFormat(i18n.language, { year: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1)))

  return <UtilityPage toolId="market-calendar"><div data-ad-unavailable={adIneligible ? true : undefined} className="market-calendar space-y-6">
    <PageHeader eyebrow={text('eyebrow')} title={text('title')} description={text('description')}>
      <button className="mcal-control" onClick={() => {
        setAdIneligible('marketCalendarUnpublished', true)
        setView({ status: 'loading' })
        setReload(n => n + 1)
      }}>{text('reload')}</button>
    </PageHeader>
    {view.status !== 'ready' ? <SectionCard title={text(view.status === 'loading' ? 'loading' : 'missing')}>
      {view.status !== 'loading' && <p>{text(view.status === 'error' ? 'error' : 'empty')}</p>}
    </SectionCard> : <>
      <SectionCard title={text('calendar')}>
        <div className="mcal-controls">
          <label>{text('venue')}<select className="mcal-control" value={venue} onChange={e => select({ venue: e.target.value as Venue })}>
            {venues.map(v => <option key={v} value={v}>{v.toUpperCase()}</option>)}
          </select></label>
        </div>
        {warnings.map(warning => <p key={warning} role="status" className="mcal-warning">{warning}</p>)}
        <p className="mb-3 text-sm text-muted-foreground">{text('localDates')}</p>
        <div className="mcal-nav" role="group" aria-label={text('calendar')}>
          {([-12, -1, 0, 1, 12] as const).map(months => {
            if (months === 0) return <strong key={months} className="mcal-month-title" aria-live="polite" aria-atomic="true">{monthTitle}</strong>
            const next = moveCalendarSelection({ ...selection, year }, months, years)
            const label = text(months === -12 ? 'previousYear' : months === -1 ? 'previousMonth' : months === 1 ? 'nextMonth' : 'nextYear')
            return <button key={months} type="button" className="mcal-control mcal-nav-button" aria-label={label} title={label} disabled={!next} onClick={() => { if (next) select(next) }}>
              <span aria-hidden="true">{months === -12 ? '«' : months === -1 ? '‹' : months === 1 ? '›' : '»'}</span>
            </button>
          })}
        </div>
        <table className="mcal-grid">
          <caption>{venue.toUpperCase()} · {year}-{String(month).padStart(2, '0')}</caption>
          <thead><tr>{weekdays.map((label, i) => <th scope="col" key={i}>{label}</th>)}</tr></thead>
          <tbody>{Array.from({ length: Math.ceil((offset + count) / 7) }, (_, week) => <tr key={week}>
            {Array.from({ length: 7 }, (_, column) => {
              const d = week * 7 + column - offset + 1
              const row = byDay.get(d)
              return <td key={column}>{d > 0 && d <= count && <button
                className={`mcal-day mcal-${row?.status ?? 'missing'}`} aria-pressed={d === day}
                aria-label={`${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')} ${text(row?.status ?? 'missing')}`}
                onClick={() => select({ day: d })}><strong>{d}</strong><span>{text(!row ? 'missingShort' : row.status === 'unknown' ? 'unknownShort' : row.status)}</span>{row && dateCopyKeys(row).length > 0 && <span className="mcal-special">•</span>}</button>}</td>
            })}
          </tr>)}</tbody>
        </table>
      </SectionCard>
      <SectionCard title={`${date} · ${venue.toUpperCase()}`}>
        <div aria-live="polite" className="space-y-4 mcal-detail">
          {descriptions.map((description, i) => <p key={description} className={i === 0 ? 'font-bold' : undefined}>{description}</p>)}
          {selected && <>
            {selected.status === 'open' && selected.sessions.length > 0 && <><h3>{text('sessions')} · {text(venue === 'nyse' || venue === 'nasdaq' ? 'newYorkTime' : 'koreaTime')}</h3>
            <ul className="space-y-2">{sortSessions(selected.sessions).map((s, i) => {
              const nameKey = sessionNameKey(venue, s.code)
              const korea = koreaSessionRange(selected.date, s, i18n.language)
              return <li key={i}>
                <strong>{text(nameKey ?? 'otherSession')}</strong> · {displayClock(s.start)}–{displayClock(s.end)}
                {korea && <span className="block text-sm text-muted-foreground">{text('koreaTime')} · {korea}</span>}
              </li>
            })}</ul></>}
            {sources.length > 0 && <div className="space-y-2">
              <a href={sources[0].url} target="_blank" rel="noopener noreferrer">{text('sources')} ↗</a>
              <details><summary>{text('quote')}</summary><blockquote>{sources[0].quotes[0]}</blockquote></details>
              {sources.length > 1 && <details><summary>{text('moreSources')}</summary><ul>{sources.slice(1).map((source, i) => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{text('sourceNumber', { number: i + 2 })} ↗</a></li>)}</ul></details>}
            </div>}
          </>}
        </div>
      </SectionCard>
      {updated && <p className="mcal-metadata text-sm text-muted-foreground"><time dateTime={manifest!.created_at}>{text('updated', { time: updated })}</time></p>}
    </>}
    <ToolGuideWrapper slug="market-calendar" />
  </div></UtilityPage>
}
