import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UtilityInput, UtilitySelect } from '../../components/UtilitySurface';
import { planVacation, seoulToday, shiftBusinessDate, workDayClassifier } from './workCalculator';
import { addIsoDays, dateOrdinal, weekday } from './workDate';
import type { VacationEntry, WorkLanguage } from './workCalculatorTypes';

export function WorkMonthCalendar({ start, end, custom, language }: { start: string; end: string; custom: string[]; language: WorkLanguage }) {
  const { t } = useTranslation('features');
  const [chosenMonth, setChosenMonth] = useState('');
  const [selected, setSelected] = useState('');
  const month = chosenMonth || start.slice(0,7);
  const classify = useMemo(() => workDayClassifier(custom,language),[custom,language]);
  const first = `${month}-01`, year = Number(month.slice(0,4)), m = Number(month.slice(5,7));
  const size = new Date(Date.UTC(year,m,0)).getUTCDate();
  const dates = Array.from({length:size},(_,index) => addIsoDays(first,index));
  const selection = selected && selected.startsWith(month) ? selected : first;
  const status = classify(selection);
  const move = (delta: number) => { const date = new Date(Date.UTC(year,m-1+delta,1)); const next = date.toISOString().slice(0,7); if (next >= '2000-01' && next <= '2050-12') { setChosenMonth(next); setSelected(''); } };
  return <section className="work-panel work-calendar" data-testid="work-calendar">
    <div className="work-panel-heading"><h2>{t('work.calendar')}</h2><div className="work-calendar-nav">
      <button type="button" onClick={() => move(-1)} disabled={month <= '2000-01'} aria-label={t('work.previousMonth')}>‹</button>
      <label className="work-sr-only" htmlFor="work-month">{t('work.calendarMonth')}</label><UtilityInput id="work-month" type="month" min="2000-01" max="2050-12" value={month} onChange={event => { if (/^\d{4}-\d{2}$/.test(event.target.value) && event.target.value >= '2000-01' && event.target.value <= '2050-12') { setChosenMonth(event.target.value); setSelected(''); } }} />
      <button type="button" onClick={() => move(1)} disabled={month >= '2050-12'} aria-label={t('work.nextMonth')}>›</button>
    </div></div>
    <p className="work-help">{t('work.calendarHelp')}</p>
    <div className="work-calendar-scroll"><div className="work-calendar-grid">{Array.from({length:7},(_,index) => <span className="work-weekday" key={`weekday-${index}`}>{new Intl.DateTimeFormat(language,{weekday:'short',timeZone:'UTC'}).format(new Date((dateOrdinal('2026-01-04')+index)*86400000))}</span>)}
      {Array.from({length:weekday(dateOrdinal(first))},(_,index) => <span key={`blank-${index}`} />)}
      {dates.map(date => { const day = classify(date), inRange = date >= start && date <= end; return <button key={date} type="button" className={`${day.business ? 'is-business' : 'is-excluded'} ${inRange ? 'is-in-range' : ''}`} aria-pressed={selection === date} aria-label={`${date}: ${day.business ? t('work.business') : day.reasons.join(' · ')}${inRange ? ` · ${t('work.inPeriod')}` : ''}`} onClick={() => setSelected(date)}><time dateTime={date}>{Number(date.slice(8))}</time><small>{day.customHoliday ? t('work.customShort') : day.publicHoliday ? t('work.publicShort') : day.weekend ? t('work.weekendShort') : ''}</small></button>; })}
    </div></div>
    <p className="work-calendar-selection" role="status"><strong>{selection}</strong> · {status.business ? t('work.workingDate') : status.reasons.join(' · ')}{selection < start || selection > end ? ` · ${t('work.outsidePeriod')}` : ''}</p>
  </section>;
}

