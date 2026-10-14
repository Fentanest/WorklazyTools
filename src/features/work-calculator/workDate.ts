import type { WorkDateErrorCode, WorkDateField, WorkLanguage } from './workCalculatorTypes.ts';
export const DAY_MS = 86_400_000;
export class WorkDateError extends Error {
  code: WorkDateErrorCode; field: WorkDateField; value: string;
  constructor(code: WorkDateErrorCode, field: WorkDateField, value: string, language: WorkLanguage = 'ko') {
    super(language === 'ko' ? `날짜 입력 형식 또는 범위를 확인해 주세요: ${value}` : `Invalid date input or range: ${value}`);
    this.name = 'WorkDateError'; this.code = code; this.field = field; this.value = value;
  }
}
export function dateOrdinal(value: string): number {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(0); date.setUTCFullYear(year, month - 1, day); date.setUTCHours(0,0,0,0);
  return date.getTime() / DAY_MS;
}
export function isoFromOrdinal(ordinal: number): string { return new Date(ordinal * DAY_MS).toISOString().slice(0,10); }
export function weekday(ordinal: number): number { return ((ordinal + 4) % 7 + 7) % 7; }
export function addIsoDays(iso: string, days: number): string { return isoFromOrdinal(dateOrdinal(iso) + days); }
export function seoulToday(date = new Date()): string { return new Date(date.getTime() + 9 * 3_600_000).toISOString().slice(0,10); }
export function validateWorkDate(value: string, field: WorkDateField, language: WorkLanguage = 'ko', kind: 'business' | 'leave' = 'business'): number {
  if (!value) throw new WorkDateError('empty',field,value,language);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new WorkDateError('format',field,value,language);
  const ordinal = dateOrdinal(value);
  if (!Number.isFinite(ordinal) || isoFromOrdinal(ordinal) !== value) throw new WorkDateError('invalidDate',field,value,language);
  const minimum = kind === 'business' ? '2000-01-01' : field === 'hire' ? '1900-01-01' : '2018-05-29';
  if (value < minimum || value > '2050-12-31') throw new WorkDateError('outOfRange',field,value,language);
  return ordinal;
}
export function parseCustomHolidays(text: string, language: WorkLanguage = 'ko'): string[] {
  const dates = text.trim().split(/[\s,]+/).filter(Boolean);
  for (const date of dates) validateWorkDate(date,'custom',language);
  return [...new Set(dates)].sort();
}
/** Completed Civil Code calendar period; absent corresponding day expires at month end.
 * The grant/start of the following period is the next date. No weekend shift. */
export function nextPeriodBoundary(start: string, months: number): string {
  const [year, month, day] = start.split('-').map(Number);
  const target = new Date(Date.UTC(year,month - 1 + months,1));
  const y = target.getUTCFullYear(), m = target.getUTCMonth();
  const end = new Date(Date.UTC(y,m+1,0)).getUTCDate();
  return isoFromOrdinal(Date.UTC(y,m,Math.min(day,end)) / DAY_MS + (day > end ? 1 : 0));
}
