import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test, { after } from 'node:test'
import { injectStaticSummary, privateContentFindings, validatePublicData } from '../../scripts/foliotrace-public-data.mjs'

const quote = { close: '100', currency: 'KRW', market: 'KRX', session: 'regular', tradeDate: '2026-10-23', adjusted: false,
  provider: 'naver', observedAt: '2026-10-24T00:00:00Z', verified: true }
const holding = (stockCode: string, extra = {}) => ({ corpCode: '00101488', stockCode, name: `종목${stockCode}`, securityKind: 'common',
  quantity: '10', companyOwnershipPercent: '1.5', receiptNo: null, receiptDate: '2025-12-31', holdingDate: '2025-12-31',
  evidence: 'legacy-import', sourceKind: 'year-end-list', latestUnresolvedReceiptNo: null, latestUnresolvedReason: null,
  tracking: 'active', quote, estimatedValue: '1000', portfolioWeightPercent: '100', valuationExclusionReason: null, filingUrl: null, ...extra })

function snapshotOf(version: string, holdings: unknown[]) {
  return { schemaVersion: 1, datasetVersion: version,
    portfolio: { id: 'nps', entityId: 'nps', market: 'KRX', currency: 'KRW', scopeKo: '범위', scopeEn: 'Scope', methodologyVersion: '2', legacyCoverage: 'verified' },
    entity: { id: 'nps', kind: 'institution', nameKo: '국민연금공단', nameEn: 'NPS', officialId: null, source: 'OpenDART' },
    valuationTradeDate: '2026-10-23', filingsCheckedAt: null, generatedAt: '2026-10-24T00:00:00Z', publishedAt: null, latestReceiptDate: null,
    trackedCount: holdings.length, pricedCount: holdings.length, unresolvedCount: 0, estimatedValue: String(1000 * holdings.length),
    valuationCoverage: 'complete', filingCoverage: 'partial', holdings, events: [],
    history: [{ tradeDate: '2026-10-23', estimatedValue: String(1000 * holdings.length), datasetVersion: version }] }
}

const roots: string[] = []
after(async () => { await Promise.all(roots.map(root => fs.rm(root, { recursive: true, force: true }))) })

async function site(mutate?: (snapshot: ReturnType<typeof snapshotOf>) => void, raw?: (text: string) => string) {
  const version = 'c'.repeat(64)
  const snapshot = snapshotOf(version, [holding('000020'), holding('000050')])
  mutate?.(snapshot)
  const text = raw ? raw(JSON.stringify(snapshot)) : JSON.stringify(snapshot)
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'foliotrace-public-'))
  roots.push(root)
  const dir = path.join(root, 'data/foliotrace/v1')
  await fs.mkdir(path.join(dir, 'snapshots'), { recursive: true })
  await fs.writeFile(path.join(dir, `snapshots/${version}.json`), text)
  await fs.writeFile(path.join(dir, 'manifest.json'), JSON.stringify({ schemaVersion: 1, datasetVersion: version,
    snapshotPath: `snapshots/${version}.json`, snapshotSha256: createHash('sha256').update(text).digest('hex') }))
  return { root, dir, version }
}

test('public data validator accepts a revision-2 snapshot and rejects broken or extra files', async () => {
  const ok = await site()
  const result = await validatePublicData(ok.root)
  assert.equal(result.snapshot.trackedCount, 2)

  const extra = await site()
  await fs.writeFile(path.join(extra.dir, 'snapshots', `${'d'.repeat(64)}.json`), '{}')
  await assert.rejects(validatePublicData(extra.root), /latest only/)

  const stray = await site()
  await fs.writeFile(path.join(stray.dir, 'README.md'), 'x')
  await assert.rejects(validatePublicData(stray.root), /only manifest\.json/)

  const tampered = await site()
  await fs.appendFile(path.join(tampered.dir, `snapshots/${tampered.version}.json`), ' ')
  await assert.rejects(validatePublicData(tampered.root), /hash/)

  const dup = await site(snapshot => { snapshot.holdings[1] = holding('000020') })
  await assert.rejects(validatePublicData(dup.root), /duplicate stockCode/)

  const unpriced = await site(snapshot => {
    snapshot.holdings = snapshot.holdings.map(row => ({ ...(row as object), estimatedValue: null, quote: null, valuationExclusionReason: 'quote_unverified', portfolioWeightPercent: null }))
    snapshot.pricedCount = 0; snapshot.estimatedValue = null; snapshot.valuationCoverage = 'unavailable'
  })
  await assert.rejects(validatePublicData(unpriced.root), /unpriced/)
})

