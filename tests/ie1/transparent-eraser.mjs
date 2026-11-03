import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import { startRecoveryServer } from '../recovery-server.mjs';

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:4207';
const out = process.env.IE_TRANSPARENT_OUTPUT || '/tmp/ie-transparent-eraser';
await fs.mkdir(out, { recursive: true });
// UI checks use a completed immutable production build. Vite remains only the
// QA engine host, so another suite's dependency discovery cannot reload the UI.
const uiServer = process.env.IE_UI_BASE_URL ? undefined : await startRecoveryServer({ root: process.env.IE_DIST || 'dist', port: 0 });
const uiBase = process.env.IE_UI_BASE_URL || uiServer.url;
console.log(`UI snapshot: ${uiBase}; QA engine: ${base}`);
const labels = Object.fromEntries(await Promise.all(['en', 'ko'].map(async language => [language,
  JSON.parse(await fs.readFile(new URL(`../../src/locales/${language}/features.json`, import.meta.url), 'utf8')).image.library.labels])));
const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE, args: ['--no-sandbox'] });
const facts = [];
async function setup(language = 'en', theme = 'light-coral', mobile = false, engine = false) {
  const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1100 },
    deviceScaleFactor: 1, isMobile: mobile, hasTouch: mobile });
  await context.addInitScript(theme => { window.__WORKLAZY_MOCK_PROVIDERS__ = true; localStorage.setItem('worklazy-theme', theme); }, theme);
  await context.route('**/*', route => (route.request().url().startsWith(base + '/') || route.request().url().startsWith(uiBase + '/')) || /^(data:|blob:)/.test(route.request().url()) ? route.continue() : route.abort());
  const page = await context.newPage();
  const cpuThrottle = Number(process.env.IE_MOBILE_CPU_THROTTLE || 1);
  assert.ok(Number.isFinite(cpuThrottle) && cpuThrottle >= 1 && cpuThrottle <= 10);
  if (mobile && cpuThrottle > 1) {
    const session = await context.newCDPSession(page); await session.send('Emulation.setCPUThrottlingRate', { rate: cpuThrottle });
    console.log(`Mobile CPU throttle: ${cpuThrottle}x`);
  }
  page.setDefaultTimeout(60_000); page.on('dialog', dialog => dialog.accept());
  await page.goto(engine ? `${base}/tests/ie1/engine.html` : `${uiBase}/${language}/tools/image-studio/`);
  if (engine) await page.waitForFunction(() => window.ready);
  else {
    assert.equal(await page.locator('script[src*="/@vite/client"]').count(), 0, 'UI must use a completed production build, not the HMR dev host');
    await page.locator('[data-testid=library-image-editor] .lower-canvas').waitFor();
    await page.waitForFunction(() => !document.querySelector('[data-testid=image-editor-add-to-batch]')?.disabled);
  }
  return { context, page };
}
function pngFacts(bytes) {
  const image = PNG.sync.read(bytes); let zero = 0, opaque = 0;
  for (let i = 3; i < image.data.length; i += 4) { if (image.data[i] === 0) zero++; if (image.data[i] === 255) opaque++; }
  const at = (x, y) => [...image.data.subarray((y * image.width + x) * 4, (y * image.width + x) * 4 + 4)];
  return { width: image.width, height: image.height, zero, opaque, center: at(Math.floor(image.width / 2), Math.floor(image.height / 2)), corner: at(10, 10) };
}
async function footerPNG(page, name) {
  await page.locator('[data-testid=image-editor-send-actions]').getByRole('button', { name: 'PNG', exact: true }).click();
  const downloading = page.waitForEvent('download'); await page.locator('[data-testid=image-editor-export-action] button').click();
  const download = await downloading; const file = path.join(out, name); await download.saveAs(file);
  return pngFacts(await fs.readFile(file));
}
async function eraseUI(page, language) {
  const editor = page.getByTestId('library-image-editor');
  await editor.getByRole('button', { name: labels[language].Eraser, exact: true }).click();
  const range = editor.locator('.asp-options-panel input[type=range]').first(); await range.focus(); await range.press('End');
  const canvas = editor.locator('.upper-canvas');
  await page.evaluate(() => document.fonts.ready);
  // Numeric scrollBy inherited html { scroll-behavior:smooth }, so the previous
  // test sampled an animating rect. Instant positioning + stable RAF geometry
  // removes that race. No stroke or pixel assertion is retried or weakened.
  await canvas.scrollIntoViewIfNeeded();
  await canvas.evaluate(node => {
    window.scrollTo({ top: scrollY + node.getBoundingClientRect().top - 250, behavior: 'instant' });
    delete window.__ieStrokeStability;
  });
  const stable = await page.waitForFunction(() => {
    const node = document.querySelector('[data-testid=library-image-editor] .upper-canvas');
    if (!node) return false;
    const r = node.getBoundingClientRect();
    if (Math.abs(r.top - 250) > 1) {
      window.scrollTo({ top: scrollY + r.top - 250, behavior: 'instant' });
      delete window.__ieStrokeStability; return false;
    }
    const hits = [0.35, 0.5, 0.65].every(f => document.elementFromPoint(r.x + r.width / 2, r.y + r.height * f) === node);
    const key = [r.x, r.y, r.width, r.height, scrollX, scrollY].map(value => Math.round(value * 1000)).join(':');
    const previous = window.__ieStrokeStability;
    const frames = hits && previous?.key === key ? previous.frames + 1 : hits ? 1 : 0;
    window.__ieStrokeStability = { key, frames };
    return frames >= 6 ? { x: r.x, y: r.y, width: r.width, height: r.height } : false;
  }, undefined, { polling: 'raf', timeout: 15000 });
  const box = await stable.jsonValue(); await stable.dispose();
  for (const fraction of [0.35, 0.5, 0.65]) assert.ok(await canvas.evaluate((node, point) =>
    document.elementFromPoint(point.x, point.y) === node, { x: box.x + box.width / 2, y: box.y + box.height * fraction }), 'stroke must hit the actual canvas');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.35); await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.65, { steps: 16 }); await page.mouse.up();
  await editor.getByText(labels[language]['Eraser stroke'], { exact: true }).waitFor({ state: 'attached', timeout: 15000 });
}
async function engineBlob(page, format) {
  return Buffer.from(await page.evaluate(async format => {
    const blob = await window.engine.exportImage(format, 95, [format]);
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  }, format));
}
async function engineSource(page) {
  await page.evaluate(async () => {
    const e = await window.newEngine({ exportArea: 'image' });
    const source = document.createElement('canvas'); source.width = 900; source.height = 600;
    const ctx = source.getContext('2d'); ctx.fillStyle = '#2060d0'; ctx.fillRect(0, 0, 900, 600);
    await e.loadImage(source.toDataURL('image/png'));
  });
}
async function engineStroke(page, erase = true, color = '#ff0000') {
  await page.evaluate(({ erase, color }) => {
    const e = window.engine; const point = e.canvas.getObjects().find(object => object.get('aspId') === 'base').getCenterPoint();
    e.setFreeDraw(true, { color, strokeWidth: 45 }, false, erase);
    const stroke = e.canvas.freeDrawingBrush.createPath([['M', point.x - 60, point.y], ['L', point.x + 60, point.y]]);
    e.canvas.add(stroke); e.canvas.fire('path:created', { path: stroke }); e.canvas.requestRenderAll();
  }, { erase, color });
}
try {
  for (const language of ['ko', 'en']) for (const theme of ['light-coral', 'dark-coral']) for (const mobile of [false, true]) {
    const name = `${language}-${theme}-${mobile ? 'mobile' : 'desktop'}`;
    await test(`transparent sample and real eraser UI ${name}`, async () => {
      const { context, page } = await setup(language, theme, mobile);
      try {
        const editor = page.getByTestId('library-image-editor');
        await eraseUI(page, language);
        const erased = await footerPNG(page, `${name}-erased.png`);
        assert.deepEqual([erased.width, erased.height], [900, 600]); assert.equal(erased.center[3], 0); assert.equal(erased.corner[3], 255);
        await editor.getByRole('button', { name: labels[language].Image, exact: true }).click();
        const transparent = editor.locator('[data-sample-key=transparent]');
        assert.equal(await transparent.getAttribute('aria-label'), labels[language]['Transparent background']);
        await editor.locator('.asp-image-editor').screenshot({ path: path.join(out, `${name}-picker.png`) });
        await transparent.click();
        await page.waitForFunction(() => {
          const canvas = document.querySelector('[data-testid=library-image-editor] .lower-canvas');
          const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
          for (let i = 3; i < pixels.length; i += 4) if (pixels[i] !== 0) return false;
          return true;
        });
        const blank = await footerPNG(page, `${name}-transparent.png`);
        assert.deepEqual([blank.width, blank.height], [900, 600]); assert.equal(blank.zero, 900 * 600); assert.equal(blank.opaque, 0);
        await editor.locator('.asp-image-editor').screenshot({ path: path.join(out, `${name}-transparent-ui.png`) });
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
        facts.push({ name, erased, blank });
      } catch (error) {
        await page.screenshot({ path: path.join(out, `${name}-failure.png`), fullPage: true }).catch(() => {});
        await fs.writeFile(path.join(out, `${name}-failure.json`), JSON.stringify({ error: String(error), layers: await page.locator('.asp-layer-list').allTextContents() }, null, 2));
        throw error;
      } finally { await context.close(); }
    });
  }
  await test('transparent sample footer WebP keeps alpha and JPG uses the existing white matte', async () => {
    const { context, page } = await setup();
    try {
      const editor = page.getByTestId('library-image-editor');
      await editor.getByRole('button', { name: 'Image', exact: true }).click();
      await editor.locator('[data-sample-key=transparent]').click();
      await page.waitForFunction(() => document.querySelectorAll('.asp-layers__row').length === 1);
      const formats = {};
      for (const format of ['webp', 'jpeg']) {
        await page.locator('[data-testid=image-editor-send-actions]').getByRole('button', { name: format === 'jpeg' ? 'JPG' : 'WebP', exact: true }).click();
        const downloading = page.waitForEvent('download');
        await page.locator('[data-testid=image-editor-export-action] button').click();
        const download = await downloading; const file = path.join(out, `transparent-footer.${format}`); await download.saveAs(file);
        const bytes = await fs.readFile(file);
        const pixels = await page.evaluate(async data => {
          const image = await createImageBitmap(new Blob([new Uint8Array(data)]));
          try {
            const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
            const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
            const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data; let zero = 0;
            for (let i = 3; i < d.length; i += 4) if (d[i] === 0) zero++;
            return { width: canvas.width, height: canvas.height, zero, first: [...d.slice(0, 4)] };
          } finally { image.close(); }
        }, [...bytes]);
        assert.deepEqual([pixels.width, pixels.height], [900, 600]);
        if (format === 'webp') assert.equal(pixels.zero, 900 * 600);
        else { assert.equal(pixels.zero, 0); assert.deepEqual(pixels.first, [255, 255, 255, 255]); }
        formats[format] = pixels;
      }
      facts.push({ name: 'footer formats', formats });
    } finally { await context.close(); }
  });
  for (const language of ['ko', 'en']) await test(`JPG alpha notice is accurate for footer/native ${language}`, async () => {
    const { context, page } = await setup(language);
    try {
      const editor = page.getByTestId('library-image-editor');
      const features = JSON.parse(await fs.readFile(new URL(`../../src/locales/${language}/features.json`, import.meta.url), 'utf8'));
      const notice = page.getByTestId('image-jpeg-transparency');
      for (const [kind, alpha] of [['transparent', 0], ['opaque', 255], ['partial', 128]]) {
        const image = new PNG({ width: 64, height: 48 });
        for (let i = 0; i < image.data.length; i += 4) image.data.set([32, 96, 208, 255], i);
        image.data[3] = alpha;
        await page.evaluate(() => window.__hintOldCanvas = document.querySelector('.lower-canvas'));
        await editor.locator('input[type=file]').first().setInputFiles({ name: `${kind}.png`, mimeType: 'image/png', buffer: PNG.sync.write(image) });
        await page.waitForFunction(() => document.querySelector('.lower-canvas') !== window.__hintOldCanvas && !document.querySelector('[data-testid=image-editor-add-to-batch]').disabled);
        assert.equal(await notice.count(), 0, 'new document clears previous export notice');
        for (const route of ['footer', 'native']) {
          if (route === 'footer') {
            await page.locator('[data-testid=image-editor-send-actions]').getByRole('button', { name: 'JPG', exact: true }).click();
            const downloading = page.waitForEvent('download'); await page.locator('[data-testid=image-editor-export-action] button').click();
            await (await downloading).saveAs(path.join(out, `hint-${language}-${kind}-${route}.jpg`));
          } else {
            await editor.getByRole('button', { name: labels[language].Export, exact: true }).click();
            await editor.locator('.asp-menu--export').getByRole('button', { name: 'JPEG', exact: true }).click();
            const downloading = page.waitForEvent('download'); await editor.locator('.asp-menu--export .asp-download').click();
            await (await downloading).saveAs(path.join(out, `hint-${language}-${kind}-${route}.jpg`));
          }
          if (alpha < 255) { await notice.waitFor(); assert.equal(await notice.textContent(), features.image.library.jpegTransparency); }
          else assert.equal(await notice.count(), 0, 'opaque output must not warn because of preview margins');
        }
        await footerPNG(page, `hint-${language}-${kind}-png.png`);
        assert.equal(await notice.count(), 0, 'PNG output does not show the JPG notice');
      }
      facts.push({ name: `JPG hint ${language}`, opaque: 'hidden', partial: 'shown', transparent: 'shown', routes: ['footer', 'native'] });
    } finally { await context.close(); }
  });
  await test('eraser clears lower image/drawing layers, ignores colour and allows new drawing above', async () => {
    const { context, page } = await setup('en', 'light-coral', false, true);
    try {
      await engineSource(page); await engineStroke(page, false, '#00ff00'); await engineStroke(page, true, '#f0f000');
      const blob = await engineBlob(page, 'png'); await fs.writeFile(path.join(out, 'layer-mask.png'), blob);
      const erased = pngFacts(blob); assert.equal(erased.center[3], 0); assert.equal(erased.corner[3], 255);
      await engineStroke(page, false, '#ff0000');
      const above = pngFacts(await engineBlob(page, 'png')); assert.deepEqual(above.center, [255, 0, 0, 255]);
      const layers = await page.evaluate(() => window.engine.getLayers());
      assert.ok(layers.some(layer => layer.label === 'Eraser stroke'));
      facts.push({ name: 'layer semantics', erased, above, layers });
    } finally { await context.close(); }
  });
  await test('mask undo/redo/delete and template round trip preserve real PNG alpha', async () => {
    const { context, page } = await setup('en', 'light-coral', false, true);
    try {
      await engineSource(page); await engineStroke(page);
      assert.equal(pngFacts(await engineBlob(page, 'png')).center[3], 0);
      await page.evaluate(() => window.engine.undo()); assert.equal(pngFacts(await engineBlob(page, 'png')).center[3], 255);
      await page.evaluate(() => window.engine.redo()); assert.equal(pngFacts(await engineBlob(page, 'png')).center[3], 0);
      const template = await page.evaluate(() => window.engine.exportTemplate());
      assert.match(template, /destination-out/); assert.match(template, /eraser/);
      await page.evaluate(template => window.engine.loadScene(template), template);
      const roundtrip = await engineBlob(page, 'png'); await fs.writeFile(path.join(out, 'mask-roundtrip.png'), roundtrip);
      assert.equal(pngFacts(roundtrip).center[3], 0);
      await page.evaluate(() => { const e = window.engine; const layer = e.getLayers().find(layer => layer.label === 'Eraser stroke'); e.deleteLayer(layer.id); });
      assert.equal(pngFacts(await engineBlob(page, 'png')).center[3], 255);
      facts.push({ name: 'undo redo template delete', passed: true });
    } finally { await context.close(); }
  });
  await test('PNG/WebP preserve erased alpha; JPEG fills white and SVG matches composited result', async () => {
    const { context, page } = await setup('en', 'light-coral', false, true);
    try {
      await engineSource(page); await engineStroke(page);
      const formats = {};
      for (const format of ['png', 'webp', 'jpeg', 'svg']) {
        const blob = await engineBlob(page, format); await fs.writeFile(path.join(out, `mask-formats.${format}`), blob);
        const pixel = await page.evaluate(async ({ data, type }) => {
          const b = new Blob([new Uint8Array(data)], { type });
          const image = new Image(); const url = URL.createObjectURL(b);
          try { image.src = url; await image.decode(); const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
            const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0); return [...ctx.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data];
          } finally { URL.revokeObjectURL(url); }
        }, { data: [...blob], type: format === 'svg' ? 'image/svg+xml' : `image/${format}` });
        if (format === 'jpeg') { assert.equal(pixel[3], 255); assert.ok(pixel.slice(0, 3).every(channel => channel >= 250)); }
        else assert.equal(pixel[3], 0);
        formats[format] = pixel;
      }
      facts.push({ name: 'format alpha', formats });
    } finally { await context.close(); }
  });
} finally {
  await fs.writeFile(path.join(out, 'alpha-results.json'), JSON.stringify(facts, null, 2));
  await browser.close();
  await uiServer?.close();
}
