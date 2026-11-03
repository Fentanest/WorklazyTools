import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import { startRecoveryServer } from '../recovery-server.mjs';

const out = process.env.IE1_OUTPUT || 'scratch/bg-quality/ui';
await fs.mkdir(out, { recursive: true });
const server = process.env.TEST_BASE_URL ? null : await startRecoveryServer({ root: 'dist' });
const base = process.env.TEST_BASE_URL || server.url;
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const image = new PNG({ width: 64, height: 48 });
for (let i = 0; i < image.data.length; i += 4) {
  image.data.set([i % 256, (i / 4) % 256, 150, 255], i);
}
const buffer = PNG.sync.write(image), records = [];
try {
  for (const lang of ['ko', 'en']) await test(`${lang}: rejected mask shows feedback and preserves exported source pixels`, async () => {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    await context.addInitScript(() => {
      window.__WORKLAZY_MOCK_PROVIDERS__ = true;
      Object.defineProperty(navigator, 'deviceMemory', { value: 8 });
      Object.defineProperty(navigator, 'gpu', { value: { requestAdapter: async () => ({ features: { has: () => true } }) } });
      const Original = window.Worker;
      window.Worker = function(url, options) {
        if (!String(url).includes('bgRemoval.worker')) return new Original(url, options);
        // Controlled transport failure after guard rejection; real guard/retry have unit and model probes.
        return { onmessage: null, postMessage(request) {
          window.__qualityWorkerMode = request.mode;
          queueMicrotask(() => this.onmessage?.({ data: { type: 'error', runId: request.runId, code: 'bg-mask-unusable' } }));
        }, terminate() {} };
      };
    });
    await context.route('**/*', route => route.request().url().startsWith(base + '/') || /^(blob:|data:)/.test(route.request().url()) ? route.continue() : route.abort());
    const page = await context.newPage(); page.setDefaultTimeout(45000);
    const lib = JSON.parse(await fs.readFile(`src/locales/${lang}/features.json`, 'utf8')).image.library;
    const label = key => lib.labels[key] || key;
    try {
      await page.goto(`${base}/${lang}/tools/image-studio/`);
      const editor = page.getByTestId('library-image-editor'); await editor.locator('.lower-canvas').waitFor();
      await page.locator('[data-image-owner=editor] input[type=file]').first().setInputFiles({ name: 'mask-source.png', mimeType: 'image/png', buffer });
      await page.waitForFunction(() => !document.querySelector('[data-testid=image-editor-add-to-batch]').disabled);
      await page.getByTestId('image-background-controls').locator('select').selectOption('product');
      await editor.getByRole('button', { name: label('Magic — more tools'), exact: true }).click();
      await editor.getByRole('menuitem', { name: label('Remove background'), exact: true }).click();
      await editor.locator('.asp-options-panel').getByRole('button', { name: label('Remove background'), exact: true }).click();
      const download = page.getByRole('dialog', { name: lib.downloadTitle, exact: true });
      await download.getByRole('button', { name: lib.download, exact: true }).click();
      const alert = page.getByRole('alert');
      await alert.waitFor();
      const errorText = await alert.innerText();
      assert.match(errorText, lang === 'ko' ? /배경을 구분하지 못했습니다.*원본 이미지는 그대로/s : /Could not distinguish the background.*original image is unchanged/s);
      assert.equal(await page.evaluate(() => window.__qualityWorkerMode), 'product');
      await page.waitForFunction(() => !document.querySelector('[data-testid=image-background-controls] select').disabled);
      await page.getByRole('button', { name: 'PNG', exact: true }).click();
      const pending = page.waitForEvent('download');
      await page.getByTestId('image-editor-export-action').locator('button').click();
      const file = await pending; const path = `${out}/${lang}-source-after-rejection.png`; await file.saveAs(path);
      const exported = PNG.sync.read(await fs.readFile(path));
      assert.equal(exported.width, image.width); assert.equal(exported.height, image.height);
      assert.deepEqual(exported.data, image.data, 'no invalid mask applied to the editor');
      await page.screenshot({ path: `${out}/${lang}-feedback.png` });
      records.push({ lang, error: errorText, width: exported.width, height: exported.height, changedPixels: 0, controlledWorker: true });
    } finally { await context.close(); }
  });
} finally { await fs.writeFile(`${out}/results.json`, JSON.stringify(records, null, 2)); await browser.close(); await server?.close(); }