export function WorkPlanningPanels({ custom, language }: { custom: string[]; language: WorkLanguage }) {
  const { t } = useTranslation('features');
  const [anchor,setAnchor] = useState(seoulToday), [count,setCount] = useState('5');
  const [direction,setDirection] = useState<'before'|'after'>('after'), [include,setInclude] = useState(false);
  const [date,setDate] = useState(seoulToday), [units,setUnits] = useState<1|0.5>(1), [entries,setEntries] = useState<VacationEntry[]>([]), [entryError,setEntryError] = useState('');
  const offset = useMemo(() => { try { if (!/^\d+$/.test(count)) throw new Error(); return {date:shiftBusinessDate(anchor,Number(count),direction,include,custom,language),error:''}; } catch { return {date:'',error:t('work.offsetError')}; } },[anchor,count,direction,include,custom,language,t]);
  const vacation = useMemo(() => planVacation(entries,custom,language),[entries,custom,language]);
  const add = () => { try { planVacation([{date,units}],custom,language); setEntries(previous => [...previous.filter(entry => entry.date !== date),{date,units}]); setEntryError(''); } catch { setEntryError(t('work.vacationError')); } };
  return <div className="work-planning-grid">
    <section className="work-panel" data-testid="work-offset"><h2>{t('work.offsetTitle')}</h2><p className="work-help">{t('work.offsetHelp')}</p>
      <div className="work-planner-fields"><div className="work-date-field"><label htmlFor="work-anchor">{t('work.anchor')}</label><UtilityInput id="work-anchor" type="date" min="2000-01-01" max="2050-12-31" value={anchor} onChange={event => setAnchor(event.target.value)} /></div>
      <div className="work-date-field"><label htmlFor="work-offset-count">{t('work.businessCount')}</label><UtilityInput id="work-offset-count" type="number" min="0" max="18628" step="1" value={count} onChange={event => setCount(event.target.value)} /></div>
      <div className="work-date-field"><label htmlFor="work-direction">{t('work.direction')}</label><UtilitySelect id="work-direction" value={direction} onChange={event => setDirection(event.target.value as 'before'|'after')}><option value="after">{t('work.after')}</option><option value="before">{t('work.before')}</option></UtilitySelect></div></div>
      <label className="work-checkbox"><input type="checkbox" checked={include} onChange={event => setInclude(event.target.checked)} />{t('work.includeStart')}</label><p className="work-help">{t('work.includeStartHelp')}</p>
      <p className={offset.error ? 'work-field-error' : 'work-planner-result'} role="status">{offset.error || `${t('work.targetDate')}: ${offset.date}`}</p>
    </section>
    <section className="work-panel" data-testid="work-vacation"><h2>{t('work.vacationTitle')}</h2><p className="work-help">{t('work.vacationHelp')}</p>
      <div className="work-planner-fields"><div className="work-date-field"><label htmlFor="work-vacation-date">{t('work.vacationDate')}</label><UtilityInput id="work-vacation-date" type="date" min="2000-01-01" max="2050-12-31" value={date} onChange={event => setDate(event.target.value)} /></div>
      <div className="work-date-field"><label htmlFor="work-vacation-unit">{t('work.vacationUnit')}</label><UtilitySelect id="work-vacation-unit" value={units} onChange={event => setUnits(Number(event.target.value) as 1|0.5)}><option value="1">{t('work.fullDay')}</option><option value="0.5">{t('work.halfDay')}</option></UtilitySelect></div><button type="button" className="work-add-button" onClick={add}>{t('work.add')}</button></div>
      {entryError && <p className="work-field-error" role="alert">{entryError}</p>}
      <ul className="work-vacation-list">{vacation.entries.map(entry => <li key={entry.date}><div><strong>{entry.date}</strong> · {t(entry.units === 1 ? 'work.fullDay' : 'work.halfDay')}<small>{t('work.neededEntry',{days:entry.needed})}{entry.reasons.length ? ` · ${entry.reasons.join(' · ')}` : ''}</small></div><button type="button" aria-label={t('work.removeDate',{date:entry.date})} onClick={() => setEntries(entries.filter(item => item.date !== entry.date))}>×</button></li>)}</ul>
      <p className="work-planner-result" role="status">{t('work.vacationSummary',{needed:vacation.needed,rest:vacation.longestRest})}</p>
      {vacation.restPeriods.map(period => <p className="work-help" key={period.start}>{period.start} – {period.end} · {t('work.restDays',{days:period.days})}</p>)}
      {vacation.rangeLimited && <p className="work-help">{t('work.restRangeLimited')}</p>}<p className="work-help">{t('work.halfDayNote')}</p>
    </section>
    <p className="work-help work-local-note">{t('work.localPlanning')}</p>
  </div>;
}
