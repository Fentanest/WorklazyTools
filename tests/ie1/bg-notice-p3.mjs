import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import { startRecoveryServer } from '../recovery-server.mjs';
import { IOS_PRODUCT_RUN_KEY, productRecoveryMessages } from '../../src/features/image-studio/bgRemoval/recovery.ts';

const out = process.env.IE1_OUTPUT || '/tmp/sol-bg-notice-p3-20261103/ui';
await fs.mkdir(out, { recursive: true });
const server = await startRecoveryServer({ root: process.env.BG_P3_DIST || 'dist' });
const base = server.url;
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const image = new PNG({ width: 64, height: 48 }); image.data.fill(255);
const buffer = PNG.sync.write(image), records = [];
async function setup(lang, lowMemory = false, denied = false) {
  const context = await browser.newContext({ userAgent: lowMemory ? 'Android AppleWebKit/537.36 Chrome/138' : 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile/15E148 Safari/604.1', viewport: { width: 414, height: 900 }, hasTouch: true, isMobile: true, serviceWorkers: 'block' });
  await context.route('**/*', route => route.request().url().startsWith(base + '/') || /^(blob:|data:)/.test(route.request().url()) ? route.continue() : route.abort());
  await context.addInitScript(({ lowMemory, denied }) => {
    window.__WORKLAZY_MOCK_PROVIDERS__ = true;
    for (const [key, value] of Object.entries({ platform: lowMemory ? 'Linux armv8l' : 'iPhone', maxTouchPoints: 5, deviceMemory: lowMemory ? 4 : undefined, gpu: { requestAdapter: async () => ({ features: { has: () => true } }) } })) Object.defineProperty(navigator, key, { configurable: true, value });
    if (denied) Object.defineProperty(window, 'sessionStorage', { configurable: true, get() { throw new DOMException('Test storage unavailable', 'SecurityError'); } });
    window.__p3Runs = [];
    const Original = window.Worker;
    window.Worker = function(url, options) {
      if (!String(url).includes('bgRemoval.worker')) return new Original(url, options);
      return { onmessage: null, postMessage(request) {
        const { runId, input, mode } = request;
        window.__p3Runs.push(mode);
        this.onmessage?.({ data: { type: 'progress', runId, stage: 'run', current: 0, total: 1 } });
        window.__finishP3Worker = kind => this.onmessage?.({ data: kind === 'error' ? { type: 'error', runId, code: 'bg-inference-failed' } : { type: 'result', runId, blob: input } });
      }, terminate() {} };
    };
  }, { lowMemory, denied });
  const page = await context.newPage(), errors = [];
  page.setDefaultTimeout(45000); page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', dialog => dialog.type() === 'beforeunload' ? dialog.accept() : dialog.dismiss());
  const lib = JSON.parse(await fs.readFile(`src/locales/${lang}/features.json`, 'utf8')).image.library;
  const label = key => lib.labels[key] || key;
  const editor = page.getByTestId('library-image-editor'), select = page.getByTestId('image-background-controls').locator('select');
  const risk = page.getByRole('dialog', { name: lang === 'ko' ? '사물·제품 모드를 실행할까요?' : 'Run object/product mode?', exact: true });
  const download = page.getByRole('dialog', { name: lib.downloadTitle, exact: true });
  const flag = () => page.evaluate(key => sessionStorage.getItem(key), IOS_PRODUCT_RUN_KEY);
  const load = async () => { await page.goto(`${base}/${lang}/tools/image-studio/`); await editor.locator('.lower-canvas').waitFor(); };
  const upload = async () => {
    await page.locator('[data-image-owner=editor] input[type=file]').first().setInputFiles({ name: 'recovery-synthetic.png', mimeType: 'image/png', buffer });
    await page.waitForFunction(() => !document.querySelector('[data-testid=image-editor-add-to-batch]').disabled);
    if (lowMemory) await select.locator('option[value=product]').evaluate(n => { n.disabled = false; });
    await select.selectOption('product');
    await editor.getByRole('button', { name: label('Magic — more tools'), exact: true }).click();
    await editor.getByRole('menuitem', { name: label('Remove background'), exact: true }).click();
  };
  const run = () => editor.locator('.asp-options-panel').getByRole('button', { name: label('Remove background'), exact: true }).click();
  const approve = async () => {
    const previous = await page.evaluate(() => window.__p3Runs.length);
    await run(); await risk.waitFor();
    await risk.getByRole('button', { name: lang === 'ko' ? '그래도 진행' : 'Continue anyway', exact: true }).click();
    await page.waitForFunction(({ count, title }) => window.__p3Runs.length > count || [...document.querySelectorAll('dialog[open]')].some(d => d.getAttribute('aria-label') === title), { count: previous, title: lib.downloadTitle });
  };
  const startWorker = async () => {
    const previous = await page.evaluate(() => window.__p3Runs.length);
    await approve();
    if (await download.isVisible()) await download.getByRole('button', { name: lib.download, exact: true }).click();
    await page.waitForFunction(count => window.__p3Runs.length > count, previous);
  };
  const reload = async () => { await page.reload(); await editor.locator('.lower-canvas').waitFor(); };
  return { context, page, errors, lib, label, editor, select, risk, download, flag, load, upload, run, approve, startWorker, reload };
}
try {
  for (const lang of ['ko', 'en']) {
    await test(`${lang}: interrupted iOS product marker recovers without image data and normal exits clear it`, async () => {
      const f = await setup(lang); const { page, context, errors } = f;
      try {
        await f.load(); assert.equal(await f.flag(), null); await f.upload();
        await f.approve(); await f.download.waitFor(); assert.equal(await f.flag(), '1', 'only a constant flag after risk approval');
        await f.download.getByRole('button', { name: lang === 'ko' ? '작업 취소' : 'Cancel operation', exact: true }).click();
        await page.waitForFunction(key => sessionStorage.getItem(key) === null, IOS_PRODUCT_RUN_KEY);
        await f.startWorker(); assert.equal(await f.flag(), '1');
        // Held synthetic worker + reload leaves no JS finally, simulating process loss.
        await f.reload(); const notice = page.getByTestId('image-background-recovery'); await notice.waitFor();
        assert.ok((await notice.innerText()).includes(productRecoveryMessages[lang].body));
        assert.equal(await notice.getAttribute('role'), 'status'); assert.equal(await f.flag(), null, 'consume once after mount');
        assert.equal(await f.select.inputValue(), 'person');
        assert.equal(await page.locator('[data-image-owner=editor] input[type=file]').first().evaluate(n => n.files.length), 0, 'image input was not saved');
        await notice.screenshot({ path: `${out}/${lang}-recovered.png` });
        await f.reload(); assert.equal(await notice.count(), 0, 'a second reload does not repeat consumed recovery');
        await f.upload(); await f.startWorker(); assert.equal(await f.flag(), '1');
        await page.evaluate(() => window.__finishP3Worker('result'));
        await page.waitForFunction(key => sessionStorage.getItem(key) === null, IOS_PRODUCT_RUN_KEY);
        await page.waitForFunction(() => !document.querySelector('[data-testid=image-background-controls] select').disabled);
        await f.reload(); assert.equal(await notice.count(), 0, 'normal result is not an interruption');
        await f.upload(); await f.startWorker(); await page.evaluate(() => window.__finishP3Worker('error'));
        await page.getByTestId('image-editor-operation-error').waitFor(); assert.equal(await f.flag(), null);
        await f.reload(); assert.equal(await notice.count(), 0, 'handled inference error is not a lost process');
        assert.deepEqual(errors, []); records.push({ lang, case: 'recovery', payload: '1', recovered: true, restoredInputFiles: 0, normalResultCleared: true, errorCleared: true, errors });
      } finally { await context.close(); }
    });
    await test(`${lang}: product help separates the action title and restriction text visually`, async () => {
      const f = await setup(lang, true);
      try {
        await f.load(); await f.upload();
        const hint = f.editor.locator('.asp-options-panel .asp-hint');
        const lines = (await hint.innerText()).split('\n').map(x => x.trim()).filter(Boolean);
        assert.equal(lines[0], f.label('Remove background')); assert.match(lines.slice(1).join(' '), /4\s?G[Bb]/);
        assert.equal(await hint.evaluate(n => getComputedStyle(n).whiteSpace), 'pre-line');
        await hint.screenshot({ path: `${out}/${lang}-separated-help.png` });
        assert.equal(await f.flag(), null); assert.deepEqual(f.errors, []);
        records.push({ lang, case: 'help', titleLine: lines[0], separated: true });
      } finally { await f.context.close(); }
    });
    await test(`${lang}: unavailable sessionStorage does not block risk and download choices`, async () => {
      const f = await setup(lang, false, true);
      try {
        await f.load(); await f.upload(); await f.approve(); await f.download.waitFor();
        await f.download.getByRole('button', { name: lang === 'ko' ? '작업 취소' : 'Cancel operation', exact: true }).click();
        await f.download.waitFor({ state: 'hidden' }); assert.deepEqual(f.errors, []);
        records.push({ lang, case: 'storage-denied', consentReached: true, errors: f.errors });
      } finally { await f.context.close(); }
    });
  }
} finally { await fs.writeFile(`${out}/results.json`, JSON.stringify(records, null, 2) + '\n'); await browser.close(); await server.close(); }
