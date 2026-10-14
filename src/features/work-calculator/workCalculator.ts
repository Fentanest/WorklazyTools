import { getKoreanHolidays } from './koreanHolidays.ts';
import { HOLIDAY_CHECKED_AT, HOLIDAY_MIN_YEAR, HOLIDAY_MAX_YEAR, HOLIDAY_RECORDED_THROUGH } from './holidayData.ts';
import { validateWorkDate, WorkDateError, dateOrdinal, isoFromOrdinal, weekday, addIsoDays, nextPeriodBoundary } from './workDate.ts';
import type { AnnualLeaveResult, BusinessResult, ExcludedDay, LeaveEvent, WorkLanguage, WorkDay, VacationEntry, VacationPlan } from './workCalculatorTypes.ts';
export { getKoreanHolidays } from './koreanHolidays.ts';
export type { KoreanHoliday } from './koreanHolidays.ts';
export { validateWorkDate, parseCustomHolidays, seoulToday, WorkDateError } from './workDate.ts';
export type * from './workCalculatorTypes.ts';

export function calculateBusinessDays(startIso: string, endIso: string, customHolidays: string[] = [], language: WorkLanguage = 'ko'): BusinessResult {
  const start = validateWorkDate(startIso,'start',language), end = validateWorkDate(endIso,'end',language);
  if (start > end) throw new WorkDateError('order','end',endIso,language);
  const holidays = new Map<string,string[]>();
  const addReason = (date: string, reason: string) => {
    if (date < startIso || date > endIso) return;
    const reasons = holidays.get(date) ?? [];
    if (!reasons.includes(reason)) holidays.set(date,[...reasons,reason]);
  };
  const startYear = Number(startIso.slice(0,4)), endYear = Number(endIso.slice(0,4));
  for (let year = startYear; year <= endYear; year++) for (const h of getKoreanHolidays(year,language)) addReason(h.date,h.name);
  for (const date of new Set(customHolidays.filter(Boolean))) {
    validateWorkDate(date,'custom',language); addReason(date,language === 'ko' ? '직접 추가한 휴일' : 'Manually added holiday');
  }
  const total = end - start + 1;
  let excludedCount = Math.floor(total / 7) * 2;
  for (let i = 0; i < total % 7; i++) if ([0,6].includes(weekday(start + i))) excludedCount++;
  for (const date of holidays.keys()) if (![0,6].includes(weekday(dateOrdinal(date)))) excludedCount++;
  const details = (offset: number, limit: number): ExcludedDay[] => {
    const items: ExcludedDay[] = []; let skipped = 0;
    for (let day = start; day <= end && items.length < limit; day++) {
      const weekend = [0,6].includes(weekday(day));
      const date = isoFromOrdinal(day), reasons = holidays.get(date) ?? [];
      if (!weekend && !reasons.length) continue;
      if (skipped++ < offset) continue;
      const all = [...(weekend ? [language === 'ko' ? '주말' : 'Weekend'] : []),...reasons];
      items.push({date,reasons:all,reason:all.join(' · ')});
    }
    return items;
  };
  return {
    total, business: total - excludedCount, excludedCount,
    breakdown: businessBreakdown(startIso,endIso,customHolidays,language),
    holidayInfo: {checkedAt:HOLIDAY_CHECKED_AT,minYear:HOLIDAY_MIN_YEAR,maxYear:HOLIDAY_MAX_YEAR,recordedThrough:HOLIDAY_RECORDED_THROUGH,
      status: startYear > HOLIDAY_RECORDED_THROUGH ? 'projected' : endYear > HOLIDAY_RECORDED_THROUGH ? 'mixed' : 'recorded'},
    get excluded() { return details(0,excludedCount); },
    excludedPage(page = 0, pageSize = 40) {
      const size = Number.isFinite(pageSize) ? Math.max(1,Math.min(100,Math.floor(pageSize))) : 40;
      const pageCount = Math.max(1,Math.ceil(excludedCount / size));
      const index = Number.isFinite(page) ? Math.max(0,Math.min(pageCount - 1,Math.floor(page))) : 0;
      return {items:details(index * size,size),page:index,pageCount};
    },
  };
}

