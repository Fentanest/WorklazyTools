import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { validSnapshot } from '../../src/features/foliotrace/data/loadSnapshot.ts';
import { validatePublicData } from '../../scripts/foliotrace-public-data.mjs';

const base = JSON.parse(readFileSync(new URL('../fixtures/foliotrace/chart-snapshot-20261103.json', import.meta.url), 'utf8'));
const series = JSON.parse(readFileSync(new URL('../fixtures/foliotrace/valuation-series-20261103.json', import.meta.url), 'utf8'));
const accept = (extension: unknown) => validSnapshot({ ...base, valuationSeries: extension }, base.datasetVersion);

test('legacy public history and the supplied 19-point reconstruction both validate', () => {
  assert.equal(validSnapshot(base, base.datasetVersion), true);
  assert.equal(accept(series), true);
  assert.equal(base.history.length, 7); assert.equal(series.points.length, 19);
});

test('invalid reconstruction origin, identity and policy cannot silently become public history', () => {
  for (const mutate of [
    s => { s.points[0].reconstructed = false; }, s => { s.points[0].kind = 'published'; },
    s => { s.points[0].datasetVersion = 'a'.repeat(64); }, s => { s.portfolioId = 'other'; },
    s => { s.currency = 'USD'; }, s => { s.points[0].calculationPolicyRevision = 'different'; },
    s => { s.points[0].methodologyVersion = '1'; }, s => { s.knowledgePolicy = 'public-vintage'; },
    s => { s.points[0].quantityOrigin = ['stored-assembly']; },
  ] as Array<(value: any) => void>) {
    const value = structuredClone(series); mutate(value); assert.equal(accept(value), false);
  }
  assert.equal(accept(null), false);
});

test('reconstruction dates must be real, ascending, unique and within the declared knowledge cut', () => {
  for (const mutate of [
    s => { s.points.reverse(); }, s => { s.points[1].tradeDate = s.points[0].tradeDate; },
    s => { s.points[0].tradeDate = '2026-02-30'; }, s => { s.points[0].knowledgeCutoff = '2026-10-07'; },
    s => { s.points[0].holdingsAssemblyDate = '2099-01-01'; },
  ] as Array<(value: any) => void>) {
    const value = structuredClone(series); mutate(value); assert.equal(accept(value), false);
  }
  const history = [...base.history].reverse();
  assert.equal(validSnapshot({ ...base, history }, base.datasetVersion), false);
  assert.equal(validSnapshot({ ...base, history: [base.history[0], base.history[0]] }, base.datasetVersion), false);
});

test('priced, unvalued, exclusions and coverage counts must agree', () => {
  for (const mutate of [
    s => { s.points[0].pricedCount++; }, s => { s.points[0].unvaluedCount = -1; },
    s => { s.points[0].exclusionCounts.corporate_action_pending++; },
    s => { s.points[0].trackedCount = Number.MAX_SAFE_INTEGER + 1; },
    s => { s.points[0].valuationCoverage = 'complete'; },
    s => { s.points[0].estimatedValue = '1e15'; }, s => { s.points[0].estimatedValue = -1; },
  ] as Array<(value: any) => void>) {
    const value = structuredClone(series); mutate(value); assert.equal(accept(value), false);
  }
});

test('null reconstruction value is a declared gap, distinct from a valued zero', () => {
  const missing = structuredClone(series), point = missing.points[0];
  point.estimatedValue = null; assert.equal(accept(missing), true);
  Object.assign(point, { estimatedValue: null, pricedCount: 0, unvaluedCount: point.trackedCount,
    valuationCoverage: 'unavailable', exclusionCounts: { quote_unverified: point.trackedCount } });
  assert.equal(accept(missing), true);
  const zero = structuredClone(series); zero.points[0].estimatedValue = '0'; assert.equal(accept(zero), true);
});

test('reconstruction point budget allows 1000 and rejects 1001', () => {
  const value = structuredClone(series);
  value.points = Array.from({ length: 1000 }, (_, i) => {
    const day = new Date(Date.UTC(2020, 0, 1 + i)).toISOString().slice(0, 10);
    return { ...series.points[0], tradeDate: day, knowledgeCutoff: day, holdingsAssemblyDate: day };
  });
  assert.equal(accept(value), true);
  value.points.push({ ...value.points.at(-1), tradeDate: '2022-09-27', knowledgeCutoff: '2022-09-27' });
  assert.equal(accept(value), false);
});

test('public file validator also accepts the extension and rejects inconsistent reconstruction counts', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'f6-public-validator-'));
  try {
    const dir = path.join(root, 'data/foliotrace/v1'); await fs.mkdir(path.join(dir, 'snapshots'), { recursive: true });
    const write = async (extension: unknown) => {
      const body = JSON.stringify({ ...base, valuationSeries: extension });
      await fs.writeFile(path.join(dir, `snapshots/${base.datasetVersion}.json`), body);
      await fs.writeFile(path.join(dir, 'manifest.json'), JSON.stringify({ schemaVersion: 1, datasetVersion: base.datasetVersion,
        snapshotPath: `snapshots/${base.datasetVersion}.json`, snapshotSha256: createHash('sha256').update(body).digest('hex') }));
    };
    await write(series); assert.equal((await validatePublicData(root)).snapshot.valuationSeries.points.length, 19);
    const invalid = structuredClone(series); invalid.points[0].unvaluedCount++;
    await write(invalid); await assert.rejects(validatePublicData(root), /schema/);
  } finally { await fs.rm(root, { recursive: true, force: true }); }
});
