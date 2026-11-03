import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import { startRecoveryServer } from '../recovery-server.mjs';

const out = process.env.IE1_OUTPUT || '/tmp/sol-bg-notice-20261103/ui';
await fs.mkdir(out, { recursive: true });
const server = process.env.TEST_BASE_URL ? null : await startRecoveryServer({ root: 'dist' });
const base = process.env.TEST_BASE_URL || server.url;
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const image = new PNG({ width: 64, height: 48 }); image.data.fill(255);
const buffer = PNG.sync.write(image), records = [];
const devices = [
  { id: 'iphone', ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile/15E148 Safari/604.1', platform: 'iPhone', touch: 5, warning: true },
  { id: 'ipad-desktop', ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/26.0 Safari/605.1.15', platform: 'MacIntel', touch: 5, warning: true },
  { id: 'android-4', ua: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/138.0 Mobile Safari/537.36', platform: 'Linux armv8l', touch: 5, memory: 4, blocked: true },
  { id: 'desktop-8', ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/138.0 Safari/537.36', platform: 'Linux x86_64', touch: 0, memory: 8 },
];
try {
  for (const lang of ['ko', 'en']) for (const device of devices) await test(`${lang} ${device.id}: risk choice, download ordering and restriction feedback lifecycle`, async () => {
    const context = await browser.newContext({ userAgent: device.ua, viewport: { width: device.touch ? 414 : 1280, height: 900 }, hasTouch: !!device.touch, isMobile: !!device.touch, serviceWorkers: 'block' });
    const heavy = [], errors = [];
    await context.addInitScript(device => {
      window.__WORKLAZY_MOCK_PROVIDERS__ = true;
      for (const [key, value] of Object.entries({ platform: device.platform, maxTouchPoints: device.touch, deviceMemory: device.memory,
        gpu: { requestAdapter: async () => ({ features: { has: name => name === 'shader-f16' } }) } })) Object.defineProperty(navigator, key, { configurable: true, value });
      window.__noticeWorkerModes = [];
      const Original = window.Worker;
      window.Worker = function(url, options) {
        if (!String(url).includes('bgRemoval.worker')) return new Original(url, options);
        return { onmessage: null, postMessage(request) {
          window.__noticeWorkerModes.push(request.mode);
          window.__completeNoticeWorker = () => this.onmessage?.({ data: { type: 'result', runId: request.runId, blob: request.input } });
        }, terminate() {} };
      };
    }, device);
    await context.route('**/*', route => {
      const url = route.request().url();
      if (/\/vendor\/(bg-removal|onnxruntime-web)\//.test(url)) heavy.push(url);
      if (/\/vendor\/bg-removal\/product\//.test(url)) return route.abort();
      return url.startsWith(base + '/') || /^(blob:|data:)/.test(url) ? route.continue() : route.abort();
    });
    const page = await context.newPage(); page.setDefaultTimeout(30000); page.on('pageerror', error => errors.push(error.message));
    const lib = JSON.parse(await fs.readFile(`src/locales/${lang}/features.json`, 'utf8')).image.library;
    const label = key => lib.labels[key] || key;
    const riskTitle = lang === 'ko' ? '사물·제품 모드를 실행할까요?' : 'Run object/product mode?';
    const risk = page.getByRole('dialog', { name: riskTitle, exact: true });
    const download = page.getByRole('dialog', { name: lib.downloadTitle, exact: true });
    try {
      await page.goto(`${base}/${lang}/tools/image-studio/`);
      const editor = page.getByTestId('library-image-editor'); await editor.locator('.lower-canvas').waitFor();
      await page.locator('[data-image-owner=editor] input[type=file]').first().setInputFiles({ name: 'notice-synthetic.png', mimeType: 'image/png', buffer });
      await page.waitForFunction(() => !document.querySelector('[data-testid=image-editor-add-to-batch]').disabled);
      const select = page.getByTestId('image-background-controls').locator('select');
      assert.equal(await select.locator('option[value=product]').evaluate(n => n.disabled), !!device.blocked);
      if (device.blocked) await select.locator('option[value=product]').evaluate(n => { n.disabled = false; });
      await select.selectOption('product');
      await editor.getByRole('button', { name: label('Magic — more tools'), exact: true }).click();
      await editor.getByRole('menuitem', { name: label('Remove background'), exact: true }).click();
      const run = () => editor.locator('.asp-options-panel').getByRole('button', { name: label('Remove background'), exact: true }).click();
      await run();
      if (device.warning) {
        await risk.waitFor();
        assert.match(await risk.innerText(), lang === 'ko' ? /탭이 종료될 수.*인물 모드나 수동 지우개/s : /close the tab.*portrait mode or the manual eraser/s);
        assert.equal(await download.count(), 0); assert.deepEqual(heavy, []);
        await page.screenshot({ path: `${out}/${lang}-${device.id}-risk.png` });
        await risk.getByRole('button', { name: lang === 'ko' ? '취소' : 'Cancel', exact: true }).click();
        await risk.waitFor({ state: 'hidden' });
        await page.getByTestId('image-background-cancelled').waitFor();
        assert.equal(await download.count(), 0); assert.equal(await page.getByRole('alert').count(), 0); assert.deepEqual(heavy, []);
        await run(); await risk.waitFor();
        assert.equal(await page.getByTestId('image-background-cancelled').count(), 0, 'new run clears old cancellation notice');
        await risk.getByRole('button', { name: lang === 'ko' ? '그래도 진행' : 'Continue anyway', exact: true }).click();
        await download.waitFor(); assert.equal(await risk.count(), 0); assert.deepEqual(heavy, []);
        await page.screenshot({ path: `${out}/${lang}-${device.id}-download-consent.png` });
        await download.getByRole('button', { name: lang === 'ko' ? '작업 취소' : 'Cancel operation', exact: true }).click();
        await download.waitFor({ state: 'hidden' });
      } else if (device.blocked) {
        await page.getByTestId('image-editor-operation-error').waitFor();
        assert.match(await page.getByRole('alert').innerText(), /4\s?G[Bb]/);
        assert.equal(await risk.count(), 0); assert.equal(await download.count(), 0); assert.deepEqual(heavy, []);
        await page.screenshot({ path: `${out}/${lang}-${device.id}-blocked.png` });
      } else {
        await download.waitFor(); assert.equal(await risk.count(), 0); assert.deepEqual(heavy, []);
        await download.getByRole('button', { name: lang === 'ko' ? '작업 취소' : 'Cancel operation', exact: true }).click();
      }
      await page.waitForFunction(() => !document.querySelector('[data-testid=image-background-controls] select').disabled);
      await select.selectOption('person');
      assert.equal(await page.getByTestId('image-editor-operation-error').count(), 0, 'changing mode removes the prior restriction error');
      assert.equal(await page.getByRole('alert').count(), 0);
      await run(); await download.waitFor(); assert.equal(await risk.count(), 0, 'portrait does not ask for product risk consent');
      await download.getByRole('button', { name: lib.download, exact: true }).click();
      await page.waitForFunction(() => window.__noticeWorkerModes.length === 1);
      assert.equal(await page.getByRole('alert').count(), 0, 'new run has no stale restriction alert');
      await page.evaluate(() => window.__completeNoticeWorker());
      await page.waitForFunction(() => !document.querySelector('[data-testid=image-background-controls] select').disabled);
      await editor.locator('.asp-options-panel').getByRole('button', { name: label('Remove background'), exact: true }).waitFor();
      assert.equal(await page.getByRole('alert').count(), 0, 'successful portrait run has no stale restriction alert');
      assert.equal(await risk.count(), 0); assert.equal(await download.count(), 0);
      assert.equal(await page.getByTestId('image-background-product-restriction').count(), device.blocked ? 1 : 0, 'only actual low-memory devices keep a capability status');
      assert.ok(heavy.every(url => !url.includes('/product/')));
      assert.deepEqual(await page.evaluate(() => window.__noticeWorkerModes), ['person']);
      assert.deepEqual(errors, []);
      await page.screenshot({ path: `${out}/${lang}-${device.id}-portrait-complete.png` });
      records.push({ lang, device: device.id, warned: !!device.warning, blocked: !!device.blocked, alertAfterMode: 0, alertAfterStart: 0, alertAfterSuccess: 0, workerModes: ['person'], productDownloads: 0, heavyRequests: heavy.length, errors });
    } catch (error) { await page.screenshot({ path: `${out}/${lang}-${device.id}-failure.png` }); throw error; }
    finally { await context.close(); }
  });
} finally { await fs.writeFile(`${out}/results.json`, JSON.stringify(records, null, 2) + '\n'); await browser.close(); await server?.close(); }
