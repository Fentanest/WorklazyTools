import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader, SectionCard } from '../../components/ui'
import { ToolGuideWrapper } from '../../components/ToolGuideWrapper'
import type { TranslationResources } from '../../i18n/resources'
import { loadCalendar, isOld, sourceHref, venues, type Venue, type CalendarView } from './loadCalendar'
import './market-calendar.css'

export function MarketCalendarPage() {
  const { t, i18n } = useTranslation('features')
  const text = (key: keyof TranslationResources['features']['marketCalendar']) => t(`marketCalendar.${key}`)
  const [view, setView] = useState<CalendarView>({ status: 'loading' })
  const [venue, setVenue] = useState<Venue>('krx')
  const [yearChoice, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [day, setDay] = useState(1)
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
  const scope = manifest?.scopes.find(s => s.venue === venue && s.year === year)
  const rows = view.status === 'ready' ? view.rows.filter(r => r.venue === venue && r.date.startsWith(`${year}${String(month).padStart(2, '0')}`)) : []
  const byDay = new Map(rows.map(row => [Number(row.date.slice(6)), row]))
  const selected = byDay.get(day)
  const date = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const count = new Date(Date.UTC(year, month, 0)).getUTCDate()
  const offset = new Date(Date.UTC(year, month - 1, 1)).getUTCDay()
  const weekdays = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(i18n.language, { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 0, 4 + i))))

  return <div className="market-calendar space-y-6">
    <PageHeader eyebrow={text('eyebrow')} title={text('title')} description={text('description')}>
      <button className="mcal-control" onClick={() => setReload(n => n + 1)}>{text('reload')}</button>
    </PageHeader>
    {view.status !== 'ready' ? <SectionCard title={text(view.status === 'loading' ? 'loading' : 'missing')}>
      {view.status !== 'loading' && <p>{text(view.status === 'error' ? 'error' : 'empty')}</p>}
    </SectionCard> : <>
      <SectionCard title={text('calendar')}>
        <div className="mcal-controls">
          <label>{text('venue')}<select className="mcal-control" value={venue} onChange={e => setVenue(e.target.value as Venue)}>
            {venues.map(v => <option key={v} value={v}>{v.toUpperCase()}</option>)}
          </select></label>
          <label>{text('year')}<select className="mcal-control" value={year} onChange={e => { setYear(Number(e.target.value)); setDay(1) }}>
            {years.map(y => <option key={y}>{y}</option>)}
          </select></label>
          <label>{text('month')}<select className="mcal-control" value={month} onChange={e => { setMonth(Number(e.target.value)); setDay(1) }}>
            {Array.from({ length: 12 }, (_, i) => <option key={i} value={i + 1}>{i + 1}</option>)}
          </select></label>
        </div>
        {scope && scope.validity !== 'valid' && <p role="status" className="mcal-warning">{text(scope.validity)} · {scope.reason}</p>}
        {scope && isOld(scope.last_checked_at, now) && <p role="status" className="mcal-warning">{text('old')}</p>}
        {(!scope || !scope.included) && <p role="status" className="mcal-warning">{text('missingScope')}</p>}
        <p className="mb-3 text-sm text-muted-foreground">{text('localDates')} · {text('open')} / {text('closed')} / {text('unknown')}</p>
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
                onClick={() => setDay(d)}><strong>{d}</strong><span>{text(row?.status ?? 'missing')}</span>{row?.special && <span className="mcal-special">•</span>}</button>}</td>
            })}
          </tr>)}</tbody>
        </table>
      </SectionCard>
      <SectionCard title={`${date} · ${venue.toUpperCase()}`}>
        <div aria-live="polite" className="space-y-4 mcal-detail">
          <p className="font-bold">{text(selected?.status ?? 'missing')}</p>
          {selected && <>
            {selected.special && <p>{text('special')}: {selected.special}</p>}
            {selected.reason && <p>{text('reason')}: {selected.reason}</p>}
            <h3>{text('sessions')}</h3>
            {selected.sessions.length ? <ul>{selected.sessions.map((s, i) => <li key={i}>
              <strong>{s.code}</strong> · {s.start}–{s.end} ({s.tz})
            </li>)}</ul> : <p>{text('noSessions')}</p>}
            {selected.notes.length > 0 && <div><h3>{text('notes')}</h3><ul>{selected.notes.map((note, i) => <li key={i}>{note}</li>)}</ul></div>}
            <h3>{text('sources')}</h3>
            {selected.sources.length ? <ul className="space-y-2">{selected.sources.map((source, i) => <li key={i}>
              {sourceHref(source.url) ? <a href={sourceHref(source.url)} target="_blank" rel="noopener noreferrer">{source.id} ↗</a> : <span>{source.id} · {source.url}</span>}
              <details><summary>{text('quote')}</summary><blockquote>{source.quote}</blockquote></details>
            </li>)}</ul> : <p>{text('noSources')}</p>}
          </>}
        </div>
      </SectionCard>
      <div className="mcal-metadata text-sm text-muted-foreground">
        <p>{text('published')}: <time dateTime={view.manifest.created_at}>{view.manifest.created_at}</time></p>
        <p>{text('generation')}: {view.manifest.generation_id}</p>
        <p>{text('checked')}: {scope?.last_checked_at ?? text('missing')}</p>
      </div>
    </>}
    <ToolGuideWrapper slug="market-calendar" />
  </div>
}
