import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { mkdtemp, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
import { PNG } from 'pngjs';

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:4187';
let browser, page, output, sourcePdf;
const external = [];
const errors = [];
function png(width, height, color) {
  const image = new PNG({ width, height });
  for (let i = 0; i < image.data.length; i += 4) image.data.set([...color, 255], i);
  return PNG.sync.write(image);
}
async function resultBytes() {
  const link = page.getByTestId('pdf-download');
  await link.waitFor({ state: 'visible' });
  return Buffer.from(await link.evaluate(async element => Array.from(new Uint8Array(await (await fetch(element.href)).arrayBuffer()))));
}
before(async () => {
  output = await mkdtemp(path.join(os.tmpdir(), 'worklazy-pdf-converter-'));
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  page.setDefaultTimeout(30000);
  page.on('pageerror', error => errors.push(error.message));
  await page.route('**/*', route => {
    const url = new URL(route.request().url());
    if (!['127.0.0.1', 'localhost'].includes(url.hostname) && ['http:', 'https:'].includes(url.protocol)) {
      external.push(url.origin); return route.abort();
    }
    return route.continue();
  });
});
after(async () => { await browser?.close(); console.log(`Evidence: ${output}`); });

test('new and old conversion URLs resolve in both languages; remaining PDF editor tabs stay present', async () => {
  for (const language of ['ko', 'en']) {
    for (const mode of ['image-to-pdf', 'pdf-to-image']) {
      await page.goto(`${base}/${language}/tools/pdf-editor/${mode}`);
      await page.waitForURL(url => url.pathname.replace(/\/$/, '') === `/${language}/tools/pdf-converter/${mode}`);
      await page.locator(`[data-tool-page="pdf-converter"] [data-pdf-mode="${mode}"]`).waitFor();
      assert.equal(await page.locator('nav.pdf-tool-navigation a').count(), 4);
      assert.equal(await page.locator('[data-route-error]').count(), 0);
    }
  }
  for (const language of ['ko','en']) {
    for (const [old, target] of [['convert','pdf-to-document'],['ocr','pdf-to-document/ocr']]) {
      await page.goto(`${base}/${language}/tools/pdf-editor/${old}`);
      await page.waitForURL(url => url.pathname.replace(/\/$/,'') === `/${language}/tools/pdf-converter/${target}`);
      await page.locator('[data-pdf-mode="pdf-to-document"]').waitFor();
      assert.equal(await page.locator('nav.pdf-tool-navigation a').count(),4);
      if (old === 'ocr') assert.equal(await page.getByRole('radio', {name:/^(검색 PDF|Searchable PDF)/}).getAttribute('aria-checked'), 'true');
    }
  }
  await page.goto(`${base}/en/tools/pdf-editor/`);
  await page.locator('[data-pdf-mode="organize"]').waitFor();
  assert.equal(await page.locator('nav.pdf-tool-navigation a').count(), 2);
});

test('image to PDF preserves filename, page order, A4 sizing and original image dimensions', async () => {
  await page.goto(`${base}/en/tools/pdf-converter/`);
  await page.locator('input[type=file]').setInputFiles([
    { name: 'landscape.png', mimeType: 'image/png', buffer: png(160, 80, [220, 40, 30]) },
    { name: 'portrait.png', mimeType: 'image/png', buffer: png(80, 160, [30, 180, 70]) },
  ]);
  const outputCard = page.getByTestId('pdf-output-card');
  await page.waitForFunction(() => [...document.querySelectorAll('.pdf-image-preview img')].length === 2 && [...document.querySelectorAll('.pdf-image-preview img')].every(image => image.naturalWidth > 0));
  await outputCard.locator('input').fill('synthetic-converter');
  await outputCard.getByRole('button', { name: 'Create PDF', exact: true }).click();
  const a4 = await PDFDocument.load(await resultBytes());
  assert.equal(a4.getPageCount(), 2);
  assert.ok(a4.getPages().every(p => Math.abs(Math.min(p.getWidth(),p.getHeight()) - 595.28) < 1));
  assert.equal(await page.getByTestId('pdf-download').getAttribute('download'), 'synthetic-converter.pdf');
  await outputCard.getByRole('button', { name: 'Image size', exact: true }).click();
  await outputCard.getByRole('button', { name: 'Create PDF', exact: true }).click();
  sourcePdf = await resultBytes();
  const originalSize = await PDFDocument.load(sourcePdf);
  assert.equal(originalSize.getPageCount(), 2);
  assert.ok(originalSize.getPages()[0].getWidth() > originalSize.getPages()[0].getHeight());
  assert.ok(originalSize.getPages()[1].getHeight() > originalSize.getPages()[1].getWidth());
  await writeFile(path.join(output,'images.pdf'), sourcePdf);
  await page.screenshot({ path: path.join(output,'desktop-en.png'), fullPage: true });
  await page.locator('.pdf-image-remove').first().click();
  assert.equal(await page.getByTestId('pdf-download').count(), 0);
});

test('PDF to PNG keeps selected page order, deduplicates pages and emits correctly named image files', async () => {
  assert.ok(sourcePdf);
  await page.goto(`${base}/en/tools/pdf-converter/pdf-to-image/`);
  await page.locator('input[type=file]').setInputFiles({ name: 'synthetic.pdf', mimeType: 'application/pdf', buffer: sourcePdf });
  const outputCard = page.getByTestId('pdf-output-card');
  await page.waitForFunction(() => [...document.querySelectorAll('[data-testid="pdf-output-card"] button')].some(button => button.textContent.trim() === 'Create image ZIP' && !button.disabled));
  await outputCard.locator('select').selectOption('96');
  await outputCard.locator('input').fill('2,1,2');
  await outputCard.getByRole('button', { name: 'Create image ZIP', exact: true }).click();
  const zip = await JSZip.loadAsync(await resultBytes());
  const names = Object.keys(zip.files);
  assert.deepEqual(names, ['synthetic-002.png','synthetic-001.png']);
  const portrait = PNG.sync.read(await zip.file(names[0]).async('nodebuffer'));
  const landscape = PNG.sync.read(await zip.file(names[1]).async('nodebuffer'));
  assert.ok(portrait.height > portrait.width);
  assert.ok(landscape.width > landscape.height);
  assert.equal(await page.getByTestId('pdf-download').getAttribute('download'), 'synthetic-png.zip');
});

test('PDF to JPG emits JPEG bytes and invalid page selection reports an error without a result', async () => {
  const outputCard = page.getByTestId('pdf-output-card');
  await outputCard.getByRole('button', { name: 'JPG', exact: true }).click();
  await outputCard.locator('input').fill('1');
  await outputCard.getByRole('button', { name: 'Create image ZIP', exact: true }).click();
  const zip = await JSZip.loadAsync(await resultBytes());
  assert.deepEqual(Object.keys(zip.files), ['synthetic-001.jpg']);
  const bytes = await zip.file('synthetic-001.jpg').async('uint8array');
  assert.deepEqual(Array.from(bytes.slice(0,3)), [255,216,255]);
  await outputCard.locator('input').fill('999');
  await outputCard.getByRole('button', { name: 'Create image ZIP', exact: true }).click();
  await page.getByRole('alert').first().waitFor();
  assert.equal(await page.getByTestId('pdf-download').count(), 0);
});

test('mobile Korean converter stays within the viewport and processing makes no external request', async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/ko/tools/pdf-converter/`);
  await page.locator('[data-tool-page="pdf-converter"]').waitFor();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await page.screenshot({ path: path.join(output,'mobile-ko.png'), fullPage: true });
  assert.deepEqual(errors, []);
  assert.deepEqual(external, []);
});
