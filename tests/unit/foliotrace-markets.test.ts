import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import type { Holding } from '../../src/features/foliotrace/contracts.ts';
import { validSnapshot } from '../../src/features/foliotrace/data/loadSnapshot.ts';
import { groupHoldingsByMarket, marketAllocation, marketOf } from '../../src/features/foliotrace/ui/markets.ts';

function holding(stockCode: string, estimatedValue: string | null): Holding {
  return { stockCode, estimatedValue } as Holding;
}

test('official short-code mapping distinguishes preferred shares, KDRs and unknown codes', () => {
  assert.equal(marketOf('005930'), 'KOSPI');
  assert.equal(marketOf('005935'), 'KOSPI');
  assert.equal(marketOf('950160'), 'KOSDAQ');
  assert.equal(marketOf('102950'), 'KONEX');
  assert.equal(marketOf('999999'), 'UNKNOWN');
});

test('market fixture still satisfies the unchanged loader contract', () => {
  const snapshot = JSON.parse(readFileSync(new URL('../fixtures/foliotrace/market-holdings.json', import.meta.url), 'utf8'));
  assert.equal(validSnapshot(snapshot, snapshot.datasetVersion), true);
  assert.equal(marketAllocation(snapshot.holdings).total, '115000000');
});

test('official reference has dated provenance and complete accepted market mappings', () => {
  const reference = JSON.parse(readFileSync(new URL('../../src/features/foliotrace/data/marketReference.json', import.meta.url), 'utf8'));
  assert.match(reference.asOfDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(reference.sourceSha256, /^[a-f0-9]{64}$/);
  assert.equal(Object.keys(reference.markets).length, Object.values(reference.counts).reduce((a: number, b) => a + (b as number), 0));
  assert.ok(Object.values(reference.markets).every(market => ['KOSPI', 'KOSDAQ', 'KONEX'].includes(market as string)));
});

test('grouping preserves all rows and their references, including unpriced/other markets', () => {
  const rows = Object.freeze([holding('005930', '100'), holding('086520', null), holding('999999', '25')]);
  const groups = groupHoldingsByMarket(rows);
  assert.deepEqual(groups.KOSPI, [rows[0]]); assert.deepEqual(groups.KOSDAQ, [rows[1]]);
  assert.deepEqual(groups.UNKNOWN, [rows[2]]); assert.deepEqual(groups.KONEX, []);
});

test('market values and percentages retain amounts above 2^53 and fractional won exactly', () => {
  const result = marketAllocation([holding('005930', '9007199254740993.25'), holding('086520', '3002399751580331.75')]);
  assert.equal(result.total, '12009599006321325'); assert.equal(result.available, true);
  assert.equal(result.markets.KOSPI.amount, '9007199254740993.25');
  assert.equal(result.markets.KOSPI.percent, '75.00'); assert.equal(result.markets.KOSDAQ.percent, '25.00');
});

test('unknown market value stays in the denominator; null prices do not become zero-valued holdings', () => {
  const result = marketAllocation([holding('005930', '0.1'), holding('086520', '0.2'), holding('999999', '0.1'), holding('005935', null)]);
  assert.equal(result.total, '0.4'); assert.equal(result.markets.KOSPI.percent, '25.00');
  assert.equal(result.markets.KOSDAQ.percent, '50.00'); assert.equal(result.markets.UNKNOWN.percent, '25.00');
  assert.equal(result.markets.KOSPI.count, 2); assert.equal(result.markets.KOSPI.pricedCount, 1);
});

test('zero, unavailable and negative amounts do not fabricate a usable percentage', () => {
  for (const rows of [[], [holding('005930', null)], [holding('005930', '0')], [holding('005930', '-1'), holding('086520', '2')]]) {
    const result = marketAllocation(rows); assert.equal(result.available, false);
    for (const group of Object.values(result.markets)) assert.equal(group.percent, null);
  }
});

test('market allocation ignores stored portfolio percentages and does not modify its input', () => {
  const row = Object.freeze({ ...holding('005930', '1'), portfolioWeightPercent: '99.999' });
  const result = marketAllocation(Object.freeze([row, Object.freeze(holding('086520', '2'))]));
  assert.equal(result.markets.KOSPI.percent, '33.33'); assert.equal(result.markets.KOSDAQ.percent, '66.67');
  assert.equal(row.portfolioWeightPercent, '99.999');
});
