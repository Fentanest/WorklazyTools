import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { startOwnedPreview, stopOwnedPreview } from './helpers/owned-preview.mjs';

const root = path.resolve('.');
const port = Number(process.env.PAYROLL_TEST_PORT || 5197);
const base = `http://127.0.0.1:${port}`;
const output = path.resolve(process.env.PAYROLL_TEST_OUTPUT || 'evidence/payroll/browser');
let server, browser;
before(async () => {
  await fs.mkdir(output, { recursive: true });
  server = await startOwnedPreview({ repositoryRoot: root, port });
  browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
});
after(async () => {
  try { await browser?.close(); } finally { await stopOwnedPreview(server); }
});

for (const language of ['ko', 'en']) for (const width of [1440, 390]) {
  test(`payroll exact rounding in ${language} at ${width}px`, async () => {
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
    const errors = [];
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      return /^https?:$/.test(url.protocol) && url.origin !== base ? route.abort() : route.continue();
    });
    await context.addInitScript(() => { window.__WORKLAZY_MOCK_PROVIDERS__ = true; });
    const page = await context.newPage();
    page.on('pageerror', error => errors.push(String(error)));
    try {
      const translations = JSON.parse(await fs.readFile(path.join(root, `src/locales/${language}/features.json`), 'utf8')).payroll;
      const won = value => new Intl.NumberFormat(language === 'en' ? 'en-US' : 'ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(value);
      await page.goto(`${base}/${language}/tools/payroll-calculator`);
      const modes = page.getByTestId('payroll-mode').getByRole('button');
      const result = page.getByTestId('payroll-result').locator('strong');
      await modes.nth(1).click();
      const breakdown = page.getByTestId('payroll-breakdown');
      await breakdown.waitFor();
      const valueFor = label => breakdown.locator('div').filter({ has: page.locator('dt', { hasText: label }) }).locator('dd');
      const check = async (salary, employment, care) => {
        await page.locator('input[type="number"]').nth(0).fill(String(salary));
        assert.equal(await valueFor(translations.employment).innerText(), won(employment));
        assert.equal(await valueFor(translations.care).innerText(), won(care));
      };
      await check(3_000_000, 27_000, 14_170);
      assert.equal(await valueFor(translations.deductionTotal).innerText(), won(352_380));
      assert.equal(await result.innerText(), won(2_647_620));
      await page.screenshot({ path: path.join(output, `${language}-${width}-net.png`), fullPage: true });
      await check(2_999_999, 26_990, 14_170);
      await check(1_390_821, 12_510, 6_570);
      await check(1_301_910, 11_710, 6_140);
      await modes.nth(0).click();
      await page.locator('input[type="number"]').nth(0).fill('15.01');
      await page.locator('input[type="number"]').nth(1).fill('1250');
      assert.equal(await result.innerText(), won(3_753));
      await page.screenshot({ path: path.join(output, `${language}-${width}-weekly.png`), fullPage: true });
      await modes.nth(2).click();
      await page.locator('input[type="date"]').nth(0).fill('2025-01-01');
      await page.locator('input[type="date"]').nth(1).fill('2025-12-31');
      const inputs = page.locator('input[type="number"]');
      for (const [index, value] of ['15', '9000001', '1', '1', '90'].entries()) await inputs.nth(index).fill(value);
      assert.equal(await result.innerText(), won(3_000_000.5));
      await page.screenshot({ path: path.join(output, `${language}-${width}-severance.png`), fullPage: true });
      assert.deepEqual(errors, []);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    } finally { await context.close(); }
  });
}
