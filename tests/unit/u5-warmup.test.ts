import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { warmupU5Routes } from '../helpers/u5-send-warmup.mjs';

function harness(failPath = '') {
  const events: string[] = [];
  const page = { goto: async (path: string, options: any) => {
    events.push(path); assert.equal(options.timeout, 180000);
    if (path.endsWith(failPath) && failPath) throw new Error('synthetic');
    return { ok: () => true };
  }, locator: () => ({ first: () => ({ waitFor: async () => { events.push('ready'); } }) }),
  waitForLoadState: async () => { events.push('settled'); } };
  const context = { route: async () => {}, newPage: async () => page, close: async () => { events.push('closed'); } };
  return { browser: { newContext: async () => context }, events };
}
const routes = [{ path: '/one', selector: 'input' }, { path: '/two', selector: 'input' }];
test('U5 warmup completes every route before smoke cases and writes a separate report', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'u5-warmup-test-'));
  try {
    const h = harness(), reportPath = join(dir, 'warmup.json');
    await warmupU5Routes(h.browser, { base: 'http://localhost', routes: [{ ...routes[0], prepare: async () => { h.events.push('prepared'); } }, routes[1]], reportPath });
    h.events.push('smoke-start');
    assert.deepEqual(h.events, ['http://localhost/one', 'ready', 'prepared', 'settled', 'http://localhost/two', 'ready', 'settled', 'closed', 'smoke-start']);
    const report = JSON.parse(await readFile(reportPath, 'utf8'));
    assert.equal(report.phase, 'warmup'); assert.equal(report.status, 'passed');
    assert.equal(report.routes.length, 2);
  } finally { await rm(dir, { recursive: true }); }
});
test('U5 warmup records failures, continues remaining warmup routes and never starts smoke cases', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'u5-warmup-test-'));
  try {
    const h = harness('/one'), reportPath = join(dir, 'warmup.json'); let smokeStarted = false;
    await assert.rejects(async () => {
      await warmupU5Routes(h.browser, { base: 'http://localhost', routes, reportPath }); smokeStarted = true;
    }, /warmup failed; smoke cases were not started/);
    assert.equal(smokeStarted, false); assert.equal(h.events.at(-1), 'closed');
    const report = JSON.parse(await readFile(reportPath, 'utf8'));
    assert.equal(report.status, 'failed'); assert.deepEqual(report.routes.map((r: any) => r.status), ['failed', 'passed']);
    assert.equal(report.routes[0].errorType, 'Error');
  } finally { await rm(dir, { recursive: true }); }
});
test('U5 warmup rejects an empty selection before creating a browser context', async () => {
  await assert.rejects(warmupU5Routes({ newContext: () => assert.fail('zero routes must not run') }, { base: 'http://localhost', routes: [], reportPath: '/unused' }), /at least one route/);
});
test('U5 warmup setup failures are saved separately and cannot become a passing report', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'u5-warmup-test-'));
  try {
    const reportPath = join(dir, 'warmup.json');
    await assert.rejects(warmupU5Routes({ newContext: async () => { throw Error('synthetic'); } }, { base: 'http://localhost', routes, reportPath }), /smoke cases were not started/);
    const report = JSON.parse(await readFile(reportPath, 'utf8'));
    assert.equal(report.status, 'failed'); assert.equal(report.routes[0].stage, 'setup');
  } finally { await rm(dir, { recursive: true }); }
});

test('U5 lazy Worker preparation failures remain warmup failures before smoke starts', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'u5-warmup-test-'));
  try {
    const h = harness(), reportPath = join(dir, 'warmup.json');
    await assert.rejects(warmupU5Routes(h.browser, { base: 'http://localhost', reportPath,
      routes: [{ ...routes[0], prepare: async () => { throw Error('synthetic Worker failure'); } }, routes[1]],
    }), /smoke cases were not started/);
    const report = JSON.parse(await readFile(reportPath, 'utf8'));
    assert.deepEqual(report.routes.map((r: any) => r.status), ['failed', 'passed']);
    assert.equal(report.phase, 'warmup'); assert.equal(h.events.at(-1), 'closed');
  } finally { await rm(dir, { recursive: true }); }
});
