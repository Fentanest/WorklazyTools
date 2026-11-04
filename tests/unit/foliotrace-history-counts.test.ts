import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validPublishedHistory } from '../../src/features/foliotrace/data/valuationSeries.ts';
import { validSnapshot } from '../../src/features/foliotrace/data/loadSnapshot.ts';
import { chartHistory } from '../../src/features/foliotrace/ui/history.ts';
const read = (name: string) => JSON.parse(readFileSync(new URL(`../fixtures/foliotrace/${name}`, import.meta.url), 'utf8'));
const base = read('chart-snapshot-20261103.json');
const recovered = read('published-history-counts-20261104.json');
const reconstruction = read('valuation-series-20261103.json');
const counts = (p: any) => [p.trackedCount, p.pricedCount, p.unvaluedCount];

test('six original published records accept and display their archived counts with public precedence', () => {
  assert.equal(validSnapshot({ ...base, history: recovered, valuationSeries: reconstruction }, base.datasetVersion), true);
  const model = chartHistory(recovered, reconstruction, base);
  assert.deepEqual(model.published.slice(0, 6).map(counts), [
    [1192, 1175, 17], [1192, 1175, 17], [1192, 1174, 18], [1192, 1173, 19], [1192, 1173, 19], [1192, 1173, 19],
  ]);
  assert.ok(model.published.every(p => p.origin === 'published'));
  assert.deepEqual(model.published.map(p => p.estimatedValue), base.history.map((p: any) => p.estimatedValue));
  assert.equal(model.points.length, 19); assert.equal(model.reconstructed.length, 12);
  assert.deepEqual(model.reconstructed.map(counts), reconstruction.points.slice(0, 12).map(counts));
});

test('legacy counts stay absent even on overlapping reconstructed dates; only identical current revision can fill', () => {
  assert.equal(validPublishedHistory(base.history), true);
  const model = chartHistory(base.history, reconstruction, base);
  assert.ok(model.published.slice(0, 6).every(p => p.pricedCount === undefined));
  assert.deepEqual(counts(model.published.at(-1)), [base.trackedCount, base.pricedCount, base.trackedCount - base.pricedCount]);
  for (const current of [{ ...base, datasetVersion: 'f'.repeat(64) }, { ...base, valuationTradeDate: '2026-11-03' }]) {
    assert.equal(chartHistory(base.history, reconstruction, current).published.at(-1)?.pricedCount, undefined);
  }
});

test('published count group preserves zero and rejects partial or inconsistent groups', () => {
  const point = recovered[0];
  assert.equal(validPublishedHistory([{ ...point, trackedCount: 0, pricedCount: 0, unvaluedCount: 0 }]), true);
  const zero = chartHistory([{ ...point, trackedCount: 0, pricedCount: 0, unvaluedCount: 0 }]).published[0];
  assert.deepEqual(counts(zero), [0, 0, 0]);
  for (const patch of [
    { pricedCount: undefined }, { pricedCount: null }, { pricedCount: true }, { pricedCount: -1 },
    { pricedCount: 1.5 }, { pricedCount: '1175' }, { unvaluedCount: 0 }, { trackedCount: 10001 },
    { trackedCount: Number.MAX_SAFE_INTEGER + 1 },
  ]) {
    const history = [{ ...point, ...patch }];
    assert.equal(validPublishedHistory(history), false, JSON.stringify(patch));
    assert.equal(validSnapshot({ ...base, history }, base.datasetVersion), false);
    assert.equal(chartHistory(history as any).published[0].pricedCount, undefined);
  }
});

test('published counts retain priority over current totals and reconstructed data on duplicate dates', () => {
  const series = structuredClone(reconstruction);
  series.points.forEach((p: any) => { p.trackedCount = 1; p.pricedCount = 1; p.unvaluedCount = 0; });
  const model = chartHistory(recovered, series, { ...base, trackedCount: 2, pricedCount: 1 });
  assert.deepEqual(model.published.map(counts), recovered.map(counts));
  assert.equal(chartHistory(base.history, series).published[0].pricedCount, undefined);
});
