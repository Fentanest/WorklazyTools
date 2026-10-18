import { selectCalendarValue } from './helpers/market-calendar-selection.mjs';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import { installAdFirewall, createCounters, assertNoRealNetwork, ADSENSE_SCRIPT_URL, stubScriptBody } from './helpers/ad-stub.mjs';
const origin = process.env.MCAL_ORIGIN || 'http://127.0.0.1:4427';
const output = process.env.MCAL_OUTPUT_DIR || '.review-tmp/mcal-r3';
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.WORKLAZY_CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const results = [];
try {
  for (const language of ['ko', 'en']) {
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 1000 } });
    const counters = createCounters(), errors = [];
    await installAdFirewall(context, origin, counters);
    await context.route(ADSENSE_SCRIPT_URL, async route => {
      counters.attempt++; counters.stub++;
      await route.fulfill({ contentType: 'application/javascript', body: stubScriptBody() + `const ad=document.createElement('iframe');ad.id='held-rendered-auto-ad';ad.className='google-auto-placed';ad.title='Synthetic rendered ad';ad.srcdoc='<body>Ad stub</body>';document.documentElement.append(ad);` });
    });
    await context.addInitScript(() => { if (window === window.top) { window.__WORKLAZY_MOCK_PROVIDERS__ = true; window.__heldDocumentToken = crypto.randomUUID(); } });
    const page = await context.newPage(); page.on('pageerror', e => errors.push(String(e)));
    const observe = () => page.evaluate(() => {
      const caption = document.querySelector('.mcal-grid caption')?.textContent;
      const yearMonth = caption?.match(/(\d{4})-(\d{2})$/);
      return {
        url: location.href, documentToken: window.__heldDocumentToken,
        selection: [document.querySelector('.mcal-controls select')?.value, yearMonth?.[1], String(Number(yearMonth?.[2]))],
        caption,
        warnings: [...document.querySelectorAll('.mcal-warning')].map(e => e.textContent),
        ads: document.querySelectorAll('script[data-worklazy-adsense]').length,
        residue: document.querySelectorAll('#held-rendered-auto-ad, .google-auto-placed, .wl-ad-stub-marker, iframe.coupang-banner-frame').length,
      };
    });
    try {
      await page.goto(`${origin}/${language}/tools/market-calendar/`);
      await page.locator('.mcal-grid').waitFor(); await page.locator('#held-rendered-auto-ad').waitFor();
      await selectCalendarValue(page, 0, 'nasdaq');
      await selectCalendarValue(page, 1, '2026');
      await selectCalendarValue(page, 2, '11');
      const before = await observe();
      assert.deepEqual(before.selection, ['nasdaq', '2026', '11']); assert.equal(before.ads, 1); assert.ok(before.residue > 0);
      await selectCalendarValue(page, 1, '2027');
      await page.waitForFunction(token => window.__heldDocumentToken !== token, before.documentToken);
      await page.locator('.mcal-grid').waitFor();
      // The user-facing UI has one pending message, not two internal-state warnings.
      await page.getByText(language === 'ko' ? '이 거래소의 일정은 아직 확정되지 않았어요.' : 'The schedule for this exchange is not confirmed yet.', { exact: true }).waitFor();
      const after = await observe();
      const assertHeld = state => {
        assert.deepEqual(state.selection, ['nasdaq', '2027', '11']); assert.equal(state.caption, 'NASDAQ · 2027-11');
        assert.match(state.warnings.join(' '), language === 'ko' ? /일정은 아직 확정되지 않았어요/ : /schedule for this exchange is not confirmed yet/);
        assert.equal(new Set(state.warnings).size, state.warnings.length, 'no repeated warnings');
        assert.doesNotMatch(state.warnings.join(' '), /발행|보류|근거|nasdaq-2027-annual|publication|evidence/i);
        assert.equal(state.ads, 0); assert.equal(state.residue, 0);
      };
      assertHeld(after); assert.equal(counters.attempt, 1, 'held document must not reload the SDK');
      await page.screenshot({ path: `${output}/held-selection-${language}.png`, fullPage: true });
      await page.reload(); await page.locator('.mcal-grid').waitFor();
      const refreshed = await observe(); assertHeld(refreshed); assert.equal(counters.attempt, 1);
      const direct = await context.newPage(); await direct.goto(after.url); await direct.locator('.mcal-grid').waitFor();
      assert.equal(await direct.locator('.mcal-controls select').inputValue(), 'nasdaq');
      assert.equal(await direct.locator('.mcal-grid caption').innerText(), 'NASDAQ · 2027-11');
      assert.equal(await direct.locator('.mcal-month-title').innerText(), language === 'ko' ? '2027년 11월' : 'November 2027');
      assert.equal(await direct.locator('script[data-worklazy-adsense], #held-rendered-auto-ad, .wl-ad-stub-marker').count(), 0);
      assert.equal(counters.attempt, 1, 'direct shared held URL must stay ad-free'); await direct.close();
      await selectCalendarValue(page, 1, '2026'); await page.locator('#held-rendered-auto-ad').waitFor();
      assert.equal(counters.attempt, 2, 'returning to the available scope restores normal ad eligibility');
      assertNoRealNetwork(counters, language); assert.equal(errors.length, 0, JSON.stringify(errors));
      results.push({ language, before, after, refreshed, counters, errors, pass: true });
      console.log(`ok ${results.length} - ${language} SDK-active held selection persists without ads`);
    } finally { await context.close(); }
  }
} finally { await browser.close(); await fs.writeFile(`${output}/held-selection.json`, JSON.stringify(results, null, 2)); }
console.log(`1..${results.length}\n# tests ${results.length}\n# pass ${results.length}\n# fail 0`);
