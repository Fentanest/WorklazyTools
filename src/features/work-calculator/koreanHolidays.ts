import { LUNAR_ANCHORS } from './lunarAnchors.ts';
import { dateOrdinal, isoFromOrdinal, weekday, addIsoDays } from './workDate.ts';
import { ELECTION_DATES, TEMPORARY_DATES, HOLIDAY_DATA_VERSION, HOLIDAY_MIN_YEAR, HOLIDAY_MAX_YEAR } from './holidayData.ts';
import type { WorkLanguage } from './workCalculatorTypes.ts';
export interface KoreanHoliday { date: string; name: string; substitute?: boolean; kind?: 'fixed' | 'lunar' | 'election' | 'temporary' | 'substitute' }
interface Original extends KoreanHoliday { group: string; rule: 'any' | 'sunday' | 'none' }
const cache = new Map<string, readonly KoreanHoliday[]>();
const fixed: readonly [string,string,string,string,string,string][] = [
  ['01-01','신정',"New Year's Day",'2000-01-01','2050-12-31',''],
  ['03-01','삼일절','March First Independence Movement Day','2000-01-01','2050-12-31','2021-08-04'],
  ['04-05','식목일','Arbor Day','2000-01-01','2005-06-29',''],
  ['05-01','노동절','Labour Day','2026-05-01','2050-12-31','2026-05-01'],
  ['05-05','어린이날',"Children’s Day",'2000-01-01','2050-12-31','2013-11-05'],
  ['06-06','현충일','Memorial Day','2000-01-01','2050-12-31',''],
  ['07-17','제헌절','Constitution Day','2000-01-01','2007-12-31',''],
  ['07-17','제헌절','Constitution Day','2026-05-11','2050-12-31','2026-05-11'],
  ['08-15','광복절','Liberation Day','2000-01-01','2050-12-31','2021-08-04'],
  ['10-03','개천절','National Foundation Day','2000-01-01','2050-12-31','2021-08-04'],
  ['10-09','한글날','Hangeul Day','2012-12-28','2050-12-31','2021-08-04'],
  ['12-25','성탄절','Christmas Day','2000-01-01','2050-12-31','2023-05-04'],
];
/** Same ORIGINAL collision date is one lost holiday (e.g. 2025-05-05).
 * Distinct lost days whose substitute candidates coincide consume separate next days. */
export function substituteHolidays(originals: Original[], language: WorkLanguage): KoreanHoliday[] {
  const groups = new Map<string, Original[]>();
  for (const day of originals) groups.set(day.group,[...(groups.get(day.group) ?? []),day]);
  const claims: { triggers: Set<string>; after: string; names: string[]; modern: boolean }[] = [];
  for (const group of groups.values()) {
    const triggers = group.filter(day => {
      if (day.rule === 'none') return false;
      const w = weekday(dateOrdinal(day.date));
      const weekend = w === 0 || (w === 6 && day.rule === 'any');
      const modern = day.date >= '2021-08-04';
      const overlap = (!modern || (w !== 0 && w !== 6)) && originals.some(other => other.date === day.date && other.group !== day.group && (!modern || (other.kind !== 'election' && other.kind !== 'temporary')));
      return weekend || overlap;
    }).map(day => day.date);
    if (!triggers.length) continue;
    const after = group.map(d => d.date).sort().at(-1)!;
    const merged = claims.find(claim => triggers.some(t => claim.triggers.has(t)));
    if (merged) {
      triggers.forEach(t => merged.triggers.add(t)); merged.after = [merged.after,after].sort().at(-1)!; merged.names.push(group[0].name);
    } else claims.push({ triggers: new Set(triggers), after, names: [group[0].name], modern: after >= '2021-08-04' });
  }
  const occupied = new Set(originals.map(day => day.date));
  return claims.sort((a,b) => a.after.localeCompare(b.after)).map(claim => {
    let day = dateOrdinal(claim.after) + 1;
    while (weekday(day) === 0 || (claim.modern && weekday(day) === 6) || occupied.has(isoFromOrdinal(day))) day++;
    const date = isoFromOrdinal(day); occupied.add(date);
    return { date, name: language === 'ko' ? `${claim.names.join('·')} 대체공휴일` : `Substitute holiday (${claim.names.join(' / ')})`, substitute: true, kind: 'substitute' };
  });
}
export function getKoreanHolidays(year: number, language: WorkLanguage = 'ko'): KoreanHoliday[] {
  if (!Number.isInteger(year) || year < HOLIDAY_MIN_YEAR || year > HOLIDAY_MAX_YEAR) throw new RangeError('Holiday data supports 2000–2050');
  const key = `${HOLIDAY_DATA_VERSION}:${year}:${language}`;
  if (!cache.has(key)) {
    const originals: Original[] = [];
    for (const [md,ko,en,from,through,substituteFrom] of fixed) {
      const date = `${year}-${md}`;
      if (date >= from && date <= through) originals.push({date,name:language === 'ko' ? ko : en,group:ko,kind:'fixed',rule:substituteFrom && date >= substituteFrom ? 'any' : 'none'});
    }
    const [newYear,buddha,chuseok] = LUNAR_ANCHORS[year];
    for (const [anchor,ko,en] of [[newYear,'설날',"Lunar New Year's Day"],[chuseok,'추석','Chuseok']]) {
      for (const offset of [-1,0,1]) { const date = addIsoDays(anchor,offset); originals.push({date,name:language === 'ko' ? offset ? `${ko} 연휴` : ko : offset ? `${en} holiday` : en,group:ko,kind:'lunar',rule:date >= '2013-11-05' ? 'sunday' : 'none'}); }
    }
    originals.push({date:buddha,name:language === 'ko' ? '부처님오신날' : "Buddha's Birthday",group:'buddha',kind:'lunar',rule:buddha >= '2023-05-04' ? 'any' : 'none'});
    for (const [date,type] of ELECTION_DATES) if (date.startsWith(`${year}-`)) {
      const names = {assembly:['국회의원선거','National Assembly election'],president:['대통령선거','Presidential election'],local:['전국동시지방선거','Nationwide local elections']};
      originals.push({date,name:names[type][language === 'ko' ? 0 : 1],group:date,kind:'election',rule:'none'});
    }
    for (const date of TEMPORARY_DATES) if (date.startsWith(`${year}-`)) originals.push({date,name:language === 'ko' ? '임시공휴일' : 'Temporary public holiday',group:date,kind:'temporary',rule:'none'});
    const values: KoreanHoliday[] = [...originals.map(({group:_group,rule:_rule,...day}) => day),...substituteHolidays(originals,language)].sort((a,b) => a.date.localeCompare(b.date));
    cache.set(key,Object.freeze(values.map(day => Object.freeze(day))));
  }
  return cache.get(key)!.map(day => ({...day}));
}
