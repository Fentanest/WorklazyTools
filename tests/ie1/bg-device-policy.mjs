import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import { startRecoveryServer } from '../recovery-server.mjs';

const out = process.env.IE1_OUTPUT || '/tmp/sol-ios-bg-docs/ui';
await fs.mkdir(out, { recursive: true });
const server = process.env.TEST_BASE_URL ? null : await startRecoveryServer({ root: 'dist' });
const base = process.env.TEST_BASE_URL || server.url;
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const image = new PNG({ width: 64, height: 48 }); image.data.fill(255);
const buffer = PNG.sync.write(image), records = [];
const devices = [
  { id: 'iphone', ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X) AppleWebKit/605.1.15 Version/26.0 Mobile/15E148 Safari/604.1', platform: 'iPhone', touch: 5, memory: null, blocked: true },
  { id: 'ipad-desktop', ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/26.0 Safari/605.1.15', platform: 'MacIntel', touch: 5, memory: null, blocked: true },
  { id: 'android-4', ua: 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/138.0 Mobile Safari/537.36', platform: 'Linux armv8l', touch: 5, memory: 4, blocked: true },
  { id: 'desktop-8', ua: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/138.0 Safari/537.36', platform: 'Linux x86_64', touch: 0, memory: 8, blocked: false },
  { id: 'touch-laptop', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/138.0 Safari/537.36', platform: 'Win32', touch: 10, coarse: false, mobile: false, memory: 8, blocked: false },
];
try {
  for (const lang of ['ko', 'en']) for (const device of devices) await test(`${lang} ${device.id}: product eligibility and input-specific selection help`, async () => {
    const mobile = device.mobile ?? !!device.touch;
    const context = await browser.newContext({ userAgent: device.ua, viewport: { width: mobile ? 414 : 1280, height: 900 }, hasTouch: !!device.touch, isMobile: mobile });
    const heavy = [], errors = [];
    await context.addInitScript(device => {
      window.__WORKLAZY_MOCK_PROVIDERS__ = true;
      if (device.coarse !== undefined) {
        const original = window.matchMedia.bind(window), queries = new Map();
        let coarse = device.coarse;
        window.matchMedia = query => {
          if (query !== '(pointer: coarse)' && query !== '(pointer: fine)') return original(query);
          if (!queries.has(query)) {
            const listeners = new Set();
            queries.set(query, { media: query, get matches() { return query === '(pointer: coarse)' ? coarse : !coarse; },
              addEventListener: (_, listener) => listeners.add(listener), removeEventListener: (_, listener) => listeners.delete(listener), listeners });
          }
          return queries.get(query);
        };
        window.__setPrimaryPointerCoarse = value => {
          coarse = value;
          for (const query of queries.values()) for (const listener of query.listeners) listener({ matches: query.matches, media: query.media });
        };
      }
      for (const [key, value] of Object.entries({ platform: device.platform, maxTouchPoints: device.touch, deviceMemory: device.memory ?? undefined,
        gpu: { requestAdapter: async () => ({ features: { has: name => name === 'shader-f16' } }) } })) Object.defineProperty(navigator, key, { configurable: true, value });
      const Original = window.Worker; window.__bgWorkers = 0;
      window.Worker = function(url, options) { if (String(url).includes('bgRemoval.worker')) window.__bgWorkers++; return new Original(url, options); };
    }, device);
    await context.route('**/*', route => {
      const url = route.request().url();
      if (/\/vendor\/(bg-removal|onnxruntime-web)\//.test(url)) { heavy.push(url); return route.abort(); }
      return url.startsWith(base + '/') || /^(blob:|data:)/.test(url) ? route.continue() : route.abort();
    });
    const page = await context.newPage(); page.setDefaultTimeout(20000);
    page.on('pageerror', e => errors.push(e.message));
    const lib = JSON.parse(await fs.readFile(`src/locales/${lang}/features.json`, 'utf8')).image.library;
    const label = key => lib.labels[key] || key;
    try {
      await page.goto(`${base}/${lang}/tools/image-studio/`);
      const editor = page.getByTestId('library-image-editor');
      await editor.locator('.lower-canvas').waitFor();
      const select = page.getByTestId('image-background-controls').locator('select');
      await page.waitForFunction(blocked => document.querySelector('[data-testid=image-background-controls] select').value === (blocked ? 'person' : 'product'), device.blocked);
      assert.deepEqual(await select.locator('option[value=product]').evaluate(option => ({ disabled: option.disabled, selector: option.matches(':disabled') })),
        { disabled: device.blocked, selector: device.blocked }, 'native option state (the locator enabled helper retargets option to its select)');
      assert.equal(await page.getByTestId('image-background-product-restriction').count(), device.blocked ? 1 : 0);
      if (device.blocked) {
        const warning = await page.getByTestId('image-background-product-restriction').innerText();
        assert.match(warning, lang === 'ko' ? /인물 모드나 수동 지우개/ : /portrait mode or the manual eraser/);
        assert.equal(await select.getAttribute('aria-describedby'), 'image-background-product-restriction');
      }
      await page.locator('[data-image-owner=editor] input[type=file]').first().setInputFiles({ name: 'device-synthetic.png', mimeType: 'image/png', buffer });
      await page.waitForFunction(() => !document.querySelector('[data-testid=image-editor-add-to-batch]').disabled);
      const panel = editor.locator('.asp-options-panel');
      const help = await panel.innerText();
      const coarse = device.coarse ?? !!device.touch;
      if (coarse) { assert.ok(help.includes(lib.touchSelectionHelp)); assert.doesNotMatch(help, /Shift/); }
      else assert.match(help, /Shift/);
      if (device.id === 'touch-laptop') {
        await page.evaluate(() => window.__setPrimaryPointerCoarse(true));
        await panel.getByText(lib.touchSelectionHelp, { exact: true }).waitFor();
        assert.doesNotMatch(await panel.innerText(), /Shift/);
        await panel.screenshot({ path: `${out}/${lang}-laptop-coarse.png` });
        await page.evaluate(() => window.__setPrimaryPointerCoarse(false));
        await page.waitForFunction(() => document.querySelector('.asp-options-panel')?.textContent.includes('Shift'));
        assert.match(await panel.innerText(), /Shift/);
        assert.equal(await page.getByTestId('image-editor-add-to-batch').isDisabled(), false, 'input remains loaded after pointer changes');
        await panel.screenshot({ path: `${out}/${lang}-laptop-fine.png` });
      }
      if (device.blocked) {
        // A forced/stale selector must not bypass the controller's guard.
        await select.locator('option[value=product]').evaluate(option => { option.disabled = false; });
        await select.selectOption('product');
        await editor.getByRole('button', { name: label('Magic — more tools'), exact: true }).click();
        await editor.getByRole('menuitem', { name: label('Remove background'), exact: true }).click();
        await panel.getByRole('button', { name: label('Remove background'), exact: true }).click();
        await page.getByTestId('image-editor-operation-error').waitFor();
        assert.match(await page.getByRole('alert').innerText(), lang === 'ko' ? /사물·제품 모델은 받거나 실행하지 않습니다/ : /will not be downloaded or run/);
        assert.equal(await page.getByRole('dialog').count(), 0, 'no download consent');
        await page.screenshot({ path: `${out}/${lang}-${device.id}.png` });
      } else await page.screenshot({ path: `${out}/${lang}-${device.id}.png` });
      assert.deepEqual(heavy, []);
      assert.equal(await page.evaluate(() => window.__bgWorkers), 0);
      assert.deepEqual(errors, []);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      records.push({ lang, device: device.id, blocked: device.blocked, shaderF16: true, memory: device.memory, touchPoints: device.touch, touchHelp: coarse, pointerChanges: device.id === 'touch-laptop' ? ['fine', 'coarse', 'fine'] : null, consent: 0, heavyRequests: heavy.length, workers: 0, errors });
    } catch (error) {
      console.log(JSON.stringify({ lang, device: device.id, signals: await page.evaluate(() => ({ ua: navigator.userAgent, platform: navigator.platform, touch: navigator.maxTouchPoints, memory: navigator.deviceMemory, option: document.querySelector('[data-testid=image-background-controls] option[value=product]')?.outerHTML, warning: document.querySelector('[data-testid=image-background-product-restriction]')?.textContent })) }));
      await page.screenshot({ path: `${out}/${lang}-${device.id}-failure.png` });
      throw error;
    } finally { await context.close(); }
  });
} finally {
  await fs.writeFile(`${out}/results.json`, JSON.stringify(records, null, 2));
  await browser.close(); await server?.close();
}
