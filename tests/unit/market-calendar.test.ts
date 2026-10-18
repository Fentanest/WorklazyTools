import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { loadCalendar, isOld, sourceHref } from '../../src/features/market-calendar/loadCalendar.ts'

const row = { date: '20261119', venue: 'krx', status: 'unknown', sessions: [], special: null,
  sources: [{ id: 'weekend', url: 'urn:market-calendar:rule:weekend', quote: '주말' }], reason: '필수 expected 근거 미확보: krx-kospi-2026-exam', notes: [] }
const makeManifest = (payload: string) => ({ schema_version: 1, generation_id: 'test-generation',
  created_at: '2026-10-18T12:00:00Z', files: [{ path: 'calendar-2026.json', year: 2026,
    sha256: createHash('sha256').update(payload).digest('hex') }],
  scopes: [{ venue: 'krx', year: 2026, included: true, validity: 'valid', last_checked_at: '2026-10-18T11:00:00Z', reason: null }] })

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

test('invalid publication paths are rejected before fetching files', async t => {
  const manifest = makeManifest('[]')
  manifest.files[0].path = '../other.json'
  const mock = t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify(manifest)))
  assert.deepEqual(await loadCalendar('/data/'), { status: 'error' })
  assert.equal(mock.mock.callCount(), 1)
})