function serviceAt(hire: string, asOf: string) {
  let start = hire, next = nextPeriodBoundary(start,12), years = 0, prior = hire;
  while (next <= asOf) { prior = start; start = next; next = nextPeriodBoundary(start,12); years++; }
  return { years, start, next, prior };
}
function annualDays(years: number) { return Math.min(25,15 + Math.floor(Math.max(0,years - 1) / 2)); }
function yearlyEvent(hire: string, date: string, method: 'hire' | 'fiscal'): LeaveEvent | null {
  if (method === 'hire') {
    const service = serviceAt(hire,date);
    return service.years ? {date:service.start,kind:'annual',days:annualDays(service.years),periodStart:service.prior,periodEnd:addIsoDays(service.start,-1)} : null;
  }
  const fiscalStart = `${date.slice(0,4)}-01-01`, hireYear = Number(hire.slice(0,4)), year = Number(date.slice(0,4));
  if (year === hireYear) return null;
  if (year === hireYear + 1) {
    const numerator = dateOrdinal(fiscalStart) - dateOrdinal(hire);
    const denominator = dateOrdinal(fiscalStart) - dateOrdinal(`${hireYear}-01-01`);
    if (numerator === denominator) return {date:fiscalStart,kind:'annual',days:15,periodStart:hire,periodEnd:`${hireYear}-12-31`};
    return {date:fiscalStart,kind:'prorated',days:15 * numerator / denominator,periodStart:hire,periodEnd:`${hireYear}-12-31`,numerator,denominator};
  }
  return {date:fiscalStart,kind:'annual',days:annualDays(serviceAt(hire,fiscalStart).years),periodStart:`${year-1}-01-01`,periodEnd:`${year-1}-12-31`};
}
export function calculateAnnualLeave(hireIso: string, asOfIso: string, method: 'hire' | 'fiscal', language: WorkLanguage = 'ko'): AnnualLeaveResult {
  const hire = validateWorkDate(hireIso,'hire',language,'leave'), asOf = validateWorkDate(asOfIso,'asOf',language,'leave');
  if (asOf < hire) throw new WorkDateError('order','asOf',asOfIso,language);
  const service = serviceAt(hireIso,asOfIso), firstAnnual = nextPeriodBoundary(hireIso,12);
  const historySupported = hireIso >= '2017-05-30';
  const events: LeaveEvent[] = [], future: LeaveEvent[] = [];
  let periodStart = hireIso;
  if (historySupported) for (let month = 1; month <= 11; month++) {
    const date = nextPeriodBoundary(periodStart,1);
    if (date >= firstAnnual) break;
    const event: LeaveEvent = {date,kind:'monthly',days:1,periodStart,periodEnd:addIsoDays(date,-1)};
    (date <= asOfIso ? events : future).push(event); periodStart = date;
  }
  const annual = yearlyEvent(hireIso,asOfIso,method);
  const nextAnnualDate = method === 'hire' ? service.next : `${Number(asOfIso.slice(0,4))+1}-01-01`;
  const nextAnnual = yearlyEvent(hireIso,nextAnnualDate,method);
  if (nextAnnual) future.push(nextAnnual);
  return {
    method,serviceYears:service.years,
    monthly:{events,total:historySupported ? events.length : null,historySupported,periodStart:hireIso,periodEnd:addIsoDays(firstAnnual,-1)},
    annual,nextEvent:future.sort((a,b) => a.date.localeCompare(b.date))[0] ?? null,
  };
}

