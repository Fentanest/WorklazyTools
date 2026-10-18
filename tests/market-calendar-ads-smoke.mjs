import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { installAdFirewall, createCounters, assertNoRealNetwork } from './helpers/ad-stub.mjs';

// Astra's seven-state regression. Every provider request is stubbed or blocked.
// Run against a production preview: MCAL_ORIGIN=http://127.0.0.1:4427 node tests/market-calendar-ads-smoke.mjs
const origin = process.env.MCAL_ORIGIN || 'http://127.0.0.1:4427';
const browser = await chromium.launch({ executablePath: process.env.WORKLAZY_CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
let passed = 0;
const errors = [];
try {
  for (const mode of ['ready', 'loading', 'missing', 'error', 'corrupt', 'empty', 'ready-to-missing']) {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const counters = createCounters();
    await installAdFirewall(context, origin, counters);
    await context.addInitScript(() => { if (window === window.top) window.__WORKLAZY_MOCK_PROVIDERS__ = true; });
    let release;
    const waiting = new Promise(resolve => { release = resolve; });
    let missing = false;
    const payload = mode === 'empty' ? '[]' : JSON.stringify([{ date: '20261119', venue: 'krx', status: 'unknown', sessions: [], special: null, reason: '필수 expected 근거 미확보: krx-kospi-2026-exam', notes: [], sources: [] }]);
    const manifest = { schema_version: 1, generation_id: 'ads-regression', created_at: '2026-10-19T00:00:00Z', files: [{ year: 2026, path: 'calendar-2026.json', sha256: createHash('sha256').update(payload).digest('hex') }], scopes: [{ venue: 'krx', year: 2026, included: true, validity: 'valid', last_checked_at: '2026-10-19T00:00:00Z', reason: null }] };
    await context.route('**/data/market-calendar/v1/**', async route => {
      if (mode === 'loading') { await waiting; return route.abort().catch(() => {}); }
      if (mode === 'missing' || missing || mode === 'error') return route.fulfill({ status: mode === 'error' ? 500 : 404, body: '' });
      const isManifest = route.request().url().endsWith('/manifest.json');
      return route.fulfill({ status: 200, contentType: 'application/json', body: isManifest ? JSON.stringify(manifest) : payload + (mode === 'corrupt' ? ' ' : '') });
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push({ mode, message: String(error) }));
    // Fixed date ensures the synthetic November data is the displayed month.
    await page.clock.install({ time: new Date('2026-11-19T12:00:00Z') });
    try {
      await page.goto(`${origin}/en/tools/market-calendar/`);
      await page.locator('[data-tool-page="market-calendar"]').waitFor();
      if (mode === 'ready' || mode === 'ready-to-missing') {
        await page.locator('.mcal-grid').waitFor();
        await page.waitForFunction(() => Boolean(document.querySelector('script[data-worklazy-adsense]')));
      }
      if (mode === 'ready-to-missing') {
        missing = true;
        await page.getByRole('button', { name: 'Reload published data' }).click();
        await page.getByText('No published market calendar is available.', { exact: true }).waitFor();
      }
      await page.waitForTimeout(650);
      const ads = await page.locator('script[data-worklazy-adsense]').count();
      const pause = await page.evaluate(() => window.adsbygoogle?.pauseAdRequests ?? null);
      if (mode === 'ready') { assert.equal(ads, 1); assert.equal(counters.attempt, 1); }
      else if (mode === 'ready-to-missing') {
        assert.ok(ads === 0 || pause === 1, 'loaded Auto Ads must be paused after publication disappears');
        assert.equal(await page.locator('iframe.coupang-banner-frame').count(), 0);
        assert.equal(counters.attempt, 1, 'no new ad script request after failure');
      } else { assert.equal(counters.attempt, 0, `${mode} must not request ads`); assert.equal(ads, 0); }
      assertNoRealNetwork(counters, mode);
      assert.equal(errors.length, 0, JSON.stringify(errors));
      console.log(`ok ${++passed} - ${mode}`);
    } finally {
      release();
      await context.close();
    }
  }
} finally { await browser.close(); }
console.log(`1..${passed}\n# tests ${passed}\n# pass ${passed}\n# fail 0`);
