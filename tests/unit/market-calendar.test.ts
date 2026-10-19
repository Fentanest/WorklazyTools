import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { loadCalendar, isOld, sourceHref } from '../../src/features/market-calendar/loadCalendar.ts'
import { groupSources, hasPublicationTextMapping, publicationTextKey, sessionNameKey, sortSessions } from '../../src/features/market-calendar/calendarDisplay.ts'
import ko from '../../src/locales/ko/features.json' with { type: 'json' }
import en from '../../src/locales/en/features.json' with { type: 'json' }
import publicationCopy from '../../src/features/market-calendar/publicationCopy.json' with { type: 'json' }
import publicationFixture from '../fixtures/market-calendar/publication-texts.json' with { type: 'json' }

const row = { date: '20261119', venue: 'krx', status: 'unknown', sessions: [], special: null,
  sources: [{ id: 'weekend', url: 'urn:market-calendar:rule:weekend', quote: '주말' }], reason: '필수 expected 근거 미확보: krx-kospi-2026-exam', notes: [] }
const makeManifest = (payload: string) => ({ schema_version: 1, generation_id: 'test-generation',
  created_at: '2026-10-18T12:00:00Z', files: [{ path: 'calendar-2026.json', year: 2026,
    sha256: createHash('sha256').update(payload).digest('hex') }],
  scopes: [{ venue: 'krx', year: 2026, included: true, validity: 'valid', last_checked_at: '2026-10-18T11:00:00Z', reason: null }] })

test('session display follows start times without changing publication order', () => {
  const sessions = [
    { code: 'closing_auction', start: '15:20:00', end: '15:30:00', tz: 'Asia/Seoul' },
    { code: 'regular', start: '09:00:30', end: '15:20:00', tz: 'Asia/Seoul' },
    { code: 'opening_auction', start: '08:30:00', end: '09:00:00', tz: 'Asia/Seoul' },
  ]
  const before = structuredClone(sessions)
  assert.deepEqual(sortSessions(sessions).map(s => s.code), ['opening_auction', 'regular', 'closing_auction'])
  assert.deepEqual(sessions, before)
  assert.equal(sessionNameKey('krx', 'opening_auction'), 'openingAuction')
  assert.equal(sessionNameKey('nxt', 'after'), 'afterMarket')
  assert.equal(sessionNameKey('nyse', 'regular'), 'regularSession')
  assert.equal(sessionNameKey('nasdaq', 'regular'), 'regularSession')
  assert.equal(sessionNameKey('krx', 'unlisted'), undefined)
  assert.equal(sessionNameKey('nxt', 'regular'), undefined)
})

test('source display groups each id once and retains its distinct original quotes', () => {
  const sources = [
    { id: 'krx-hours', url: 'https://example.com/krx', quote: 'Opening hours' },
    { id: 'weekend', url: 'urn:market-calendar:rule:weekend', quote: '주말' },
    { id: 'krx-hours', url: 'https://example.com/krx', quote: 'Closing hours' },
    { id: 'krx-hours', url: 'https://example.com/krx', quote: 'Opening hours' },
  ]
  const before = structuredClone(sources)
  assert.deepEqual(groupSources(sources), [
    { id: 'krx-hours', url: 'https://example.com/krx', quotes: ['Opening hours', 'Closing hours'] },
    { id: 'weekend', url: 'urn:market-calendar:rule:weekend', quotes: ['주말'] },
  ])
  assert.deepEqual(sources, before)
})

test('verified publication preserves unknown status and original reasons without inferring sessions', async t => {
  const reasons = ['공표 전', '판정 불일치', row.reason]
  const payload = JSON.stringify(reasons.map((reason, i) => ({ ...row, date: `202611${19 + i}`, reason })))
  const manifest = makeManifest(payload)
  const urls: string[] = []
  t.mock.method(globalThis, 'fetch', async (url: string) => {
    urls.push(url)
    return new Response(url.endsWith('manifest.json') ? JSON.stringify(manifest) : payload)
  })
  const view = await loadCalendar('/project/data/market-calendar/v1/')
  assert.equal(view.status, 'ready')
  if (view.status !== 'ready') return
  assert.deepEqual(view.rows.map(r => r.reason), reasons)
  assert.ok(view.rows.every(r => r.status === 'unknown' && r.sessions.length === 0))
  assert.equal(view.manifest.generation_id, 'test-generation')
  assert.equal(view.rows[0].sources[0].url, 'urn:market-calendar:rule:weekend')
  assert.equal(sourceHref(view.rows[0].sources[0].url), undefined)
  assert.equal(sourceHref('javascript:alert(1)'), undefined)
  assert.equal(sourceHref('https://www.nyse.com/markets/hours-calendars'), 'https://www.nyse.com/markets/hours-calendars')
  assert.deepEqual(urls, ['/project/data/market-calendar/v1/manifest.json', '/project/data/market-calendar/v1/calendar-2026.json'])
})

