import { test } from 'node:test'
import assert from 'node:assert/strict'
import { calendarSelectionSearch, parseCalendarSelection, readCalendarSelection } from '../../src/features/market-calendar/calendarSelection.ts'
import { safeAnalyticsPage } from '../../src/app/publicService.ts'

test('calendar selectors survive the document URL round trip, including held scopes', () => {
  const selected = { venue: 'nasdaq', year: 2027, month: 11, day: 19 } as const
  const search = calendarSelectionSearch(selected)
  assert.deepEqual(readCalendarSelection(new URLSearchParams(search.toString()), new Date(2026, 9, 19)), selected)
  assert.deepEqual(parseCalendarSelection(new URLSearchParams('venue=nasdaq&year=2027&month=11')), { ...selected, day: 1 })
  assert.deepEqual(readCalendarSelection(new URLSearchParams(), new Date(2026, 9, 19)), { venue: 'krx', year: 2026, month: 10, day: 1 })
})

test('calendar URL selection rejects malformed dates, extra keys and duplicate keys', () => {
  for (const search of [
    'venue=unknown&year=2027&month=11', 'venue=nasdaq&year=27&month=11',
    'venue=nasdaq&year=2027&month=13', 'venue=nasdaq&year=2027&month=11&day=31',
    'venue=nasdaq&year=2027&month=2&day=29', 'venue=nasdaq&year=2027&day=1',
    'venue=nasdaq&year=2027&month=11&venue=krx', 'venue=nasdaq&year=2027&month=11&note=private',
    'venue=nasdaq&year=2027&month=11&day=1&day=2', 'venue=nasdaq&year=2027&month=11&day=0',
  ]) {
    assert.equal(parseCalendarSelection(new URLSearchParams(search)), null, search)
    assert.equal(safeAnalyticsPage('/en/tools/market-calendar/', '?' + search), null, search)
  }
  assert.deepEqual(parseCalendarSelection(new URLSearchParams('venue=krx&year=2028&month=2&day=29')), { venue: 'krx', year: 2028, month: 2, day: 29 })
})

test('public calendar choices keep normal readiness while analytics metadata stays query-free', () => {
  for (const lang of ['ko', 'en']) {
    const page = safeAnalyticsPage(`/${lang}/tools/market-calendar/`, '?venue=nasdaq&year=2027&month=11&day=19')
    assert.deepEqual(page, { path: `/${lang}/tools/market-calendar/`, title: 'Worklazy Tools · tools · market-calendar' })
    assert.equal(safeAnalyticsPage(`/${lang}/tools/market-calendar/`, '?venue=nasdaq&year=2027&month=11#private', '#private'), null)
    assert.equal(safeAnalyticsPage(`/${lang}/tools/market-calendar/`, '?venue=nasdaq&year=2027&month=11&q=private'), null)
  }
})
