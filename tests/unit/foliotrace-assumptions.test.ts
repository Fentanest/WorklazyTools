import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { validSnapshot, loadFolioTraceSnapshot } from '../../src/features/foliotrace/data/loadSnapshot.ts';
import { holdingStatus, filterHoldings, assumptionSummary, quantityAssumptionLabel, exclusionReasonLabel, filingChangesForHoldings } from '../../src/features/foliotrace/ui/holdings.ts';
import { chartHistory } from '../../src/features/foliotrace/ui/history.ts';

const read = (name: string) => JSON.parse(readFileSync(new URL(`../fixtures/foliotrace/${name}.json`, import.meta.url), 'utf8'));
const fresh = read('assumption-replay-20261113');
const old = read('chart-snapshot-20261103');

test('fixed old and replay-derived new snapshots retain chart, history and rows in the real loader', async t => {
  for (const snapshot of [old, fresh]) {
    assert.equal(validSnapshot(snapshot, snapshot.datasetVersion), true);
    const body = JSON.stringify(snapshot);
    const manifest = { schemaVersion: 1, datasetVersion: snapshot.datasetVersion,
      snapshotPath: `snapshots/${snapshot.datasetVersion}.json`, snapshotSha256: createHash('sha256').update(body).digest('hex') };
    t.mock.method(globalThis, 'fetch', async (url: string) => String(url).endsWith('manifest.json') ? Response.json(manifest) : new Response(body));
    const view = await loadFolioTraceSnapshot();
    assert.equal(view.status, 'ready');
    if (view.status === 'ready') {
      assert.equal(view.chartUnavailable, undefined);
      assert.deepEqual(view.snapshot, snapshot);
      assert.equal(chartHistory(snapshot.history, snapshot.valuationSeries, snapshot).available, true);
    }
    t.mock.restoreAll();
  }
});

test('all 16 replay assumptions are included, separately classified and counted with exact amounts', () => {
  const assumed = filterHoldings(fresh.holdings, '', 'assumed');
  assert.equal(assumed.length, 16);
  assert.ok(assumed.every(h => holdingStatus(h) === 'assumed'));
  assert.ok(assumed.some(h => h.quantityAdjustment));
  assert.equal(filterHoldings(fresh.holdings, '', 'priced').length, 17);
  assert.equal(filterHoldings(fresh.holdings, '', 'unpriced').length, 1);
  assert.ok(filterHoldings(fresh.holdings, '', 'unpriced').every(h => !h.quantityAssumption));
  assert.deepEqual(assumptionSummary(fresh.holdings), { count: 16, value: '220522672863' });
  assert.deepEqual(assumptionSummary(old.holdings), { count: 0, value: '0' });
  assert.deepEqual(assumptionSummary([{ ...assumed[0], estimatedValue: '9007199254740993.25' }, { ...assumed[1], estimatedValue: '0.75' }]),
    { count: 2, value: '9007199254740994' });
  assert.deepEqual(assumptionSummary([{ ...assumed[0], estimatedValue: '-5.25' }, { ...assumed[1], estimatedValue: '3.25' }]),
    { count: 2, value: '-2' });
});

test('assumption structure rejects malformed evidence and assumptions on excluded rows', () => {
  for (const mutate of [
    a => { a.code = 3; }, a => { a.offerings = []; }, a => { a.offerings = Array(21).fill(a.offerings[0]); },
    a => { a.offerings[0].receiptNo = 'javascript:alert(1)'; }, a => { a.offerings[0].listingDate = '2026-02-30'; },
    a => { a.offerings[0].shares = 100; }, a => { a.offerings[0].shares = '-1'; }, a => { a.offerings[0].shares = '1e5'; },
  ] as Array<(value: any) => void>) {
    const value = structuredClone(fresh); mutate(value.holdings.find(h => h.quantityAssumption).quantityAssumption);
    assert.equal(validSnapshot(value, value.datasetVersion), false);
  }
  const excluded = structuredClone(fresh);
  excluded.holdings.find(h => h.estimatedValue === null).quantityAssumption = fresh.holdings.find(h => h.quantityAssumption).quantityAssumption;
  assert.equal(validSnapshot(excluded, excluded.datasetVersion), false);
  const absent = structuredClone(old); absent.holdings[0].quantityAssumption = null;
  assert.equal(validSnapshot(absent, absent.datasetVersion), true);
});

