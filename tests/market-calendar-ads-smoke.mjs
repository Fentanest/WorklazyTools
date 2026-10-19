import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { installAdFirewall, createCounters, assertNoRealNetwork, ADSENSE_SCRIPT_URL, stubScriptBody } from './helpers/ad-stub.mjs';

// Seven publication states plus Astra's other-tool -> missing-calendar residue.
// Every provider request is stubbed or blocked; the synthetic SDK renders an iframe.
const origin = process.env.MCAL_ORIGIN || 'http://127.0.0.1:4427';
const output = process.env.MCAL_OUTPUT_DIR || '.review-tmp/mcal-r2';
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.WORKLAZY_CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
let passed = 0;
const errors = [], observations = [];
try {
  for (const mode of ['ready', 'loading', 'missing', 'error', 'corrupt', 'empty', 'ready-to-missing', 'other-tool-to-missing']) {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const counters = createCounters();
    await installAdFirewall(context, origin, counters);
    await context.route(ADSENSE_SCRIPT_URL, async route => {
      counters.attempt++; counters.stub++;
      await route.fulfill({ contentType: 'application/javascript', body: stubScriptBody() + `
        const ad=document.createElement('iframe');ad.id='mcal-rendered-auto-ad';ad.className='google-auto-placed';
        ad.title='Synthetic already rendered Auto Ad';ad.srcdoc='<body style="background:#ffe28a">Synthetic rendered ad</body>';
        ad.style='position:fixed;right:20px;bottom:20px;width:300px;height:80px;z-index:9999';document.documentElement.append(ad);` });
    });
    await context.addInitScript(() => { if (window === window.top) { window.__WORKLAZY_MOCK_PROVIDERS__ = true; window.__mcalDocumentToken = crypto.randomUUID(); } });
    let release;
    const waiting = new Promise(resolve => { release = resolve; });
    let missing = false;
    const payload = mode === 'empty' ? '[]' : JSON.stringify([{ date: '20261119', venue: 'krx', status: 'unknown', sessions: [], special: null, reason: '필수 expected 근거 미확보: krx-kospi-2026-exam', notes: [], sources: [] }]);
    const manifest = { schema_version: 1, generation_id: 'ads-regression', created_at: '2026-10-19T00:00:00Z', files: [{ year: 2026, path: 'calendar-2026.json', sha256: createHash('sha256').update(payload).digest('hex') }], scopes: [{ venue: 'krx', year: 2026, included: true, validity: 'valid', last_checked_at: '2026-10-19T00:00:00Z', reason: null }] };
    await context.route('**/data/market-calendar/v1/**', async route => {
      if (mode === 'loading') { await waiting; return route.abort().catch(() => {}); }
      if (mode === 'missing' || missing || mode === 'error') return route.fulfill({ status: mode === 'error' ? 500 : 404, body: '' });
      return route.fulfill({ status: 200, contentType: 'application/json', body: route.request().url().endsWith('/manifest.json') ? JSON.stringify(manifest) : payload + (mode === 'corrupt' ? ' ' : '') });
    });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push({ mode, message: String(error) }));
    await page.clock.install({ time: new Date('2026-11-19T12:00:00Z') });
    const observe = async state => {
      const value = await page.evaluate(() => ({ documentToken: window.__mcalDocumentToken, ads: document.querySelectorAll('script[data-worklazy-adsense]').length, renderedAds: document.querySelectorAll('#mcal-rendered-auto-ad, .wl-ad-stub-marker, .google-auto-placed').length, coupang: document.querySelectorAll('iframe.coupang-banner-frame').length, calendar: !!document.querySelector('.mcal-grid') }));
      observations.push({ mode, state, ...value, attempts: counters.attempt });
      return value;
    };
    try {
      const transition = mode === 'ready-to-missing' || mode === 'other-tool-to-missing';
      await page.goto(`${origin}/en/tools/${mode === 'other-tool-to-missing' ? 'text-merger' : 'market-calendar'}/`);
      if (mode !== 'other-tool-to-missing') await page.locator('[data-tool-page="market-calendar"]').waitFor();
      let initial;
      if (mode === 'ready' || transition) {
        await page.locator('#mcal-rendered-auto-ad').waitFor();
        initial = await observe('ad-bearing-document');
        assert.ok(initial.renderedAds > 0);
        if (mode !== 'other-tool-to-missing') await page.locator('.mcal-grid').waitFor();
      }
      if (transition) {
        missing = true;
        if (mode === 'ready-to-missing') await page.getByRole('button', { name: 'Refresh', exact: true }).click();
        else await page.locator('aside a[href="/en/tools/market-calendar"]').click();
        await page.getByText('No schedule is available yet. Please check again later.', { exact: true }).waitFor();
        await page.waitForFunction(token => window.__mcalDocumentToken !== token, initial.documentToken);
      }
      await page.waitForTimeout(650);
      const current = await observe('settled');
      if (mode === 'ready') { assert.equal(current.ads, 1); assert.ok(current.renderedAds > 0); assert.equal(counters.attempt, 1); }
      else {
        assert.equal(current.ads, 0, `${mode}: script must be removed, pause is insufficient`);
        assert.equal(current.renderedAds, 0, `${mode}: rendered iframe and SDK residue must be removed`);
        assert.equal(current.coupang, 0);
        assert.equal(counters.attempt, transition ? 1 : 0, 'no new ad script request in unavailable state');
        if (transition) {
          assert.notEqual(current.documentToken, initial.documentToken, 'common document transition must remove SDK callbacks and ads');
          await page.screenshot({ path: `${output}/ad-residue-${mode}.png`, fullPage: true });
          missing = false;
          await page.getByRole('button', { name: 'Refresh', exact: true }).click();
          await page.locator('.mcal-grid').waitFor(); await page.locator('#mcal-rendered-auto-ad').waitFor();
          assert.equal(counters.attempt, 2, 'recovered valid calendar permits ads again');
          await observe('recovered');
        }
      }
      assertNoRealNetwork(counters, mode);
      assert.equal(errors.length, 0, JSON.stringify(errors));
      console.log(`ok ${++passed} - ${mode}`);
    } finally { release(); await context.close(); }
  }
} finally {
  await browser.close();
  await fs.writeFile(`${output}/ad-residue.json`, JSON.stringify({ observations, errors, passed }, null, 2));
}
console.log(`1..${passed}\n# tests ${passed}\n# pass ${passed}\n# fail 0`);
