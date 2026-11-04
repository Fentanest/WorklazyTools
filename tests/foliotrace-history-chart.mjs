import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:49386';
assert.ok(process.env.F6_OUTPUT, 'Set F6_OUTPUT to an explicit artifact directory');
const out = process.env.F6_OUTPUT; await fs.mkdir(out, { recursive: true });
const original = JSON.parse(await fs.readFile(new URL('./fixtures/foliotrace/chart-snapshot-20261103.json', import.meta.url)));
const recovered = JSON.parse(await fs.readFile(new URL('./fixtures/foliotrace/published-history-counts-20261104.json', import.meta.url)));
const countText = (point, lang) => lang === 'ko'
  ? `평가 ${point.pricedCount.toLocaleString('en-US')}/${point.trackedCount.toLocaleString('en-US')}종목 · 제외 ${point.unvaluedCount}종목`
  : `${point.pricedCount.toLocaleString('en-US')}/${point.trackedCount.toLocaleString('en-US')} securities priced · ${point.unvaluedCount} excluded`;
const reconstruction = JSON.parse(await fs.readFile(new URL('./fixtures/foliotrace/valuation-series-20261103.json', import.meta.url)));
const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const facts = [];
const money = value => '₩' + BigInt(value).toLocaleString('en-US');
async function setup(lang, theme, mobile, data) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
  const body = JSON.stringify(data), manifest = { schemaVersion: 1, datasetVersion: data.datasetVersion,
    snapshotPath: `snapshots/${data.datasetVersion}.json`, snapshotSha256: createHash('sha256').update(body).digest('hex') };
  await context.addInitScript(theme => {
    window.__WORKLAZY_MOCK_PROVIDERS__ = true;
    if (location.protocol === 'http:') localStorage.setItem('worklazy-theme', theme);
    window.__f6Text = []; window.__f6Dashes = [];
    const fill = CanvasRenderingContext2D.prototype.fillText, dash = CanvasRenderingContext2D.prototype.setLineDash;
    CanvasRenderingContext2D.prototype.fillText = function(text, ...args) {
      if (window.__f6Text.length < 1000 && !window.__f6Text.includes(String(text))) window.__f6Text.push(String(text));
      return fill.call(this, text, ...args);
    };
    CanvasRenderingContext2D.prototype.setLineDash = function(values) {
      if (values.length && window.__f6Dashes.length < 1000) window.__f6Dashes.push([...values]);
      return dash.call(this, values);
    };
  }, theme);
  await context.route('**/*', route => {
    const url = route.request().url();
    if (url === `${base}/data/foliotrace/v1/manifest.json`) return route.fulfill({ json: manifest });
    if (url === `${base}/data/foliotrace/v1/${manifest.snapshotPath}`) return route.fulfill({ body, contentType: 'application/json' });
    return url.startsWith(`${base}/`) || /^(data:|blob:)/.test(url) ? route.continue() : route.abort();
  });
  const page = await context.newPage(), errors = []; page.setDefaultTimeout(30000);
  page.on('pageerror', error => errors.push(error.message)); await page.goto(`${base}/${lang}/tools/foliotrace/`);
  return { page, context, errors };
}
try {
  for (const lang of ['ko', 'en']) for (const theme of ['light-coral', 'dark-coral']) for (const mobile of [false, true]) {
    const id = `${lang}-${theme}-${mobile ? 'mobile' : 'desktop'}`;
    await test(`F9 recovered published counts ${id}`, async () => {
      const { page, context, errors } = await setup(lang, theme, mobile, { ...original, history: recovered, valuationSeries: reconstruction });
      try {
        await page.locator('#foliotrace-events li').first().waitFor();
        assert.equal(await page.getByTestId('foliotrace-history-chart').count(), 1);
        const chart = page.locator('[data-testid=foliotrace-history-chart][data-chart-ready=true]'); await chart.waitFor();
        await page.evaluate(async () => {
          await document.fonts.ready;
          await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
        });
        assert.equal(await chart.getAttribute('data-point-count'), '19');
        const region = page.locator('.foliotrace-trend');
        assert.match(await region.locator('[data-history-origin=published]').innerText(), /7$/);
        assert.match(await region.locator('[data-history-origin=reconstructed]').innerText(), /≤0\.06%.*12/);
        assert.ok(!(await region.locator('.foliotrace-trend-summary').innerText()).includes('20.77%'));
        assert.ok((await region.locator('.foliotrace-trend-summary').innerText()).includes('+5.51%'));
        assert.match(await region.locator('.foliotrace-reconstruction-change').innerText(), /−20\.77%/);
        assert.ok((await region.locator('.foliotrace-trend-summary').innerText()).includes(money(original.history.at(-1).estimatedValue)));
        await page.waitForFunction(() => window.__f6Dashes.length > 0);
        await page.waitForFunction(lang => window.__f6Text.some(text => lang === 'ko' ? text.includes('조원') : /₩.*T/.test(text)), lang);
        const summary = region.locator('details > summary'); await summary.focus(); await page.keyboard.press('Enter');
        assert.equal(await region.locator('tbody tr').count(), 19);
        assert.equal(await region.locator('tr[data-record-origin=reconstructed]').count(), 12);
        assert.equal(await region.locator('tr[data-record-origin=published]').count(), 7);
        for (const point of recovered.slice(0, 6)) {
          const row = region.locator('tbody tr').filter({ has: page.locator(`time[datetime="${point.tradeDate}"]`) });
          assert.equal(await row.getAttribute('data-record-origin'), 'published');
          assert.ok((await row.innerText()).includes(countText(point, lang)));
        }
        await region.locator('details').screenshot({ path: path.join(out, `${id}-published-count-table.png`) });
        const last = region.locator('tbody tr').filter({ has: page.locator('time[datetime="2026-11-02"]') });
        assert.ok((await last.innerText()).includes(money(original.history.at(-1).estimatedValue)));
        assert.ok(!(await last.innerText()).includes(money(reconstruction.points.at(-1).estimatedValue)));
        await summary.focus(); await page.keyboard.press('Space');
        await chart.evaluate(node => window.scrollTo({ top: node.getBoundingClientRect().top + scrollY - 100, behavior: 'instant' }));
        const box = await chart.boundingBox();
        await chart.hover({ position: { x: (box.width - 80) * 0.2, y: box.height * 0.5 } });
        const tooltip = region.getByRole('tooltip'); await tooltip.waitFor();
        assert.equal(await tooltip.getAttribute('data-origin'), 'reconstructed'); assert.match(await tooltip.innerText(), /0\.06%/);
        assert.match(await tooltip.innerText(), /−20\.77%/);
        assert.match(await tooltip.innerText(), lang === 'ko' ? /가격·기업행위 잔차 0/ : /zero price\/corporate-action residual/);
        const tipBounds = await tooltip.boundingBox(), plotBounds = await region.locator('.foliotrace-trend-plot').boundingBox();
        assert.ok(tipBounds.x >= plotBounds.x && tipBounds.y >= plotBounds.y);
        assert.ok(tipBounds.x + tipBounds.width <= plotBounds.x + plotBounds.width + 1);
        assert.ok(tipBounds.y + tipBounds.height <= plotBounds.y + plotBounds.height + 1);
        assert.ok(await tooltip.evaluate(node => node.scrollWidth <= node.clientWidth + 1 && node.scrollHeight <= node.clientHeight + 1), 'tooltip text fits without clipping');
        const day = await tooltip.locator('time').getAttribute('datetime');
        assert.ok((await tooltip.locator('strong').innerText()).includes(money(reconstruction.points.find(point => point.tradeDate === day).estimatedValue)));
        await region.locator('.foliotrace-trend-plot').screenshot({ path: path.join(out, `${id}-reconstructed-tooltip.png`), style: '.wl-topbar,.mobile-header,.bottom-tabs{visibility:hidden!important}' });
        await chart.evaluate(node => window.scrollTo({ top: node.getBoundingClientRect().top + scrollY - 100, behavior: 'instant' }));
        const refreshedBox = await chart.boundingBox();
        await chart.hover({ position: { x: (refreshedBox.width - 80) * 0.87, y: refreshedBox.height * 0.5 } });
        await region.locator('[role=tooltip][data-origin=published]').waitFor();
        const publishedDay = await tooltip.locator('time').getAttribute('datetime');
        assert.equal(await tooltip.locator('strong').innerText(), money(original.history.find(point => point.tradeDate === publishedDay).estimatedValue));
        assert.ok((await tooltip.innerText()).includes(countText(recovered.find(point => point.tradeDate === publishedDay), lang)));
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        await page.mouse.move(0, 0);
        await tooltip.waitFor({ state: 'hidden' });
        await region.screenshot({ path: path.join(out, `${id}-chart.png`), style: '.wl-topbar,.mobile-header,.bottom-tabs{visibility:hidden!important}' });
        assert.deepEqual(errors, []);
        facts.push({ id, days: 19, published: 7, reconstructed: 12,
          dashPatterns: await page.evaluate(() => [...new Set(window.__f6Dashes.map(value => value.join(',')))]), errors });
      } catch (error) { await page.screenshot({ path: path.join(out, `${id}-failure.png`) }).catch(() => {}); throw error; }
      finally { await context.close(); }
    });
  }
  await test('legacy history remains seven published records without an extension', async () => {
    const { page, context } = await setup('en', 'light-coral', false, original);
    try {
      await page.locator('[data-chart-ready=true]').waitFor();
      assert.equal(await page.getByTestId('foliotrace-history-chart').getAttribute('data-point-count'), '7');
      assert.equal(await page.locator('[data-history-origin=reconstructed]').count(), 0);
      await page.locator('.foliotrace-trend details > summary').click();
      assert.equal(await page.locator('.foliotrace-trend tbody tr').filter({ hasText: 'Counts not provided' }).count(), 6);
      await page.locator('.foliotrace-trend').screenshot({ path: path.join(out, 'legacy-seven.png') });
    } finally { await context.close(); }
  });
  for (const lang of ['ko', 'en']) await test(`zero published counts stay visible ${lang}`, async () => {
    const history = structuredClone(recovered);
    Object.assign(history[0], { trackedCount: 0, pricedCount: 0, unvaluedCount: 0 });
    const { page, context } = await setup(lang, 'light-coral', true, { ...original, history });
    try {
      await page.locator('[data-chart-ready=true]').waitFor();
      await page.locator('.foliotrace-trend details > summary').click();
      const row = page.locator('.foliotrace-trend tbody tr').filter({ has: page.locator(`time[datetime="${history[0].tradeDate}"]`) });
      assert.ok((await row.innerText()).includes(countText(history[0], lang)));
    } finally { await context.close(); }
  });
  for (const count of [0, 1, 2]) await test(`history with ${count} points has an accessible empty state`, async () => {
    const { page, context } = await setup('en', 'light-coral', false, { ...original, history: original.history.slice(0, count) });
    try {
      await page.locator('.foliotrace-trend').waitFor(); assert.equal(await page.getByTestId('foliotrace-history-chart').count(), 0);
      assert.match(await page.locator('.foliotrace-trend').innerText(), /At least three trading days/);
      if (count > 0) await page.locator('.foliotrace-trend').screenshot({ path: path.join(out, `empty-${count}.png`) });
    } finally { await context.close(); }
  });
  await test('null reconstruction leaves an explicit unvalued record', async () => {
    const series = structuredClone(reconstruction), point = series.points[4];
    point.estimatedValue = null;
    const { page, context } = await setup('en', 'light-coral', false, { ...original, valuationSeries: series });
    try {
      await page.locator('[data-chart-ready=true]').waitFor(); await page.locator('.foliotrace-trend details > summary').click();
      const row = page.locator('.foliotrace-trend tbody tr').filter({ has: page.locator(`time[datetime="${point.tradeDate}"]`) });
      assert.match(await row.innerText(), /No valuation/);
    } finally { await context.close(); }
  });
  const invalidInputs = [
    ['reversed extension', data => { data.valuationSeries.points.reverse(); }],
    ['duplicate extension', data => { data.valuationSeries.points[1].tradeDate = data.valuationSeries.points[0].tradeDate; }],
    ['1001 extension points', data => { data.valuationSeries.points = Array.from({ length: 1001 }, () => data.valuationSeries.points[0]); }],
    ['partial public counts', data => { data.history[0].trackedCount = 1192; }],
    ['wrong public count sum', data => { Object.assign(data.history[0], recovered[0], { unvaluedCount: 0 }); }],
    ['inconsistent counts', data => { data.valuationSeries.points[0].pricedCount++; }],
    ['duplicate public history', data => { data.history[1].tradeDate = data.history[0].tradeDate; }],
    ['1001 public points', data => { data.history = Array.from({ length: 1001 }, () => data.history[0]); }],
    ['non-array public history', data => { data.history = null; }],
    ['wrong quantity origin type', data => { data.valuationSeries.points[0].quantityOrigin = ['stored-assembly']; }],
  ];
  for (const [name, mutate] of invalidInputs) for (const lang of ['ko', 'en']) await test(`chart-only failure: ${name} ${lang}`, async () => {
    const data = { ...structuredClone(original), valuationSeries: structuredClone(reconstruction) }; mutate(data);
    const { page, context, errors } = await setup(lang, 'dark-coral', lang === 'en', data);
    try {
      const notice = page.getByTestId('foliotrace-chart-unavailable'); await notice.waitFor({ timeout: 10000 });
      assert.equal(await page.getByTestId('foliotrace-history-chart').count(), 0);
      assert.equal(await page.locator('.foliotrace-trend details, .foliotrace-trend-legend').count(), 0);
      assert.equal(await page.getByRole('alert').count(), 0);
      assert.equal(await page.locator('#foliotrace-latest-list > li').count(), 30);
      assert.equal(await page.locator('#foliotrace-holdings .foliotrace-table tbody tr, #foliotrace-holdings .foliotrace-mrow').count(), original.holdings.length);
      assert.deepEqual(errors, []);
      if (name === 'reversed extension') {
        await notice.scrollIntoViewIfNeeded();
        await page.screenshot({ path: path.join(out, `chart-unavailable-${lang}.png`), fullPage: false });
      }
    } catch (error) { await page.screenshot({ path: path.join(out, `isolation-${name.replaceAll(' ', '-')}-${lang}-failure.png`) }).catch(() => {}); throw error; }
    finally { await context.close(); }
  });
  await test('core schema violation still hides the portfolio even with bad chart data', async () => {
    const data = { ...structuredClone(original), valuationSeries: structuredClone(reconstruction) };
    data.valuationSeries.points.reverse(); data.portfolio.currency = 'USD';
    const { page, context } = await setup('en', 'light-coral', false, data);
    try {
      await page.getByRole('alert').waitFor();
      assert.equal(await page.locator('#foliotrace-holdings, #foliotrace-events, .foliotrace-trend').count(), 0);
    } finally { await context.close(); }
  });
  await test('theme changes and resizing replace chart resources without duplicate canvases', async () => {
    const { page, context, errors } = await setup('en', 'light-coral', false, { ...original, valuationSeries: reconstruction });
    try {
      const chart = page.locator('[data-chart-ready=true]'); await chart.waitFor(); const count = await chart.locator('canvas').count();
      const width = await chart.evaluate(node => node.clientWidth);
      await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark-coral'));
      await page.locator('[data-chart-theme=dark-coral][data-chart-ready=true]').waitFor();
      assert.equal(await chart.locator('canvas').count(), count);
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForFunction(width => document.querySelector('[data-testid=foliotrace-history-chart]').clientWidth < width, width);
      assert.equal(await chart.locator('canvas').count(), count); assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });
} finally { await fs.writeFile(path.join(out, 'results.json'), JSON.stringify(facts, null, 2)); await browser.close(); }