test('unknown valid codes remain assumptions with safe localized wording; exclusion codes also stay private', () => {
  const value = structuredClone(fresh), row = value.holdings.find(h => h.quantityAssumption);
  row.quantityAssumption.code = 'future_assumption';
  assert.equal(validSnapshot(value, value.datasetVersion), true);
  assert.equal(holdingStatus(row), 'assumed');
  for (const lang of ['ko', 'en'] as const) {
    assert.doesNotMatch(quantityAssumptionLabel('future_assumption', lang), /future_assumption/);
    assert.doesNotMatch(exclusionReasonLabel('future_reason', lang)!, /future_reason/);
    assert.match(quantityAssumptionLabel('rights_offering_not_subscribed', lang), lang === 'ko' ? /청약하지 않은/ : /assumed not subscribed/);
  }
});

test('mixed methods allow only current v3 with the named historical v2 policy; other mismatches fail', () => {
  assert.equal(validSnapshot(fresh, fresh.datasetVersion), true);
  for (const mutate of [
    s => { s.portfolio.methodologyVersion = '4'; }, s => { s.valuationSeries.calculationPolicyRevision = 'other-policy'; s.valuationSeries.points.forEach(p => p.calculationPolicyRevision = 'other-policy'); },
    s => { s.valuationSeries.methodologyVersion = '3'; s.valuationSeries.points.forEach(p => p.methodologyVersion = '3'); },
    s => { s.valuationSeries.points[0].methodologyVersion = '3'; }, s => { s.history[0].methodologyVersion = '4'; },
    s => { s.history[0].methodologyVersion = 2; }, s => { s.history.at(-1).methodologyVersion = '2'; },
    s => { s.portfolio.methodologyVersion = '2'; },
  ] as Array<(value: any) => void>) {
    const value = structuredClone(fresh); mutate(value); assert.equal(validSnapshot(value, value.datasetVersion), false);
  }
});

test('method change date and original versions survive projection, including missing legacy methods', () => {
  const model = chartHistory(fresh.history, fresh.valuationSeries, fresh);
  assert.deepEqual(model.methodChanges, [{ tradeDate: '2026-11-11', from: '2', to: '3' }]);
  assert.equal(model.points.at(-1)?.methodologyVersion, '3');
  assert.ok(model.points.slice(0, -1).every(p => p.methodologyVersion === '2'));
  const history = structuredClone(fresh.history); delete history.at(-2).methodologyVersion;
  const missing = chartHistory(history, fresh.valuationSeries, fresh);
  assert.equal(missing.points.at(-2)?.methodologyVersion, undefined);
  assert.deepEqual(missing.methodChanges, [{ tradeDate: '2026-11-11', from: undefined, to: '3' }]);
  assert.deepEqual(chartHistory(old.history).methodChanges, []);
});

test('quantity assumptions are never coloured as a reported trade', () => {
  const row = fresh.holdings.find(h => h.quantityAssumption && !h.quantityAdjustment);
  const current = { corpCode: row.corpCode, stockCode: row.stockCode, receiptNo: row.receiptNo, receiptDate: row.receiptDate,
    quantity: row.quantity, companyOwnershipPercent: row.companyOwnershipPercent, source: 'dart-document', kind: 'increase', correctionOf: null, isCorrectionOrWithdrawal: false, filingUrl: null };
  assert.equal(filingChangesForHoldings([{ ...row, evidence: 'dart-document' }], [{ ...current, receiptNo: '20000101000001', receiptDate: '2000-01-01', quantity: '1' }, current]).size, 0);
});


test('missing method metadata neither hides a known change nor invents a repeated change', () => {
  const point = fresh.history[0];
  const history = ['2', undefined, '3', undefined, '3'].map((methodologyVersion, i) =>
    ({ ...point, tradeDate: `2026-10-${20 + i}`, methodologyVersion }));
  assert.deepEqual(chartHistory(history).methodChanges, [{ tradeDate: '2026-10-22', from: undefined, to: '3' }]);
});
