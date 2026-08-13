import { addDays, differenceInCalendarDays, differenceInCalendarMonths, differenceInYears, eachDayOfInterval, endOfYear, format, isAfter, isBefore, isWeekend, parseISO, startOfYear } from "date-fns";

export interface KoreanHoliday { date: string; name: string; substitute?: boolean }

const FIXED_HOLIDAYS = [
  [1, 1, "신정", false], [3, 1, "삼일절", true], [5, 5, "어린이날", true], [6, 6, "현충일", false],
  [8, 15, "광복절", true], [10, 3, "개천절", true], [10, 9, "한글날", true], [12, 25, "성탄절", true],
] as const;

export function getKoreanHolidays(year: number): KoreanHoliday[] {
  const originals: Array<KoreanHoliday & { eligible: boolean; group: string; weekendRule: "any" | "sunday" }> = FIXED_HOLIDAYS.map(([month, day, name, eligible]) => ({ date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`, name, eligible, group: name, weekendRule: "any" }));
  const lunar = findLunarObservances(year);
  if (lunar.newYear) [-1, 0, 1].forEach((offset) => originals.push({ date: format(addDays(lunar.newYear as Date, offset), "yyyy-MM-dd"), name: offset === 0 ? "설날" : "설날 연휴", eligible: true, group: "설날", weekendRule: "sunday" }));
  if (lunar.buddha) originals.push({ date: format(lunar.buddha, "yyyy-MM-dd"), name: "부처님오신날", eligible: true, group: "부처님오신날", weekendRule: "any" });
  if (lunar.chuseok) [-1, 0, 1].forEach((offset) => originals.push({ date: format(addDays(lunar.chuseok as Date, offset), "yyyy-MM-dd"), name: offset === 0 ? "추석" : "추석 연휴", eligible: true, group: "추석", weekendRule: "sunday" }));
  const occupied = new Set(originals.map((holiday) => holiday.date));
  const substitutes: KoreanHoliday[] = [];
  const grouped = new Map<string, typeof originals>();
  originals.forEach((holiday) => grouped.set(holiday.group, [...(grouped.get(holiday.group) ?? []), holiday]));
  for (const holidays of grouped.values()) {
    if (!holidays[0].eligible) continue;
    const overlap = holidays.some((holiday) => originals.some((other) => other.group !== holiday.group && other.date === holiday.date));
    const weekend = holidays.some((holiday) => holidays[0].weekendRule === "sunday" ? parseISO(holiday.date).getDay() === 0 : isWeekend(parseISO(holiday.date)));
    if (!weekend && !overlap) continue;
    const lastDate = holidays.map((holiday) => holiday.date).sort().at(-1) as string;
    let candidate = addDays(parseISO(lastDate), 1);
    while (isWeekend(candidate) || occupied.has(format(candidate, "yyyy-MM-dd"))) candidate = addDays(candidate, 1);
    const date = format(candidate, "yyyy-MM-dd");
    if (!occupied.has(date)) { occupied.add(date); substitutes.push({ date, name: `${holidays[0].group} 대체공휴일`, substitute: true }); }
  }
  return [...originals.map(({ eligible: _eligible, group: _group, weekendRule: _weekendRule, ...holiday }) => holiday), ...substitutes].sort((a, b) => a.date.localeCompare(b.date));
}

function findLunarObservances(year: number) {
  const formatter = new Intl.DateTimeFormat("en-US-u-ca-chinese", { month: "numeric", day: "numeric", timeZone: "Asia/Seoul" });
  const result: { newYear?: Date; buddha?: Date; chuseok?: Date } = {};
  eachDayOfInterval({ start: startOfYear(new Date(year, 0, 1)), end: endOfYear(new Date(year, 0, 1)) }).forEach((date) => {
    const parts = formatter.formatToParts(date);
    const monthText = parts.find((part) => part.type === "month")?.value ?? "";
    const day = Number(parts.find((part) => part.type === "day")?.value);
    const month = Number(monthText.match(/\d+/)?.[0]);
    const leap = /bis|leap/i.test(monthText);
    if (!leap && month === 1 && day === 1) result.newYear = date;
    if (!leap && month === 4 && day === 8) result.buddha = date;
    if (!leap && month === 8 && day === 15) result.chuseok = date;
  });
  return result;
}

export function calculateBusinessDays(startIso: string, endIso: string, customHolidays: string[] = []) {
  const start = parseISO(startIso); const end = parseISO(endIso);
  if (isAfter(start, end)) throw new Error("종료일은 시작일보다 빠를 수 없습니다.");
  const holidayMap = new Map<string, string>();
  for (let year = start.getFullYear(); year <= end.getFullYear(); year += 1) getKoreanHolidays(year).forEach((holiday) => holidayMap.set(holiday.date, holiday.name));
  customHolidays.filter(Boolean).forEach((date) => holidayMap.set(date, "직접 추가한 휴일"));
  const days = eachDayOfInterval({ start, end });
  const excluded = days.filter((date) => isWeekend(date) || holidayMap.has(format(date, "yyyy-MM-dd")));
  return { total: days.length, business: days.length - excluded.length, excluded: excluded.map((date) => ({ date: format(date, "yyyy-MM-dd"), reason: holidayMap.get(format(date, "yyyy-MM-dd")) ?? "주말" })) };
}

export function calculateAnnualLeave(hireIso: string, asOfIso: string, method: "hire" | "fiscal") {
  const hire = parseISO(hireIso); const asOf = parseISO(asOfIso);
  if (isBefore(asOf, hire)) throw new Error("기준일은 입사일보다 빠를 수 없습니다.");
  const serviceYears = differenceInYears(asOf, hire);
  const serviceMonths = Math.max(0, differenceInCalendarMonths(asOf, hire));
  if (method === "hire") {
    const days = serviceYears < 1 ? Math.min(11, serviceMonths) : Math.min(25, 15 + Math.floor((serviceYears - 1) / 2));
    return { days, serviceYears, detail: serviceYears < 1 ? "1년 미만 월 개근 가정" : "입사일 기준 기본 15일과 2년마다 1일 가산" };
  }
  const fiscalStart = startOfYear(asOf);
  if (hire.getFullYear() === asOf.getFullYear()) return { days: Math.min(11, serviceMonths), serviceYears, detail: "입사 첫 회계연도 월 개근 가정" };
  if (hire.getFullYear() === asOf.getFullYear() - 1) {
    const employedDays = differenceInCalendarDays(fiscalStart, hire);
    return { days: Math.round((15 * employedDays / 365) * 10) / 10, serviceYears, detail: "첫 회계연도 말까지 재직일수로 15일을 비례 산정" };
  }
  const yearsAtFiscalStart = differenceInYears(fiscalStart, hire);
  return { days: Math.min(25, 15 + Math.floor(Math.max(0, yearsAtFiscalStart - 1) / 2)), serviceYears, detail: "매년 1월 1일 부여, 근속 가산 반영" };
}
