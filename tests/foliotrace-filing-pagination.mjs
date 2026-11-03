import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import { test } from 'node:test';
import { chromium } from 'playwright';

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:49382';
const template = JSON.parse(await fs.readFile(new URL('./fixtures/foliotrace/latest-filings.json', import.meta.url)));
const snapshot = { ...template, events: Array.from({ length: 61 }, (_, i) => ({ ...template.events[0],
  stockCode: String(200000 + i), corpCode: String(20000000 + i), receiptDate: '2026-11-02',
  receiptNo: `20261102${String(i).padStart(6, '0')}`, filingUrl: null })) };
const payload = JSON.stringify(snapshot);
const manifest = { schemaVersion: 1, datasetVersion: snapshot.datasetVersion,
  snapshotPath: `snapshots/${snapshot.datasetVersion}.json`,
  snapshotSha256: createHash('sha256').update(payload).digest('hex') };
const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
try {
  for (const lang of ['ko', 'en']) await test(`latest filing disclosure toggle ${lang}`, async () => {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    try {
      await context.route('**/*', route => {
        const url = route.request().url();
        if (url === `${base}/data/foliotrace/v1/manifest.json`) return route.fulfill({ json: manifest });
        if (url === `${base}/data/foliotrace/v1/${manifest.snapshotPath}`) return route.fulfill({ body: payload, contentType: 'application/json' });
        return url.startsWith(`${base}/`) || /^(data:|blob:)/.test(url) ? route.continue() : route.abort();
      });
      const page = await context.newPage();
      await page.goto(`${base}/${lang}/tools/foliotrace/`);
      const full = page.locator('#foliotrace-events');
      const rows = full.locator('> ul > li');
      await rows.first().waitFor();
      assert.equal(await rows.count(), 30);
      assert.match(await full.locator('.foliotrace-block-head > .foliotrace-block-hint').innerText(), /61/);
      const toggle = full.getByRole('button', { name: lang === 'ko' ? /더 보기.*31/ : /Show more.*31/ });
      assert.equal(await toggle.getAttribute('aria-controls'), 'foliotrace-latest-list');
      assert.equal(await toggle.getAttribute('aria-expanded'), 'false');
      await toggle.focus(); await page.keyboard.press('Enter');
      assert.equal(await rows.count(), 61);
      const collapse = full.getByRole('button', { name: lang === 'ko' ? /접기/ : /Collapse/ });
      assert.equal(await collapse.getAttribute('aria-expanded'), 'true');
      assert.equal(await collapse.evaluate(node => document.activeElement === node), true);
      const expected = [...snapshot.events].reverse().map(event => event.receiptNo);
      assert.deepEqual(await full.locator('.foliotrace-event-source > code').allTextContents(), expected);
      await page.keyboard.press('Space');
      assert.equal(await rows.count(), 30);
      assert.equal(await toggle.evaluate(node => document.activeElement === node), true);
      assert.deepEqual(await full.locator('.foliotrace-event-source > code').allTextContents(), expected.slice(0, 30));
    } finally { await context.close(); }
  });
} finally { await browser.close(); }
