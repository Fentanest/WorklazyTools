import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
const origin = process.env.MCAL_ORIGIN || 'http://127.0.0.1:4427';
const output = process.env.MCAL_OUTPUT_DIR || '.review-tmp/mcal-r2';
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.WORKLAZY_CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] });
const checks = [], errors = [], external = [];
try {
  for (const lang of ['ko', 'en']) {
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1440, height: 1000 } });
    await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : (external.push(route.request().url()), route.abort()));
    const page = await context.newPage(); page.on('pageerror', e => errors.push(String(e)));
    await page.goto(`${origin}/${lang}/tools/market-calendar/`); await page.locator('.mcal-grid').waitFor();
    await page.locator('.mcal-controls select').nth(1).selectOption('2026');
    for (const scenario of ['new-year', 'early-close']) {
      await page.locator('.mcal-controls select').nth(0).selectOption(scenario === 'new-year' ? 'krx' : 'nyse');
      await page.locator('.mcal-controls select').nth(2).selectOption(scenario === 'new-year' ? '1' : '11');
      await page.locator('.mcal-day').filter({ has: page.locator('strong', { hasText: scenario === 'new-year' ? /^1$/ : /^27$/ }) }).click();
      const detail = await page.locator('.mcal-detail').innerText();
      const expected = scenario === 'new-year' ? (lang === 'ko' ? /신정/ : /New Year/) : (lang === 'ko' ? /조기.*(?:종료|폐장)/ : /early clos/i);
      assert.match(detail, expected);
      if (scenario === 'early-close') assert.match(detail, /13:00/);
      assert.doesNotMatch(detail, /translation.*not.*available|표시 문구가.*준비|special_expected|forced_unknown/i);
      if (lang === 'en') assert.doesNotMatch(detail, /[가-힣]/);
      assert.equal(errors.length, 0, JSON.stringify(errors)); assert.equal(external.length, 0, JSON.stringify(external));
      checks.push({ lang, scenario, detail, pass: true });
      await page.screenshot({ path: `${output}/${lang}-${scenario}.png`, fullPage: true });
      console.log(`ok ${checks.length} - ${lang} ${scenario}`);
    }
    await context.close();
  }
} finally { await browser.close(); await fs.writeFile(`${output}/publication-detail.json`, JSON.stringify({ checks, errors, external }, null, 2)); }
console.log(`1..${checks.length}\n# tests ${checks.length}\n# pass ${checks.length}\n# fail 0`);
