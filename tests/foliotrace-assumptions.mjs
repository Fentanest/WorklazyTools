import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:49413';
assert.ok(process.env.FT_ASSUMPTION_OUTPUT, 'Set FT_ASSUMPTION_OUTPUT to an evidence directory');
const out = process.env.FT_ASSUMPTION_OUTPUT; await fs.mkdir(out, { recursive: true });
const read = async name => JSON.parse(await fs.readFile(new URL(`./fixtures/foliotrace/${name}.json`, import.meta.url)));
const old = await read('chart-snapshot-20261103'), fresh = await read('assumption-replay-20261113');
const reference = JSON.parse(await fs.readFile(new URL('../src/features/foliotrace/data/marketReference.json', import.meta.url)));
const marketOf = h => reference.markets[h.stockCode] || 'UNKNOWN';
const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const facts = [];
const shotStyle = '.wl-topbar,.mobile-header,.bottom-tabs{visibility:hidden!important}';
try {
  for (const [format, data] of [['old', old], ['new', fresh]]) for (const lang of ['ko', 'en']) for (const theme of ['light-coral', 'dark-coral']) {
    const mobile = (lang === 'en') === (theme === 'dark-coral');
    const id = `${format}-${lang}-${theme}-${mobile ? 'mobile' : 'desktop'}`;
    if (process.env.FT_ASSUMPTION_ONLY && id !== process.env.FT_ASSUMPTION_ONLY) continue;
    await test(`old/new contract display, filters, evidence and accessibility ${id}`, async () => {
      const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1100 } });
      const errors = [], blocked = [];
      try {
        await context.addInitScript(theme => {
          window.__WORKLAZY_MOCK_PROVIDERS__ = true;
          if (location.protocol === 'http:' || location.protocol === 'https:') localStorage.setItem('worklazy-theme', theme);
          window.__ftLabels = [];
          const original = CanvasRenderingContext2D.prototype.fillText;
          CanvasRenderingContext2D.prototype.fillText = function(text, ...args) {
            window.__ftLabels.push(String(text)); return original.call(this, text, ...args);
          };
        }, theme);
        const body = JSON.stringify(data), manifest = { schemaVersion: 1, datasetVersion: data.datasetVersion,
          snapshotPath: `snapshots/${data.datasetVersion}.json`, snapshotSha256: createHash('sha256').update(body).digest('hex') };
        await context.route('**/*', route => {
          const url = route.request().url();
          if (url === `${base}/data/foliotrace/v1/manifest.json`) return route.fulfill({ json: manifest });
          if (url === `${base}/data/foliotrace/v1/${manifest.snapshotPath}`) return route.fulfill({ body, contentType: 'application/json' });
          if (url.startsWith(`${base}/`) || /^(data:|blob:)/.test(url)) return route.continue();
          blocked.push(new URL(url).hostname); return route.abort();
        });
        const page = await context.newPage(); page.setDefaultTimeout(30000);
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(`${base}/${lang}/tools/foliotrace/`, { waitUntil: 'domcontentloaded' });
        await page.locator('[data-chart-ready=true]').waitFor();
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({ path: path.join(out, `${id}-summary.png`), animations: 'disabled' });
        if (format === 'new') {
          assert.match(await page.getByTestId('foliotrace-assumption-summary').innerText(), lang === 'ko' ? /17종목 가운데 수량 가정 16종목/ : /16 quantity-assumed securities among 17 priced/);
          assert.match(await page.getByTestId('foliotrace-assumption-summary').innerText(), /220,522,672,863/);
          assert.equal(await page.getByTestId('foliotrace-history-chart').getAttribute('data-point-count'), '20');
          const changes = page.getByTestId('foliotrace-method-changes');
          assert.equal(await changes.locator('time').first().getAttribute('datetime'), '2026-11-11');
          assert.match(await changes.innerText(), /2 → 3/);
          await changes.locator('summary').click();
          assert.equal(await changes.locator('tbody tr').count(), 20);
          assert.equal(await changes.locator('tbody tr').last().locator('td').last().innerText(), '3');
          await page.waitForFunction(label => window.__ftLabels.some(text => text.includes(label)), lang === 'ko' ? '방법 3' : 'Method 3');
          await page.locator('.foliotrace-trend').screenshot({ path: path.join(out, `${id}-history.png`), style: shotStyle, animations: 'disabled' });
          const cellsFit = await changes.locator('tbody tr').first().evaluate(row => {
            const cells = [...row.children].map(cell => cell.getBoundingClientRect());
            const text = row.children[1]; const range = document.createRange(); range.selectNodeContents(text);
            return range.getBoundingClientRect().right <= cells[2].left;
          });
          assert.ok(cellsFit, 'exact amount and method columns do not overlap');
          await changes.locator('summary').click();
          const label = lang === 'ko' ? '수량 가정' : 'Quantity assumed';
          const rowLabel = lang === 'ko' ? '증자 뒤 수량 미확인' : 'Post-offering quantity unconfirmed';
          const groups = ['KOSPI', 'KOSDAQ'];
          for (const market of groups) {
            const expected = data.holdings.filter(h => marketOf(h) === market && h.quantityAssumption).length;
            if (mobile) await page.locator(`[data-market-tab=${market}]`).click();
            const panel = page.locator(`[data-market=${market}]`);
            await panel.getByRole('button', { name: label, exact: true }).click();
            assert.equal(await panel.locator('.foliotrace-result-count .foliotrace-num').innerText(), String(expected));
            if (!expected) continue;
            const rows = panel.locator(mobile ? '.foliotrace-mrow' : 'tbody tr');
            assert.equal(await rows.count(), expected);
            for (const text of await rows.allTextContents()) assert.ok(text.includes(rowLabel));
            if (market === 'KOSDAQ') await panel.screenshot({ path: path.join(out, `${id}-assumed-list.png`), style: shotStyle, animations: 'disabled' });
          }
          const panel = page.locator('[data-market=KOSDAQ]');
          const row = panel.locator(mobile ? '.foliotrace-mrow' : 'tbody tr').filter({ hasText: '아모텍' });
          if (mobile) await row.click();
          else await row.getByRole('button').first().click();
          const detail = page.getByTestId('foliotrace-assumption-detail'); await detail.waitFor();
          const detailWidth = await detail.locator('dd').evaluate(node => node.getBoundingClientRect().width);
          assert.ok(detailWidth >= 300, 'assumption explanation uses the readable panel width');
          assert.match(await detail.innerText(), /20260811900495/);
          assert.match(await detail.innerText(), /2026-08-25/);
          assert.match(await detail.innerText(), /2,370,000/);
          assert.match(await detail.innerText(), lang === 'ko' ? /보유자의 청약 수량 아님/ : /not the holder’s subscription/);
          assert.equal(await detail.locator('a').getAttribute('href'), 'https://dart.fss.or.kr/dsaf001/main.do?rcpNo=20260811900495');
          assert.ok(await page.locator('.foliotrace-detail-panel').evaluate(node => node.scrollWidth <= node.clientWidth + 1), 'detail text stays within the panel');
          assert.doesNotMatch(await page.locator('.foliotrace-detail-panel').innerText(), /rights_offering_not_subscribed|corporate_action_/);
          const detailAxe = await new AxeBuilder({ page }).include('.foliotrace-detail-panel').analyze();
          await fs.writeFile(path.join(out, `${id}-detail-axe.json`), JSON.stringify(detailAxe.violations, null, 2));
          assert.deepEqual(detailAxe.violations.map(v => ({ id: v.id, impact: v.impact })), []);
          await page.locator('.foliotrace-detail-panel').screenshot({ path: path.join(out, `${id}-detail.png`), style: shotStyle, animations: 'disabled' });
          await page.keyboard.press('Escape');
          await detail.waitFor({ state: 'hidden' });
          // Filter controls remain keyboard focusable and retain their selected state after closing details.
          assert.equal(await panel.getByRole('button', { name: label, exact: true }).getAttribute('aria-pressed'), 'true');
        } else {
          assert.equal(await page.getByTestId('foliotrace-assumption-summary').count(), 0);
          assert.equal(await page.getByTestId('foliotrace-method-changes').count(), 0);
          assert.equal(await page.getByTestId('foliotrace-history-chart').getAttribute('data-point-count'), '7');
          await page.locator('.foliotrace-trend').screenshot({ path: path.join(out, `${id}-history.png`), style: shotStyle, animations: 'disabled' });
          assert.equal(await page.locator('#foliotrace-holdings .foliotrace-table tbody tr, #foliotrace-holdings .foliotrace-mrow').count(), data.holdings.length);
          // Audit the changed filter/empty-state controls on old data; the existing full-list
          // smoke covers its 1,192 unchanged rows. No assumption is invented for old data.
          for (const market of ['KOSPI', 'KOSDAQ']) {
            if (mobile) await page.locator(`[data-market-tab=${market}]`).click();
            const panel = page.locator(`[data-market=${market}]`);
            await panel.getByRole('button', { name: lang === 'ko' ? '수량 가정' : 'Quantity assumed', exact: true }).click();
            assert.equal(await panel.locator('.foliotrace-result-count .foliotrace-num').innerText(), '0');
          }
        }
        const axe = await new AxeBuilder({ page }).include('.foliotrace-trend').include('#foliotrace-holdings').analyze();
        await fs.writeFile(path.join(out, `${id}-axe.json`), JSON.stringify(axe.violations, null, 2));
        assert.deepEqual(axe.violations.map(v => ({ id: v.id, impact: v.impact })), []);
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal page overflow');
        assert.deepEqual(errors, []);
        facts.push({ id, assumptions: format === 'new' ? 16 : 0, points: format === 'new' ? 20 : 7, axeViolations: 0, errors, blocked });
      } catch (error) {
        const page = context.pages()[0]; if (page) await page.screenshot({ path: path.join(out, `${id}-failure.png`) }).catch(() => {});
        throw error;
      } finally { await context.close(); }
    });
  }
} finally { await fs.writeFile(path.join(out, 'results.json'), JSON.stringify(facts, null, 2)); await browser.close(); }
