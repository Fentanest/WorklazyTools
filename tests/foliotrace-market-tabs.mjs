import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:49386';
const template = JSON.parse(await fs.readFile(new URL('./fixtures/foliotrace/market-holdings.json', import.meta.url)));
const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
try {
  for (const lang of ['ko', 'en']) await test(`mobile market tabs retain selection and filters ${lang}`, async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const data = { ...template, valuationTradeDate: '2026-12-04' };
    let body = JSON.stringify(data);
    const manifest = { schemaVersion: 1, datasetVersion: data.datasetVersion,
      snapshotPath: `snapshots/${data.datasetVersion}.json`, snapshotSha256: createHash('sha256').update(body).digest('hex') };
    try {
      await context.route('**/*', route => {
        const url = route.request().url();
        if (url === `${base}/data/foliotrace/v1/manifest.json`) return route.fulfill({ json: manifest });
        if (url === `${base}/data/foliotrace/v1/${manifest.snapshotPath}`) return route.fulfill({ body, contentType: 'application/json' });
        return url.startsWith(`${base}/`) || /^(data:|blob:)/.test(url) ? route.continue() : route.abort();
      });
      const page = await context.newPage();
      await page.goto(`${base}/${lang}/tools/foliotrace/`);
      await page.locator('#foliotrace-events li').first().waitFor();
      assert.equal(await page.getByRole('tab').count(), 2);
      const kospi = page.locator('[data-market-tab=KOSPI]'), kosdaq = page.locator('[data-market-tab=KOSDAQ]');
      assert.match(await kospi.innerText(), /2/); assert.match(await kosdaq.innerText(), /2/);
      assert.equal(await kospi.getAttribute('aria-selected'), 'true');
      await page.locator('[data-market=KOSPI]').getByRole('searchbox').fill('005930');
      await kospi.focus(); await page.keyboard.press('ArrowRight');
      assert.equal(await kosdaq.getAttribute('aria-selected'), 'true');
      assert.equal(await kosdaq.evaluate(node => document.activeElement === node), true);
      assert.equal(await page.locator('[data-market=KOSPI]').isHidden(), true);
      await page.keyboard.press('Home');
      assert.equal(await page.locator('[data-market=KOSPI]').getByRole('searchbox').inputValue(), '005930');
      await kosdaq.click(); await page.reload(); await page.locator('#foliotrace-events li').first().waitFor();
      assert.equal(await kosdaq.getAttribute('aria-selected'), 'true');
      await page.setViewportSize({ width: 1440, height: 1100 });
      await page.getByRole('tablist').waitFor({ state: 'hidden' });
      assert.equal(await page.locator('[data-market=KOSPI]').isVisible(), true);
      assert.equal(await page.locator('[data-market=KOSDAQ]').isVisible(), true);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.getByRole('tablist').waitFor();
      assert.equal(await kosdaq.getAttribute('aria-selected'), 'true');
      assert.match(await page.locator('.foliotrace-reference-notice').innerText(), /31/);
      data.valuationTradeDate = '2026-12-03'; body = JSON.stringify(data);
      manifest.snapshotSha256 = createHash('sha256').update(body).digest('hex');
      await page.reload(); await page.locator('#foliotrace-events li').first().waitFor();
      assert.equal(await page.locator('.foliotrace-reference-notice').count(), 0);
    } finally { await context.close(); }
  });
  await test('actual portfolio can switch from deep KOSPI rows to the KOSDAQ heading', async () => {
    const data = JSON.parse(await fs.readFile(new URL('./fixtures/foliotrace/chart-snapshot-20261103.json', import.meta.url)));
    const body = JSON.stringify(data), manifest = { schemaVersion: 1, datasetVersion: data.datasetVersion,
      snapshotPath: `snapshots/${data.datasetVersion}.json`, snapshotSha256: createHash('sha256').update(body).digest('hex') };
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    try {
      await context.route('**/*', route => {
        const url = route.request().url();
        if (url === `${base}/data/foliotrace/v1/manifest.json`) return route.fulfill({ json: manifest });
        if (url === `${base}/data/foliotrace/v1/${manifest.snapshotPath}`) return route.fulfill({ body, contentType: 'application/json' });
        return url.startsWith(`${base}/`) || /^(data:|blob:)/.test(url) ? route.continue() : route.abort();
      });
      const page = await context.newPage(); await page.goto(`${base}/ko/tools/foliotrace/`);
      const kospi = page.locator('[data-market=KOSPI]'); await kospi.waitFor();
      const box = await kospi.boundingBox();
      const deep = await page.evaluate(({ top, height }) => {
        window.scrollTo({ top: top + scrollY + height / 2, behavior: 'instant' }); return scrollY;
      }, { top: box.y, height: box.height });
      assert.ok(deep > 10000, 'setup must really scroll deep into the 774-row list');
      await page.locator('[data-market-tab=KOSDAQ]').click();
      await page.waitForFunction(() => {
        const top = document.querySelector('[data-market=KOSDAQ]').getBoundingClientRect().top;
        return top >= 100 && top < 230;
      });
      assert.equal(await kospi.isHidden(), true);
      assert.equal(await page.locator('[data-market=KOSDAQ] .foliotrace-result-count .foliotrace-num').innerText(), '418');
    } finally { await context.close(); }
  });
} finally { await browser.close(); }