test('public data validator blocks paths, keys and internal runtime or model names', async () => {
  for (const [label, edit] of [
    ['path', (t: string) => t.replace('종목000020', '/home/x/state.json')],
    ['model name', (t: string) => t.replace('종목000020', 'Claude batch')],
    ['runtime name', (t: string) => t.replace('종목000020', 'LLM_READ')],
    ['key shape', (t: string) => t.replace('종목000020', 'a'.repeat(40))],
    ['key word', (t: string) => t.replace('종목000020', 'api_key')],
  ] as const) {
    const bad = await site(undefined, edit)
    await assert.rejects(validatePublicData(bad.root), /private content/, label)
  }
  assert.deepEqual(privateContentFindings('국민연금공단 NPS OpenDART 20260303002485 ' + 'e'.repeat(64)), [])
})

test('static summary is injected idempotently into both language pages', async () => {
  const ok = await site()
  const { snapshot } = await validatePublicData(ok.root)
  for (const lang of ['ko', 'en']) {
    const dir = path.join(ok.root, lang, 'tools/foliotrace')
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(path.join(dir, 'index.html'), '<main><div class="seo-static-fallback"></div></main>')
  }
  await injectStaticSummary(ok.root, snapshot)
  await injectStaticSummary(ok.root, snapshot)
  const html = await fs.readFile(path.join(ok.root, 'ko/tools/foliotrace/index.html'), 'utf8')
  assert.equal(html.split('data-foliotrace-dataset').length - 1, 1)
  assert.ok(html.includes(snapshot.estimatedValue) && html.includes('종목000020'))
})

test('revision-1 live data stays readable: measured full file and a reduced real sample', async () => {
  const { SNAPSHOT_LIMITS, validSnapshot } = await import('../../src/features/foliotrace/data/loadSnapshot.ts')
  const dir = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../fixtures/foliotrace')
  const measured = JSON.parse(await fs.readFile(path.join(dir, 'live-revision1-measured.json'), 'utf8'))
  const sample = JSON.parse(await fs.readFile(path.join(dir, 'live-revision1-sample.json'), 'utf8'))
  assert.equal(validSnapshot(sample, measured.datasetVersion), true)
  // The measured live file (2026-10-25) must sit well inside every limit, at least 3x for the growing ones.
  assert.ok(measured.snapshotBytes * 3 <= SNAPSHOT_LIMITS.maxSnapshotBytes)
  assert.ok(measured.events * 3 <= SNAPSHOT_LIMITS.maxEvents)
  assert.ok(measured.holdings * 3 <= SNAPSHOT_LIMITS.maxHoldings)
  assert.ok(measured.history * 3 <= SNAPSHOT_LIMITS.maxHistory)
  // Scale the real sample's events to the measured live count: still valid.
  const events = Array.from({ length: measured.events }, (_, i) => sample.events[i % sample.events.length])
  assert.equal(validSnapshot({ ...sample, events }, measured.datasetVersion), true)
  assert.equal(validSnapshot({ ...sample, events: Array.from({ length: SNAPSHOT_LIMITS.maxEvents + 1 }, () => sample.events[0]) }, measured.datasetVersion), false)
})
