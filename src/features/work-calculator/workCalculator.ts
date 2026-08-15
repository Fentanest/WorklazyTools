import { differenceInCalendarDays, differenceInMonths, differenceInYears, eachDayOfInterval, format, isAfter, isBefore, isWeekend, parseISO, startOfYear } from "date-fns";

export interface KoreanHoliday { date: string; name: string; substitute?: boolean }

const FIXED_HOLIDAYS = [
  [1, 1, "신정", "New Year's Day", false], [3, 1, "삼일절", "March First Independence Movement Day", true], [5, 5, "어린이날", "Children's Day", true], [6, 6, "현충일", "Memorial Day", false],
  [8, 15, "광복절", "Liberation Day", true], [10, 3, "개천절", "National Foundation Day", true], [10, 9, "한글날", "Hangeul Day", true], [12, 25, "성탄절", "Christmas Day", true],
] as const;
const EXTRA_HOLIDAYS: Record<number, Array<[string, string, string]>> = {
  2026: [["2026-06-03", "제9회 전국동시지방선거", "9th nationwide local elections"]],
};
const holidayCache = new Map<string, KoreanHoliday[]>();

export function getKoreanHolidays(year: number, language: "ko" | "en" = "ko"): KoreanHoliday[] {
  const cacheKey = `${year}:${language}`;
  const cached = holidayCache.get(cacheKey);
  if (cached) return cached.map((holiday) => ({ ...holiday }));
  const originals: Array<KoreanHoliday & { eligible: boolean; group: string; weekendRule: "any" | "sunday" }> = FIXED_HOLIDAYS.map(([month, day, koName, enName, eligible]) => ({ date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, name: language === "en" ? enName : koName, eligible, group: koName, weekendRule: "any" }));
  const lunar = findLunarObservances(year);
  if (lunar.newYear) [-1, 0, 1].forEach((offset) => originals.push({ date: addIsoDays(lunar.newYear as string, offset), name: language === "en" ? offset === 0 ? "Lunar New Year's Day" : "Lunar New Year holiday" : offset === 0 ? "설날" : "설날 연휴", eligible: true, group: "설날", weekendRule: "sunday" }));
  if (lunar.buddha) originals.push({ date: lunar.buddha, name: language === "en" ? "Buddha's Birthday" : "부처님오신날", eligible: true, group: "부처님오신날", weekendRule: "any" });
  if (lunar.chuseok) [-1, 0, 1].forEach((offset) => originals.push({ date: addIsoDays(lunar.chuseok as string, offset), name: language === "en" ? offset === 0 ? "Chuseok" : "Chuseok holiday" : offset === 0 ? "추석" : "추석 연휴", eligible: true, group: "추석", weekendRule: "sunday" }));
  for (const [date, koName, enName] of EXTRA_HOLIDAYS[year] ?? []) originals.push({ date, name: language === "en" ? enName : koName, eligible: false, group: koName, weekendRule: "any" });
  const occupied = new Set(originals.map((holiday) => holiday.date));
  const substitutes: KoreanHoliday[] = [];
  const grouped = new Map<string, typeof originals>();
  const substitutedTriggerDates = new Set<string>();
  originals.forEach((holiday) => grouped.set(holiday.group, [...(grouped.get(holiday.group) ?? []), holiday]));
  for (const holidays of grouped.values()) {
    if (!holidays[0].eligible) continue;
    const triggerDates = holidays.filter((holiday) => {
      const overlap = originals.some((other) => other.group !== holiday.group && other.date === holiday.date);
      const day = isoWeekday(holiday.date);
      const weekend = holidays[0].weekendRule === "sunday" ? day === 0 : day === 0 || day === 6;
      return overlap || weekend;
    }).map((holiday) => holiday.date);
    if (!triggerDates.length || triggerDates.every((date) => substitutedTriggerDates.has(date))) continue;
    const lastDate = holidays.map((holiday) => holiday.date).sort().at(-1) as string;
    let date = addIsoDays(lastDate, 1);
    while ([0, 6].includes(isoWeekday(date)) || occupied.has(date)) date = addIsoDays(date, 1);
    triggerDates.forEach((trigger) => substitutedTriggerDates.add(trigger));
    if (!occupied.has(date)) { occupied.add(date); substitutes.push({ date, name: language === "en" ? `Substitute holiday (${holidays[0].name})` : `${holidays[0].group} 대체공휴일`, substitute: true }); }
  }
  const result = [...originals.map(({ eligible: _eligible, group: _group, weekendRule: _weekendRule, ...holiday }) => holiday), ...substitutes].sort((a, b) => a.date.localeCompare(b.date));
  holidayCache.set(cacheKey, result);
  return result.map((holiday) => ({ ...holiday }));
}

