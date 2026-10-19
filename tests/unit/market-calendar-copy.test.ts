import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dateCopyKeys, dateDescriptions, formatLastUpdated, koreaSessionRange, officialSources, type CalendarTextKey } from '../../src/features/market-calendar/calendarDisplay.ts'
import type { CalendarRow } from '../../src/features/market-calendar/loadCalendar.ts'
import ko from '../../src/locales/ko/features.json' with { type: 'json' }
import en from '../../src/locales/en/features.json' with { type: 'json' }
const row: CalendarRow = { date: '20261127', venue: 'nyse', status: 'open', special: null, reason: null, sessions: [{ code: 'regular', start: '09:30:00', end: '13:00:00', tz: 'America/New_York' }], notes: [], sources: [] }
const text = (lang: 'ko' | 'en') => (key: CalendarTextKey, values: Record<string, string | number> = {}) => Object.entries(values).reduce((s, [k, v]) => s.replaceAll(`{{${k}}}`, String(v)), (lang === 'ko' ? ko : en).marketCalendar[key])

test('duplicate publisher notes and internal records are hidden, with one early-close explanation', () => {
  const sample = { ...row, notes: ['현행판 기준', ...Array(5).fill('새 내부 메모'), '조기폐장: 13:00 종료', '특수일: Early Close', '공식 2026 조기폐장 일정의 미국 동부 현지시각 13:00 적용.'] }
  const before = structuredClone(sample)
  assert.deepEqual(dateCopyKeys(sample), ['earlyClose'])
  assert.deepEqual(dateDescriptions(sample, text('ko')), ['조기폐장 · 13:00 마감 (뉴욕 시간)'])
  assert.deepEqual(dateDescriptions(sample, text('en')), ['Early close at 13:00 (New York time)'])
  assert.deepEqual(sample, before, 'public API rows must remain byte-equivalent data')
  assert.deepEqual(dateDescriptions({ ...sample, status: 'unknown', sessions: [] }, text('ko')), ['아직 확정되지 않은 일정'])
})

test('holiday reasons are concise and deduplicated across special and notes', () => {
  assert.deepEqual(dateDescriptions({ ...row, venue: 'krx', status: 'closed', sessions: [], special: '신정', notes: ['특수일: 신정', '신정', '현행판 기준'] }, text('ko')), ['신정 휴장'])
  assert.deepEqual(dateDescriptions({ ...row, status: 'closed', sessions: [], special: '연말휴장일' }, text('en')), ['Closed for the year-end holiday'])
  assert.deepEqual(dateDescriptions({ ...row, status: 'closed', sources: [{ id: 'rule:weekend', url: 'urn:market-calendar:rule:weekend', quote: '주말' }] }, text('ko')), ['주말 휴장'])
})

test('last update is one readable Korea timestamp with no raw ISO or generation identifier', () => {
  const value = '2026-10-18T21:32:33.672905+00:00'
  assert.equal(formatLastUpdated(value, 'ko'), '2026년 10월 19일 오전 6:32 (한국 시간)')
  assert.equal(formatLastUpdated(value, 'en'), 'Oct 19, 2026, 6:32 AM KST')
  assert.equal(formatLastUpdated('not-a-date', 'ko'), null)
})

test('U.S. hours include the correct Korea date across winter and summer time', () => {
  assert.equal(koreaSessionRange('20261127', row.sessions[0], 'en'), 'Nov 27, 23:30–Nov 28, 03:00')
  assert.equal(koreaSessionRange('20260702', row.sessions[0], 'ko'), '7월 2일 22:30–7월 3일 02:00')
  assert.equal(koreaSessionRange('20261127', { ...row.sessions[0], tz: 'Asia/Seoul' }, 'ko'), null)
  assert.equal(koreaSessionRange('20261127', { ...row.sessions[0], tz: 'Invalid/Zone' }, 'ko'), null)
})

test('source links are safe, unique by URL and keep the original excerpts', () => {
  assert.deepEqual(officialSources([{ id: 'a', url: 'https://example.com/notice', quote: 'A' }, { id: 'b', url: 'https://example.com/notice', quote: 'B' }, { id: 'c', url: 'urn:market-calendar:rule:weekend', quote: 'weekend' }]), [{ url: 'https://example.com/notice', quotes: ['A', 'B'] }])
})
