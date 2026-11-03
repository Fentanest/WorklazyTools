import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { chromium } from 'playwright';

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:49382';
assert.ok(process.env.F7_OUTPUT, 'Set F7_OUTPUT to an explicit evidence directory');
const out = process.env.F7_OUTPUT;
await fs.mkdir(out, { recursive: true });
const snapshot = JSON.parse(await fs.readFile(new URL('./fixtures/foliotrace/market-holdings.json', import.meta.url)));
const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const facts = [];
// Component captures omit fixed shell chrome only while taking the image;
// all interactions and the viewport screenshot use the unmodified page.
const captureStyle = '.wl-topbar, .mobile-header, .bottom-tabs { visibility: hidden !important; }';
async function setup(lang, theme, mobile, data = snapshot) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
  const body = JSON.stringify(data), manifest = { schemaVersion: 1, datasetVersion: data.datasetVersion,
    snapshotPath: `snapshots/${data.datasetVersion}.json`, snapshotSha256: createHash('sha256').update(body).digest('hex') };
  await context.addInitScript(theme => { window.__WORKLAZY_MOCK_PROVIDERS__ = true;
    if (location.protocol === 'http:') localStorage.setItem('worklazy-theme', theme); }, theme);
  await context.route('**/*', route => {
    const url = route.request().url();
    if (url === `${base}/data/foliotrace/v1/manifest.json`) return route.fulfill({ json: manifest });
    if (url === `${base}/data/foliotrace/v1/${manifest.snapshotPath}`) return route.fulfill({ body, contentType: 'application/json' });
    return url.startsWith(`${base}/`) || /^(data:|blob:)/.test(url) ? route.continue() : route.abort();
  });
  const page = await context.newPage(), errors = [];
  page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${base}/${lang}/tools/foliotrace/`);
  await page.locator('#foliotrace-events li').first().waitFor();
  return { page, context, errors };
}
try {
  for (const lang of ['ko', 'en']) for (const theme of ['light-coral', 'dark-coral']) for (const mobile of [false, true]) {
    const id = `${lang}-${theme}-${mobile ? 'mobile' : 'desktop'}`;
    await test(`market split ${id}`, async () => {
      const { page, context, errors } = await setup(lang, theme, mobile);
      try {
        const kospi = page.locator('[data-market=KOSPI]'), kosdaq = page.locator('[data-market=KOSDAQ]');
        assert.equal(await kospi.count(), 1); assert.equal(await kosdaq.count(), 1);
        const activate = async panel => {
          const market = await panel.getAttribute('data-market');
          if (mobile && (market === 'KOSPI' || market === 'KOSDAQ')) await page.locator(`[data-market-tab=${market}]`).click();
        };
        const chart = page.locator('.foliotrace-market-allocation');
        const chartText = await chart.innerText(); assert.match(chartText, /115,000,000/);
        for (const [market, percent] of [['KOSPI', '69.57%'], ['KOSDAQ', '17.39%'], ['KONEX', '8.70%'], ['UNKNOWN', '4.35%']]) {
          assert.ok((await chart.locator(`[data-allocation-market=${market}]`).innerText()).includes(percent));
        }
        const count = panel => panel.locator('.foliotrace-result-count .foliotrace-num');
        assert.equal(await count(kospi).innerText(), '2'); assert.equal(await count(kosdaq).innerText(), '2');
        await kospi.getByRole('searchbox').fill('005930'); assert.equal(await count(kospi).innerText(), '1');
        assert.equal(await count(kosdaq).innerText(), '2');
        assert.equal(await chart.innerText(), chartText, 'market shares are independent of holding searches');
        const reset = lang === 'ko' ? '필터 초기화' : 'Reset filters';
        await kospi.getByRole('button', { name: reset, exact: true }).click();
        const labels = lang === 'ko' ? ['평가 포함', '평가 제외', '5% 미만', '비율 보정', '전체'] :
          ['Included in valuation', 'Excluded from valuation', 'Below 5%', 'Ratio-adjusted', 'All'];
        for (const [panel, counts] of [[kospi, [1, 1, 1, 0, 2]], [kosdaq, [1, 1, 1, 1, 2]]]) {
          await activate(panel);
          for (const [index, label] of labels.entries()) {
            await panel.locator('.foliotrace-pills').getByRole('button', { name: label, exact: true }).click();
            assert.equal(await count(panel).innerText(), String(counts[index]));
            assert.equal(await chart.innerText(), chartText);
          }
        }
        await activate(kospi); await kospi.getByRole('combobox').selectOption('receipt');
        await activate(kosdaq); await kosdaq.getByRole('combobox').selectOption('ownership');
        await activate(kospi);
        assert.equal(await kospi.getByRole('combobox').inputValue(), 'receipt');
        await activate(kosdaq);
        assert.equal(await kosdaq.locator('.foliotrace-mrow .foliotrace-code-plain').first().innerText(), '247540');
        for (const panel of [kospi, kosdaq]) for (const key of ['weight', 'value']) {
          await activate(panel);
          await panel.getByRole('combobox').selectOption(key);
          assert.equal(await count(panel).innerText(), '2');
        }
        assert.ok(await kospi.locator('.foliotrace-change-up').count() > 0);
        assert.ok(await kosdaq.locator('.foliotrace-change-down').count() > 0);
        assert.ok(await kospi.locator('.foliotrace-mrow-note').count() > 0);
        await activate(kospi);
        assert.match(await kospi.getByRole('button', { name: /KOSPI Unpriced/ }).innerText(), lang === 'ko' ? /거래\s*정지/ : /trading suspended/);
        assert.equal(await count(page.locator('[data-market=KONEX]')).innerText(), '1');
        assert.equal(await count(page.locator('[data-market=UNKNOWN]')).innerText(), '1');
        for (const [panel, name, historyCount] of [[kospi, 'KOSPI Up', 3], [kosdaq, 'KOSDAQ Down', 2],
          [page.locator('[data-market=KONEX]'), 'KONEX Fixture', 1], [page.locator('[data-market=UNKNOWN]'), 'Unconfirmed Fixture', 1]]) {
          await activate(panel);
          await panel.getByRole('button', { name: new RegExp(name) }).first().click();
          const sheet = page.getByRole('dialog'); await sheet.waitFor();
          assert.ok((await sheet.innerText()).includes(name));
          assert.equal(await sheet.locator('.foliotrace-events li').count(), historyCount);
          await page.keyboard.press('Escape'); await sheet.waitFor({ state: 'hidden' });
        }
        await activate(kospi); const left = await kospi.boundingBox();
        if (mobile) assert.equal(await kosdaq.isHidden(), true);
        await activate(kosdaq); const right = await kosdaq.boundingBox();
        if (mobile) { assert.equal(await kospi.isHidden(), true); assert.ok(Math.abs(left.x - right.x) < 1); }
        else { assert.ok(right.x > left.x + left.width); assert.ok(Math.abs(left.y - right.y) < 1); }
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        await page.evaluate(() => document.fonts.ready);
        await chart.evaluate(node => window.scrollTo(0, node.getBoundingClientRect().top + scrollY - 100));
        await page.screenshot({ path: path.join(out, `${id}-viewport.png`) });
        await chart.screenshot({ path: path.join(out, `${id}-allocation.png`), style: captureStyle });
        const columns = page.locator('.foliotrace-market-columns');
        await columns.evaluate(node => window.scrollTo(0, node.getBoundingClientRect().top + scrollY - 100));
        await columns.screenshot({ path: path.join(out, `${id}-columns.png`), style: captureStyle });
        if (mobile) for (const [panel, market] of [[kospi, 'KOSPI'], [kosdaq, 'KOSDAQ']]) {
          await activate(panel);
          await panel.evaluate(node => window.scrollTo(0, node.getBoundingClientRect().top + scrollY - 100));
          await panel.screenshot({ path: path.join(out, `${id}-${market}.png`), style: captureStyle });
        }
        assert.deepEqual(errors, []);
        facts.push({ id, left, right, chartText, errors });
      } catch (error) { await page.screenshot({ path: path.join(out, `${id}-failure.png`) }).catch(() => {}); throw error; }
      finally { await context.close(); }
    });
  }
  await test('unpriced portfolio keeps rows but does not draw fictitious market percentages', async () => {
    const data = { ...snapshot, estimatedValue: null, pricedCount: 0, valuationCoverage: 'unavailable',
      holdings: snapshot.holdings.map(h => ({ ...h, estimatedValue: null, portfolioWeightPercent: null, quote: null, valuationExclusionReason: 'corporate_action_pending' })) };
    const { page, context, errors } = await setup('en', 'light-coral', false, data);
    try {
      assert.equal(await page.locator('.foliotrace-market-track').count(), 0);
      assert.match(await page.locator('.foliotrace-market-allocation').innerText(), /Market shares cannot be calculated/);
      assert.equal(await page.locator('.foliotrace-result-count .foliotrace-num').allTextContents().then(values => values.reduce((a, b) => a + +b, 0)), 6);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });
} finally { await fs.writeFile(path.join(out, 'results.json'), JSON.stringify(facts, null, 2)); await browser.close(); }