function findLunarObservances(year: number) {
  const formatter = new Intl.DateTimeFormat("en-US-u-ca-dangi", { month: "numeric", day: "numeric", timeZone: "Asia/Seoul" });
  const result: { newYear?: string; buddha?: string; chuseok?: string } = {};
  const first = Date.UTC(year, 0, 1, 3);
  const days = differenceInCalendarDays(new Date(Date.UTC(year + 1, 0, 1, 3)), new Date(first));
  for (let index = 0; index < days; index += 1) {
    const date = new Date(first + index * 86_400_000);
    const iso = date.toISOString().slice(0, 10);
    const parts = formatter.formatToParts(date);
    const monthText = parts.find((part) => part.type === "month")?.value ?? "";
    const day = Number(parts.find((part) => part.type === "day")?.value);
    const month = Number(monthText.match(/\d+/)?.[0]);
    const leap = /bis|leap/i.test(monthText);
    if (!leap && month === 1 && day === 1) result.newYear = iso;
    if (!leap && month === 4 && day === 8) result.buddha = iso;
    if (!leap && month === 8 && day === 15) result.chuseok = iso;
  }
  return result;
}

function addIsoDays(iso: string, offset: number) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + offset, 3)).toISOString().slice(0, 10);
}

function isoWeekday(iso: string) {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 3)).getUTCDay();
}

export function calculateBusinessDays(startIso: string, endIso: string, customHolidays: string[] = [], language: "ko" | "en" = "ko") {
  const start = parseISO(startIso); const end = parseISO(endIso);
  if (isAfter(start, end)) throw new Error(language === "en" ? "The end date cannot be earlier than the start date." : "종료일은 시작일보다 빠를 수 없습니다.");
  const holidayMap = new Map<string, string>();
  for (let year = start.getFullYear(); year <= end.getFullYear(); year += 1) getKoreanHolidays(year, language).forEach((holiday) => holidayMap.set(holiday.date, holiday.name));
  customHolidays.filter(Boolean).forEach((date) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(parseISO(date).getTime()) || format(parseISO(date), "yyyy-MM-dd") !== date) {
      throw new Error(language === "en" ? `Invalid additional holiday: ${date}` : `추가 휴일 날짜 형식이 올바르지 않습니다: ${date}`);
    }
    holidayMap.set(date, language === "en" ? "Manually added holiday" : "직접 추가한 휴일");
  });
  const days = eachDayOfInterval({ start, end });
  const excluded = days.filter((date) => isWeekend(date) || holidayMap.has(format(date, "yyyy-MM-dd")));
  return { total: days.length, business: days.length - excluded.length, excluded: excluded.map((date) => ({ date: format(date, "yyyy-MM-dd"), reason: holidayMap.get(format(date, "yyyy-MM-dd")) ?? (language === "en" ? "Weekend" : "주말") })) };
}

export function calculateAnnualLeave(hireIso: string, asOfIso: string, method: "hire" | "fiscal", language: "ko" | "en" = "ko") {
  const hire = parseISO(hireIso); const asOf = parseISO(asOfIso);
  if (isBefore(asOf, hire)) throw new Error(language === "en" ? "The calculation date cannot be earlier than the hire date." : "기준일은 입사일보다 빠를 수 없습니다.");
  const serviceYears = differenceInYears(asOf, hire);
  const serviceMonths = Math.max(0, differenceInMonths(asOf, hire));
  if (method === "hire") {
    const days = serviceYears < 1 ? Math.min(11, serviceMonths) : Math.min(25, 15 + Math.floor((serviceYears - 1) / 2));
    return { days, serviceYears, detail: language === "en" ? serviceYears < 1 ? "Assumes perfect attendance for each completed month in the first year" : "15 base days by hire date, plus one day every two years" : serviceYears < 1 ? "1년 미만 월 개근 가정" : "입사일 기준 기본 15일과 2년마다 1일 가산" };
  }
  const fiscalStart = startOfYear(asOf);
  if (hire.getFullYear() === asOf.getFullYear()) return { days: Math.min(11, serviceMonths), serviceYears, detail: language === "en" ? "Assumes perfect attendance by month in the first fiscal year" : "입사 첫 회계연도 월 개근 가정" };
  if (hire.getFullYear() === asOf.getFullYear() - 1) {
    const employedDays = differenceInCalendarDays(fiscalStart, hire);
    return { days: Math.round((15 * employedDays / 365) * 10) / 10, serviceYears, detail: language === "en" ? "Prorates 15 days by employment days through the first fiscal year" : "첫 회계연도 말까지 재직일수로 15일을 비례 산정" };
  }
  const yearsAtFiscalStart = differenceInYears(fiscalStart, hire);
  return { days: Math.min(25, 15 + Math.floor(Math.max(0, yearsAtFiscalStart - 1) / 2)), serviceYears, detail: language === "en" ? "Granted on January 1 with length-of-service additions" : "매년 1월 1일 부여, 근속 가산 반영" };
}
