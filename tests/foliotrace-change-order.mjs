import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import { chromium } from 'playwright';

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:49406';
const before = process.env.FT_CHANGE_PHASE === 'before';
assert.ok(process.env.FT_CHANGE_OUTPUT, 'Set FT_CHANGE_OUTPUT to an evidence directory');
const out = process.env.FT_CHANGE_OUTPUT;
await fs.mkdir(out, { recursive: true });
const payload = await fs.readFile(process.env.FT_CHANGE_SNAPSHOT || 'artifacts/ft-change/public-snapshot.json');
const snapshot = JSON.parse(payload);
const manifest = { schemaVersion: 1, datasetVersion: snapshot.datasetVersion,
  snapshotPath: `snapshots/${snapshot.datasetVersion}.json`, snapshotSha256: createHash('sha256').update(payload).digest('hex') };
const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const facts = [];
try {
  for (const lang of (process.env.FT_CHANGE_LANGS || 'ko,en').split(',')) for (const theme of (process.env.FT_CHANGE_THEMES || 'light-coral,dark-coral').split(',')) for (const width of (process.env.FT_CHANGE_WIDTHS || '390,820,821,900,901,1023,1024,1280,1440,1920,2160').split(',').map(Number)) {
    await test(`${before ? 'before' : 'after'} ${lang} ${theme} ${width}`, async () => {
      const context = await browser.newContext({ viewport: { width, height: 1100 }, deviceScaleFactor: 1 });
      await context.addInitScript(theme => {
        window.__WORKLAZY_MOCK_PROVIDERS__ = true;
        if (location.protocol === 'http:' || location.protocol === 'https:') localStorage.setItem('worklazy-theme', theme);
      }, theme);
      await context.route('**/*', route => {
        const url = route.request().url();
        if (url === `${base}/data/foliotrace/v1/manifest.json`) return route.fulfill({ json: manifest });
        if (url === `${base}/data/foliotrace/v1/${manifest.snapshotPath}`) return route.fulfill({ body: payload, contentType: 'application/json' });
        return url.startsWith(`${base}/`) || /^(data:|blob:)/.test(url) ? route.continue() : route.abort();
      });
      const page = await context.newPage();
      page.setDefaultTimeout(30000);
      const errors = []; page.on('pageerror', error => errors.push(error.message));
      const id = `${lang}-${theme}-${width}`;
      try {
        await page.goto(`${base}/${lang}/tools/foliotrace/`, { waitUntil: 'domcontentloaded' });
        const kospi = page.locator('[data-market=KOSPI]');
        await kospi.locator('.foliotrace-result-count').waitFor();
        await page.evaluate(() => document.fonts.ready);
        const heading = page.locator('#foliotrace-holdings');
        await heading.scrollIntoViewIfNeeded();
        await page.evaluate(() => window.scrollTo({ top: document.querySelector('#foliotrace-holdings').getBoundingClientRect().top + scrollY - 110, behavior: 'instant' }));
        await page.screenshot({ path: path.join(out, `${id}-holdings.png`) });
        if (!before) {
          const expectedTable = width >= 1024;
          assert.equal(await kospi.locator('table').count(), expectedTable ? 1 : 0);
          if (width >= 1024) {
            const k1 = await kospi.boundingBox(), k2 = await page.locator('[data-market=KOSDAQ]').boundingBox();
            assert.ok(k2.x > k1.x + k1.width, 'markets must be side by side');
            assert.ok(Math.abs(k2.y - k1.y) < 2);
          }
          const geometry = await page.locator('.foliotrace-table-wrap').evaluateAll(nodes => nodes.filter(n => n.getBoundingClientRect().width).map(n => ({
            width: n.clientWidth, scroll: n.scrollWidth,
            panelWidth: n.closest('.foliotrace-market-panel').clientWidth,
            columns: [...n.querySelectorAll('thead th')].filter(th => th.getBoundingClientRect().width).map(th => th.textContent),
            nameWidth: n.querySelector('tbody th .foliotrace-name-btn')?.clientWidth,
          })));
          assert.ok(geometry.every(n => n.scroll <= n.width + 1), `no table horizontal scroll: ${JSON.stringify(geometry)}`);
          if (expectedTable) {
            const defects = await kospi.locator('table').evaluate(table => {
              const issues = [];
              for (const cell of table.querySelectorAll('thead th, td.foliotrace-num')) {
                if (!cell.getBoundingClientRect().width) continue;
                const css = getComputedStyle(cell);
                if (css.whiteSpace !== 'nowrap' || (cell.matches('.foliotrace-num') &&
                    (css.textAlign !== 'right' || css.fontVariantNumeric !== 'tabular-nums'))) issues.push(cell.textContent);
                if (cell.scrollWidth > cell.clientWidth + 1) issues.push(`overflow: ${cell.textContent}`);
              }
              for (const name of table.querySelectorAll('.foliotrace-name-btn')) {
                const css = getComputedStyle(name);
                if (!name.title || css.whiteSpace !== 'nowrap' || css.textOverflow !== 'ellipsis') issues.push(`name: ${name.textContent}`);
              }
              return issues;
            });
            assert.deepEqual(defects, [], 'desktop names and numeric cells stay readable without wrapping or overlap');
          }
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no page horizontal overflow');
          const resultCount = kospi.locator('.foliotrace-result-count .foliotrace-num');
          assert.equal(await resultCount.innerText(), '774');
          await kospi.getByRole('searchbox').fill('009150');
          assert.equal(await resultCount.innerText(), '1');
          const row = kospi.locator(expectedTable ? 'tbody tr' : '.foliotrace-mrow');
          assert.match(await row.innerText(), /\+59,757주|\+59,757 shares/);
          assert.match(await row.innerText(), /−0.13%p/);
          assert.equal(await row.locator('.foliotrace-change-up').count(), 1);
          assert.equal(await row.locator('.foliotrace-change-down').count(), 1);
          assert.match(await row.locator('.foliotrace-change-up .sr-only').innerText(), lang === 'ko' ? /수량 \+59,757주/ : /Quantity \+59,757 shares/);
          assert.match(await row.locator('.foliotrace-change-down .sr-only').innerText(), lang === 'ko' ? /지분율 −0.13%p/ : /Ownership −0.13%p/);
          const colors = await row.evaluate(row => ['up', 'down'].map(direction => getComputedStyle(row.querySelector(`.foliotrace-change-${direction}`)).color));
          assert.deepEqual(colors, theme.startsWith('dark-') ? ['rgb(255, 149, 142)', 'rgb(147, 197, 253)'] : ['rgb(180, 35, 24)', 'rgb(29, 78, 216)']);
          await row.screenshot({ path: path.join(out, `${id}-samsung.png`) });
          if (width === 390 || width === 1440) {
          await (expectedTable ? row.getByRole('button').first() : row).click();
          const sheet = page.getByRole('dialog'); await sheet.waitFor();
          assert.equal(await sheet.locator('dl .foliotrace-change-up').count(), 1);
          assert.equal(await sheet.locator('dl .foliotrace-change-down').count(), 1);
          await sheet.screenshot({ path: path.join(out, `${id}-detail.png`) });
          await page.keyboard.press('Escape'); await sheet.waitFor({ state: 'hidden' });
          }
          await kospi.getByRole('searchbox').fill('079550');
          assert.equal(await row.locator('.foliotrace-change-down').count(), 2);
          if (width === 1024) {
            await kospi.getByRole('searchbox').fill('018880');
            const name = row.locator('.foliotrace-name-btn');
            assert.equal(await name.getAttribute('title'), '한온시스템;한온시스템(유상) · 018880');
            assert.ok(await name.evaluate(n => n.scrollWidth > n.clientWidth), 'long security name uses ellipsis');
            await row.screenshot({ path: path.join(out, `${id}-long-name.png`) });
          }
          if ((width === 390 || width === 1440) && theme === 'light-coral') {
          await kospi.getByRole('searchbox').fill('');
          for (const value of ['value', 'weight', 'ownership', 'receipt']) await kospi.getByRole('combobox').selectOption(value);
          const filterLabels = lang === 'ko' ? ['평가 포함', '평가 제외', '5% 미만', '비율 보정', '전체'] : ['Included in valuation', 'Excluded from valuation', 'Below 5%', 'Ratio-adjusted', 'All'];
          for (const label of filterLabels) {
            const button = kospi.getByRole('button', { name: label, exact: true }); await button.click();
            assert.equal(await button.getAttribute('aria-pressed'), 'true');
          }
          await kospi.getByRole('button', { name: lang === 'ko' ? '필터 초기화' : 'Reset filters', exact: true }).click();
          assert.equal(await kospi.getByRole('combobox').inputValue(), 'value');
          if (width <= 900) {
            await page.locator('[data-market-tab=KOSDAQ]').click();
            assert.equal(await kospi.isHidden(), true);
            assert.equal(await page.locator('[data-market=KOSDAQ] .foliotrace-result-count .foliotrace-num').innerText(), '418');
          }
          const latest = page.locator('#foliotrace-events');
          const more = latest.locator('button[aria-controls=foliotrace-latest-list]');
          await more.click();
          assert.equal(await latest.locator('#foliotrace-latest-list > li').count(), new Set(snapshot.events.map(e => e.stockCode ? `s:${e.stockCode}` : `c:${e.corpCode}`)).size);
          const samsungEvent = latest.locator('#foliotrace-latest-list > li').filter({ has: page.locator('.foliotrace-event-source > code', { hasText: '20260605000224' }) });
          assert.equal(await samsungEvent.locator('.foliotrace-change-up').count(), 1);
          assert.equal(await samsungEvent.locator('.foliotrace-change-down').count(), 1);
          await samsungEvent.screenshot({ path: path.join(out, `${id}-latest.png`) });
          await more.click(); assert.equal(await latest.locator('#foliotrace-latest-list > li').count(), 30);
          }
          facts.push({ id, geometry, layout: expectedTable ? 'two market tables' : 'cards', interactions: (width === 390 || width === 1440) && theme === 'light-coral', checks: 'layout, no overflow, independent signs, screen reader labels, search; detail at 390/1440; full controls and latest filings at light 390/1440', errors });
        } else facts.push({ id, errors });
        assert.deepEqual(errors, []);
      } finally { await context.close(); }
    });
  }
} finally {
  await fs.writeFile(path.join(out, 'results.json'), JSON.stringify(facts, null, 2));
  await browser.close();
}