test('hash mismatch refuses the complete publication', async t => {
  const payload = JSON.stringify([row])
  t.mock.method(globalThis, 'fetch', async (url: string) => new Response(url.endsWith('manifest.json')
    ? JSON.stringify(makeManifest(payload)) : payload + ' '))
  assert.deepEqual(await loadCalendar('/data/'), { status: 'error' })
})

test('last check becomes old only after 48 hours', () => {
  const checkedAt = '2026-10-18T11:00:00Z'
  const limit = Date.parse(checkedAt) + 48 * 60 * 60 * 1000
  assert.equal(isOld(checkedAt, limit), false)
  assert.equal(isOld(checkedAt, limit + 1), true)
})

test('missing manifest displays no data', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response('', { status: 404 }))
  assert.deepEqual(await loadCalendar('/data/'), { status: 'missing' })
})

test('verified empty data is unavailable rather than an ad-ready calendar', async t => {
  t.mock.method(globalThis, 'fetch', async (url: string) => new Response(url.endsWith('manifest.json')
    ? JSON.stringify(makeManifest('[]')) : '[]'))
  assert.deepEqual(await loadCalendar('/data/'), { status: 'missing' })
})

test('every reviewed publisher text has an explicit display or hide decision', () => {
  for (const [input, key] of Object.entries(publicationCopy.exact)) {
    assert.equal(publicationTextKey(input), key)
    assert.ok(hasPublicationTextMapping(input), input)
    if (key === null) continue
    for (const locale of [ko, en]) {
      const value = locale.marketCalendar[key as keyof typeof locale.marketCalendar]
      assert.ok(value?.trim(), key)
      assert.doesNotMatch(value, /special_expected|forced_unknown|early_close|registry|continuity|조문|전용|고정 입력|현행판/)
    }
    assert.doesNotMatch(en.marketCalendar[key as keyof typeof en.marketCalendar], /[가-힣]/)
  }
  assert.equal(publicationTextKey(row.reason), null)
  assert.equal(publicationTextKey('special 불일치: ["주말", null]'), null)
  assert.equal(publicationTextKey('nasdaq-2027-annual'), null)
  assert.equal(hasPublicationTextMapping('future_unknown_code'), false)
  assert.equal(publicationTextKey('toString'), undefined)
})

test('the original 83-text publication remains fully classified, including hidden notes', () => {
  assert.equal(publicationFixture.ref, '5e7da960376adda15da1e01b31037ad5fff765f0')
  assert.equal(publicationFixture.texts.length, 83)
  let visible = 0, hidden = 0
  for (const { value } of publicationFixture.texts) {
    assert.ok(hasPublicationTextMapping(value), value)
    const key = publicationTextKey(value)
    if (key === null) { hidden++; continue }
    assert.ok(key)
    visible++
    assert.ok(ko.marketCalendar[key])
    assert.doesNotMatch(en.marketCalendar[key], /[가-힣]|translation.*not.*available/i)
  }
  assert.ok(visible > 0 && hidden > 0, 'coverage includes useful labels and explicitly hidden process records')
})

test('known special-day prefixes and new opaque notes never produce fallback paragraphs', () => {
  assert.equal(publicationTextKey(" New Year's  Day "), 'newYearHoliday')
  assert.equal(publicationTextKey('특수일: New Year’s Day'), 'newYearHoliday')
  assert.equal(publicationTextKey('조기폐장 : 13:00:00 종료.'), 'earlyClose')
  assert.equal(publicationTextKey('새로 발행된 문구 forced_unknown'), undefined)
})

test('invalid publication paths are rejected before fetching files', async t => {
  const manifest = makeManifest('[]')
  manifest.files[0].path = '../other.json'
  const mock = t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify(manifest)))
  assert.deepEqual(await loadCalendar('/data/'), { status: 'error' })
  assert.equal(mock.mock.callCount(), 1)
})
