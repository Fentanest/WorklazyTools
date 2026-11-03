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
    const data = { ...template, valuationTradeDate: '2026-12-04' }, body = JSON.stringify(data);
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
    } finally { await context.close(); }
  });
} finally { await browser.close(); }
