import test from 'node:test';
import type { TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { loadFolioTraceSnapshot } from '../../src/features/foliotrace/data/loadSnapshot.ts';

const original = JSON.parse(readFileSync(new URL('../fixtures/foliotrace/chart-snapshot-20261103.json', import.meta.url), 'utf8'));
const series = JSON.parse(readFileSync(new URL('../fixtures/foliotrace/valuation-series-20261103.json', import.meta.url), 'utf8'));
// Reviewer P2-1 counterexamples. All requests keep a matching manifest/hash.
const counterexamples: Array<[string, (snapshot: any) => void]> = [
  ['reversed extension', s => { s.valuationSeries.points.reverse(); }],
  ['duplicate extension date', s => { s.valuationSeries.points[1].tradeDate = s.valuationSeries.points[0].tradeDate; }],
  ['1001 extension points', s => { s.valuationSeries.points = Array.from({ length: 1001 }, () => s.valuationSeries.points[0]); }],
  ['inconsistent reconstruction counts', s => { s.valuationSeries.points[0].pricedCount++; }],
  ['duplicate public history date', s => { s.history[1].tradeDate = s.history[0].tradeDate; }],
  ['1001 public history points', s => { s.history = Array.from({ length: 1001 }, () => s.history[0]); }],
  ['reversed public history', s => { s.history.reverse(); }],
  ['malformed history row', s => { s.history[0].estimatedValue = null; }],
  ['partial published counts', s => { s.history[0].trackedCount = 1192; }],
  ['inconsistent published counts', s => { Object.assign(s.history[0], { trackedCount: 1192, pricedCount: 1175, unvaluedCount: 0 }); }],
  ['non-array public history', s => { s.history = null; }],
  ['wrongly typed extension origin', s => { s.valuationSeries.points[0].quantityOrigin = ['stored-assembly']; }],
];

function serve(t: TestContext, input: unknown, hashMatches = true) {
  const body = JSON.stringify(input);
  const manifest = { schemaVersion: 1, datasetVersion: original.datasetVersion,
    snapshotPath: `snapshots/${original.datasetVersion}.json`,
    snapshotSha256: hashMatches ? createHash('sha256').update(body).digest('hex') : '0'.repeat(64) };
  t.mock.method(globalThis, 'fetch', async (url: string) => String(url).endsWith('manifest.json')
    ? Response.json(manifest) : new Response(body));
}

for (const [name, mutate] of counterexamples) test(`chart failure preserves the portfolio: ${name}`, async t => {
  const input = { ...structuredClone(original), valuationSeries: structuredClone(series) }; mutate(input);
  serve(t, input);
  const view = await loadFolioTraceSnapshot();
  assert.equal(view.status, 'ready');
  if (view.status !== 'ready') return;
  assert.equal(view.chartUnavailable, true);
  assert.deepEqual(view.snapshot.history, []);
  assert.equal(view.snapshot.valuationSeries, undefined);
  assert.deepEqual(view.snapshot.holdings, original.holdings);
  assert.deepEqual(view.snapshot.events, original.events);
  assert.equal(view.snapshot.estimatedValue, original.estimatedValue);
});

test('valid chart data is retained by the browser loader', async t => {
  const input = { ...original, valuationSeries: series }; serve(t, input);
  const view = await loadFolioTraceSnapshot(); assert.equal(view.status, 'ready');
  if (view.status !== 'ready') return;
  assert.equal(view.chartUnavailable, undefined);
  assert.deepEqual(view.snapshot.history, original.history);
  assert.deepEqual(view.snapshot.valuationSeries, series);
});

test('core contract and integrity failures still reject the entire snapshot', async t => {
  for (const mutate of [
    s => { s.portfolio.currency = 'USD'; }, s => { s.holdings[0].filingUrl = 'javascript:alert(1)'; },
    s => { s.events[0].receiptDate = null; }, s => { s.estimatedValue = {}; },
  ] as Array<(snapshot: any) => void>) {
    const input = { ...structuredClone(original), valuationSeries: structuredClone(series) };
    input.valuationSeries.points.reverse(); mutate(input); serve(t, input);
    assert.equal((await loadFolioTraceSnapshot()).status, 'schema-error');
    t.mock.restoreAll();
  }
  serve(t, original, false);
  assert.equal((await loadFolioTraceSnapshot()).status, 'schema-error');
});
