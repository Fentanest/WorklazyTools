import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { test } from 'node:test';
import { chromium } from 'playwright';

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:49376';
const before = process.env.F5_PHASE === 'before';
assert.ok(process.env.F5_OUTPUT, 'Set F5_OUTPUT to an explicit evidence directory');
const out = process.env.F5_OUTPUT;
await fs.mkdir(out, { recursive: true });
const payload = await fs.readFile(new URL('./fixtures/foliotrace/latest-filings.json', import.meta.url));
const snapshot = JSON.parse(payload);
const manifest = { schemaVersion: 1, datasetVersion: snapshot.datasetVersion,
  snapshotPath: `snapshots/${snapshot.datasetVersion}.json`,
  snapshotSha256: createHash('sha256').update(payload).digest('hex') };
const expected = ['20261102000005', '20261101000099', '20261101000001', '20261102000002', '20261031000001'];
const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const facts = [];
try {
  for (const lang of ['ko', 'en']) for (const theme of ['light-coral', 'dark-coral']) for (const mobile of [false, true]) {
    const name = `${lang} ${theme} ${mobile ? 'mobile' : 'desktop'}`;
    await test(`F5 latest filings ${name}`, async () => {
      const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1100 }, deviceScaleFactor: 1 });
      const errors = [];
      await context.addInitScript(theme => {
        window.__WORKLAZY_MOCK_PROVIDERS__ = true;
        if (location.protocol === 'http:') localStorage.setItem('worklazy-theme', theme);
      }, theme);
      await context.route('**/*', route => {
        const url = route.request().url();
        if (url === `${base}/data/foliotrace/v1/manifest.json`) return route.fulfill({ json: manifest });
        if (url === `${base}/data/foliotrace/v1/${manifest.snapshotPath}`) return route.fulfill({ body: payload, contentType: 'application/json' });
        return url.startsWith(`${base}/`) || /^(data:|blob:)/.test(url) ? route.continue() : route.abort();
      });
      const page = await context.newPage();
      page.setDefaultTimeout(15000);
      page.on('pageerror', error => errors.push(error.message));
      const id = name.replaceAll(' ', '-');
      try {
        await page.goto(`${base}/${lang}/tools/foliotrace/`);
        const full = page.locator('#foliotrace-events');
        const rows = full.locator('> ul > li');
        await rows.first().waitFor();
        const receipts = await full.locator('.foliotrace-event-source > code').allTextContents();
        await page.evaluate(() => document.fonts.ready);
        await full.screenshot({ path: path.join(out, `${id}-log.png`) });
        if (before) assert.equal(receipts.length, 10, 'baseline still displays every event');
        else {
          assert.deepEqual(receipts, expected, 'one latest basis per stock/company, then receipt date and number');
          assert.match(await full.locator('.foliotrace-block-hint').innerText(), lang === 'ko' ? /^공시 10건.*최신 5건/ : /^Showing 5 latest.*from 10 records/);
          assert.match(await rows.nth(4).innerText(), /F5 Preferred/);
          assert.match(await rows.nth(3).innerText(), /F5 Common/);
          assert.doesNotMatch(await rows.nth(3).innerText(), lang === 'ko' ? /정정·철회/ : /Correction\/withdrawal/);
        }
        const holdings = page.locator('#foliotrace-holdings');
        const count = holdings.locator('.foliotrace-result-count .foliotrace-num');
        const input = holdings.getByRole('searchbox');
        await input.fill('100002'); assert.equal(await count.innerText(), '1');
        await input.fill('F5 Common'); assert.equal(await count.innerText(), '1');
        await input.fill('no-match'); assert.equal(await count.innerText(), '0');
        await holdings.getByRole('button', { name: lang === 'ko' ? '필터 초기화' : 'Reset filters', exact: true }).click();
        const labels = lang === 'ko' ? ['평가 포함', '평가 제외', '5% 미만', '비율 보정', '전체']
          : ['Included in valuation', 'Excluded from valuation', 'Below 5%', 'Ratio-adjusted', 'All'];
        for (const [index, label] of labels.entries()) {
          await holdings.locator('.foliotrace-pills').getByRole('button', { name: label, exact: true }).click();
          assert.equal(await count.innerText(), String([2, 1, 1, 1, 3][index]));
          assert.equal(await rows.count(), before ? 10 : 5, 'holding filters do not choose an older filing');
        }
        const sort = holdings.getByRole('combobox');
        for (const key of ['receipt', 'ownership', 'weight', 'value']) {
          await sort.selectOption(key); assert.equal(await sort.inputValue(), key); assert.equal(await count.innerText(), '3');
          assert.deepEqual(await holdings.locator('.foliotrace-table th[scope=row] .foliotrace-code-plain, .foliotrace-mrow .foliotrace-code-plain').allTextContents(),
            ['100001', '100002', '100003']);
        }
        const names = holdings.locator(mobile ? '.foliotrace-mrow' : '.foliotrace-name-btn');
        await names.first().click();
        const sheet = page.getByRole('dialog'); await sheet.waitFor();
        const history = sheet.locator('.foliotrace-events li');
        assert.equal(await history.count(), 5, 'all company filings remain in the existing holding sheet');
        assert.match(await sheet.innerText(), /20261030999999/);
        assert.match(await sheet.innerText(), /20261102000002/);
        assert.match(await sheet.innerText(), /20261102000003/, 'older-basis correction remains in full history');
        await page.keyboard.press('Escape'); await sheet.waitFor({ state: 'hidden' });
        if (!before) {
          for (const [receipt, older] of [['20261102000005', '20261001000001'], ['20261101000099', '20261031000099']]) {
            await rows.filter({ hasText: receipt }).getByRole('button').click();
            await sheet.waitFor(); assert.equal(await sheet.locator('.foliotrace-events li').count(), 2);
            assert.match(await sheet.innerText(), new RegExp(older));
            assert.equal(await sheet.locator(`a[href$="rcpNo=${older}"]`).count(), 1);
            assert.equal(await sheet.locator('dl').count(), 0, 'no fabricated holding figures for former/unidentified securities');
            if (receipt === '20261102000005') await sheet.screenshot({ path: path.join(out, `${id}-former-history.png`) });
            await page.keyboard.press('Escape'); await sheet.waitFor({ state: 'hidden' });
          }
        }
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'no horizontal page overflow');
        assert.deepEqual(errors, []);
        facts.push({ name, receipts, historyCount: 5, controls: 'search, all 5 quality filters and all 4 sorts', errors });
      } catch (error) {
        await page.screenshot({ path: path.join(out, `${id}-failure.png`) }).catch(() => {});
        throw error;
      } finally { await context.close(); }
    });
  }
} finally {
  await fs.writeFile(path.join(out, 'results.json'), JSON.stringify(facts, null, 2));
  await browser.close();
}
