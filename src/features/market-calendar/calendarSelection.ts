import { venues, type Venue } from './loadCalendar.ts'

export interface CalendarSelection { venue: Venue; year: number; month: number; day: number }

export function moveCalendarSelection(selection: CalendarSelection, months: number, years: readonly number[]): CalendarSelection | null {
  const date = new Date(Date.UTC(selection.year, selection.month - 1 + months, 1))
  const year = date.getUTCFullYear()
  return years.includes(year) ? { ...selection, year, month: date.getUTCMonth() + 1, day: 1 } : null
}

// Public schedule selectors only. Reject unknown/duplicate keys rather than
// allowing arbitrary URL content through the shared readiness/analytics gate.
export function parseCalendarSelection(parameters: URLSearchParams): CalendarSelection | null {
  const keys = ['venue', 'year', 'month', 'day']
  if (![3, 4].includes(parameters.size) || [...parameters.keys()].some(key => !keys.includes(key)) ||
    keys.some(key => parameters.getAll(key).length > 1)) return null
  const venue = parameters.get('venue')
  const year = parameters.get('year') ?? ''
  const month = parameters.get('month') ?? ''
  const day = parameters.get('day') ?? '1'
  if (!venues.includes(venue as Venue) || !/^[1-9]\d{3}$/.test(year) ||
    !/^(?:[1-9]|1[0-2])$/.test(month) || !/^(?:[1-9]|[12]\d|3[01])$/.test(day) ||
    Number(day) > new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate()) return null
  return { venue: venue as Venue, year: Number(year), month: Number(month), day: Number(day) }
}

export function readCalendarSelection(parameters: URLSearchParams, date: Date): CalendarSelection {
  return parseCalendarSelection(parameters) ?? { venue: 'krx', year: date.getFullYear(), month: date.getMonth() + 1, day: 1 }
}

export function calendarSelectionSearch(selection: CalendarSelection): URLSearchParams {
  return new URLSearchParams({ venue: selection.venue, year: String(selection.year), month: String(selection.month), day: String(selection.day) })
}
