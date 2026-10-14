export type WorkLanguage = 'ko' | 'en';
export type WorkDateField = 'start' | 'end' | 'hire' | 'asOf' | 'custom';
export type WorkDateErrorCode = 'empty' | 'format' | 'invalidDate' | 'outOfRange' | 'order';
export interface ExcludedDay { date: string; reasons: string[]; reason: string }
export interface HolidayInfo {
  checkedAt: string; minYear: number; maxYear: number; recordedThrough: number;
  status: 'recorded' | 'projected' | 'mixed';
}
export interface BusinessResult {
  total: number; business: number; excludedCount: number; holidayInfo: HolidayInfo;
  breakdown: { weekend: number; publicHoliday: number; customHoliday: number };
  /** Compatibility accessor, materialized only when requested. Prefer excludedPage for UI. */
  readonly excluded: ExcludedDay[];
  excludedPage: (page?: number, pageSize?: number) => { items: ExcludedDay[]; page: number; pageCount: number };
}
export interface LeaveEvent {
  date: string; kind: 'monthly' | 'annual' | 'prorated'; days: number;
  periodStart: string; periodEnd: string; numerator?: number; denominator?: number;
}
export interface AnnualLeaveResult {
  method: 'hire' | 'fiscal'; serviceYears: number;
  monthly: { events: LeaveEvent[]; total: number | null; historySupported: boolean; periodStart: string; periodEnd: string };
  annual: LeaveEvent | null;
  nextEvent: LeaveEvent | null;
}

export interface WorkDay { date: string; business: boolean; weekend: boolean; publicHoliday: boolean; customHoliday: boolean; reasons: string[] }
export interface VacationEntry { date: string; units: 1 | 0.5 }
export interface VacationPlan { needed: number; entries: (VacationEntry & { needed: number; reasons: string[] })[]; restPeriods: { start: string; end: string; days: number }[]; longestRest: number; rangeLimited: boolean }