/** The same reviewed Korean holiday data and weekend policy used by every planner. */
export function workDayClassifier(customHolidays: string[] = [], language: WorkLanguage = 'ko'): (date: string) => WorkDay {
  const custom = new Set(customHolidays);
  for (const date of custom) validateWorkDate(date,'custom',language);
  const cache = new Map<number,Map<string,string[]>>();
  return date => {
    const ordinal = validateWorkDate(date,'start',language), year = Number(date.slice(0,4));
    if (!cache.has(year)) {
      const map = new Map<string,string[]>();
      for (const holiday of getKoreanHolidays(year,language)) map.set(holiday.date,[...(map.get(holiday.date) ?? []),holiday.name]);
      cache.set(year,map);
    }
    const holidays = cache.get(year)!.get(date) ?? [];
    const weekend = [0,6].includes(weekday(ordinal)), customHoliday = custom.has(date);
    return { date, weekend, publicHoliday: holidays.length > 0, customHoliday,
      business: !weekend && !holidays.length && !customHoliday,
      reasons: [...(weekend ? [language === 'ko' ? '주말' : 'Weekend'] : []),...holidays,...(customHoliday ? [language === 'ko' ? '직접 추가한 휴일' : 'Manually added holiday'] : [])] };
  };
}
function businessBreakdown(start: string,end: string,custom: string[],language: WorkLanguage) {
  const first = dateOrdinal(start), total = dateOrdinal(end) - first + 1;
  const result = {weekend:Math.floor(total / 7) * 2,publicHoliday:0,customHoliday:0};
  for (let index = 0; index < total % 7; index++) if ([0,6].includes(weekday(first+index))) result.weekend++;
  const publicDates = new Set<string>();
  for (let year = Number(start.slice(0,4)); year <= Number(end.slice(0,4)); year++) for (const holiday of getKoreanHolidays(year,language)) {
    if (holiday.date >= start && holiday.date <= end && ![0,6].includes(weekday(dateOrdinal(holiday.date)))) publicDates.add(holiday.date);
  }
  result.publicHoliday = publicDates.size;
  for (const date of new Set(custom)) if (date >= start && date <= end && !publicDates.has(date) && ![0,6].includes(weekday(dateOrdinal(date)))) result.customHoliday++;
  return result;
}
/** Zero returns the anchor. Inclusion counts the anchor only when it is a working day. */
export function shiftBusinessDate(anchor: string, count: number, direction: 'before' | 'after', includeStart = false, custom: string[] = [], language: WorkLanguage = 'ko'): string {
  validateWorkDate(anchor,'start',language);
  if (!Number.isSafeInteger(count) || count < 0 || count > 18628) throw new RangeError('business day count');
  const classify = workDayClassifier(custom,language);
  let date = anchor, remaining = count;
  if (remaining === 0) return date;
  if (includeStart && classify(date).business) remaining--;
  while (remaining > 0) {
    date = addIsoDays(date,direction === 'after' ? 1 : -1);
    validateWorkDate(date,'end',language);
    if (classify(date).business) remaining--;
  }
  return date;
}
/** Full-rest runs require a full-day absence or a nonworking day. Half days break a run. */
export function planVacation(input: VacationEntry[], custom: string[] = [], language: WorkLanguage = 'ko'): VacationPlan {
  const classify = workDayClassifier(custom,language), dates = new Map<string,VacationEntry>();
  for (const entry of input) {
    validateWorkDate(entry.date,'start',language);
    if (entry.units !== 1 && entry.units !== 0.5) throw new RangeError('vacation units');
    dates.set(entry.date,entry);
  }
  const entries = [...dates.values()].sort((a,b) => a.date.localeCompare(b.date)).map(entry => {
    const status = classify(entry.date); return {...entry,needed:status.business ? entry.units : 0,reasons:status.reasons};
  });
  const restPeriods: VacationPlan['restPeriods'] = [], visited = new Set<string>(); let rangeLimited = false;
  const isRest = (date: string) => !classify(date).business || dates.get(date)?.units === 1;
  for (const entry of entries) {
    if (!isRest(entry.date) || visited.has(entry.date)) continue;
    let start = entry.date, end = entry.date;
    while (true) { if (start === '2000-01-01') { rangeLimited = true; break; } const prior = addIsoDays(start,-1); if (!isRest(prior)) break; start = prior; }
    while (true) { if (end === '2050-12-31') { rangeLimited = true; break; } const next = addIsoDays(end,1); if (!isRest(next)) break; end = next; }
    for (let day = dateOrdinal(start); day <= dateOrdinal(end); day++) visited.add(isoFromOrdinal(day));
    restPeriods.push({start,end,days:dateOrdinal(end)-dateOrdinal(start)+1});
  }
  return {entries,needed:entries.reduce((total,entry) => total + entry.needed,0),restPeriods,longestRest:Math.max(0,...restPeriods.map(period => period.days)),rangeLimited};
}
