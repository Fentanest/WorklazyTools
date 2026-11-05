import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { chartHistory, formatHistoryDate, formatHistoryAxis } from '../../src/features/foliotrace/ui/history.ts';
const snapshot = JSON.parse(readFileSync(new URL('../fixtures/foliotrace/chart-snapshot-20261103.json', import.meta.url), 'utf8'));
const reconstruction = JSON.parse(readFileSync(new URL('../fixtures/foliotrace/valuation-series-20261103.json', import.meta.url), 'utf8'));

test('legacy seven points remain published without an extension', () => {
  const model = chartHistory(snapshot.history);
  assert.equal(model.points.length, 7); assert.equal(model.published.length, 7);
  assert.equal(model.reconstructed.length, 0);
  assert.equal(model.lineData.length, 7);
});

test('19-point sample projects to 12 reconstructed plus 7 public points, with public precedence', () => {
  const model = chartHistory(snapshot.history, reconstruction);
  assert.equal(model.points.length, 19); assert.equal(model.published.length, 7); assert.equal(model.reconstructed.length, 12);
  assert.equal(new Set(model.points.map(point => point.tradeDate)).size, 19);
  assert.equal(model.points.at(-1)?.estimatedValue, snapshot.history.at(-1).estimatedValue);
  assert.notEqual(model.points.at(-1)?.estimatedValue, reconstruction.points.at(-1).estimatedValue);
  assert.deepEqual(model.lineData, model.points.map(point => ({ time: point.tradeDate, value: point.plotValue })));
  assert.deepEqual(model.lineData.map(point => point.time), [...model.lineData.map(point => point.time)].sort());
});

test('missing values remain whitespace in the single series; zero is plotted without filling gaps', () => {
  const value = structuredClone(reconstruction); value.points[4].estimatedValue = null; value.points[6].estimatedValue = '0';
  const model = chartHistory([], value);
  assert.equal(model.points[4].plotValue, null); assert.equal(model.points[6].plotValue, 0);
  assert.deepEqual(model.lineData[4], { time: value.points[4].tradeDate });
  assert.deepEqual(model.lineData[6], { time: value.points[6].tradeDate, value: 0 });
  assert.equal(model.lineData.length, value.points.length);
});

test('one and two points have no trend chart, three points do', () => {
  for (const count of [0, 1, 2]) assert.equal(chartHistory(snapshot.history.slice(0, count)).available, false);
  assert.equal(chartHistory(snapshot.history.slice(0, 3)).available, true);
});

test('chart coordinates may be approximate but preserve the original exact value and do not use infinity', () => {
  const model = chartHistory([{ tradeDate: '2026-01-01', estimatedValue: '9007199254740993.25', datasetVersion: 'a'.repeat(64) }]);
  assert.equal(model.points[0].estimatedValue, '9007199254740993.25');
  const huge = chartHistory([{ tradeDate: '2026-01-01', estimatedValue: '1' + '0'.repeat(400), datasetVersion: 'a'.repeat(64) }]);
  assert.equal(huge.points[0].plotValue, null); assert.equal(huge.available, false);
});

test('portfolio-sized KRW values are scaled below the native chart data limit', () => {
  const model = chartHistory(snapshot.history, reconstruction);
  assert.equal(model.points[0].estimatedValue, '440605701324954');
  assert.ok(model.points.every(point => point.plotValue !== null && Math.abs(point.plotValue) < 1000));
});

test('axis and date labels use the selected language and explicit KRW units', () => {
  assert.match(formatHistoryAxis(369000000000000, 'ko'), /조원/);
  assert.match(formatHistoryAxis(369000000000000, 'en'), /₩.*T/);
  assert.match(formatHistoryDate('2026-11-02', 'ko'), /2026.*11.*2/);
  assert.match(formatHistoryDate('2026-11-02', 'en'), /Nov.*2.*2026/);
});
