import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import { PNG } from 'pngjs';
import JSZip from 'jszip';
import { createServer } from 'vite';

const evidence = process.env.ZIP_EVIDENCE_DIR || '/tmp/sol-zip-evidence';
await fs.mkdir(evidence, { recursive: true });
const port = Number(process.env.ZIP_TEST_PORT || 4295);
const cacheDir = await fs.mkdtemp(path.join(process.cwd(), 'node_modules/.vite-zip-'));
const server = await createServer({ root: process.cwd(), envFile: false, cacheDir, optimizeDeps: { include: ['gifenc', 'pdf-lib'] }, server: { host: '127.0.0.1', port, strictPort: true } });
await server.listen();
const base = `http://127.0.0.1:${port}`;
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const context = await browser.newContext({ serviceWorkers: 'block' });
await context.route('**/*', route => {
  const url = new URL(route.request().url());
  return url.origin === new URL(base).origin || ['blob:', 'data:'].includes(url.protocol) ? route.continue() : route.abort();
});
const page = await context.newPage();
page.setDefaultTimeout(60000);
const errors = [];
page.on('pageerror', error => errors.push(error.message));
page.on('response', response => { if (response.status() >= 400) console.error('HTTP', response.status(), response.url()); });
const pdf = await PDFDocument.create(); pdf.addPage([90, 90]); pdf.addPage([90, 90]);
const pdfBytes = [...await pdf.save()];
const onePdf = await PDFDocument.create(); onePdf.addPage([90, 90]);
const oneBytes = [...await onePdf.save()];
const image = new PNG({ width: 4, height: 4 }); image.data.fill(255);
const png = [...PNG.sync.write(image)];
const unpack = async bytes => {
  const archive = await JSZip.loadAsync(Uint8Array.from(bytes));
  const names = Object.keys(archive.files).filter(name => !archive.files[name].dir);
  assert.ok(names.every(name => !/\.zip$/i.test(name)), `Nested ZIP: ${names}`);
  return { archive, names };
};
try {
  await page.goto(base + '/tests/zip-download-browser.html');
  await page.waitForFunction(() => Boolean(window.zipDownloadTest));
  await test('PDF raster: one page PNG/JPG direct, selected page direct, multiple pages one flat ZIP', async () => {
    const results = await page.evaluate(async ({ pdfBytes }) => {
      const { pdfToImageArchive, releasePdf } = window.zipDownloadTest;
      const file = new File([Uint8Array.from(pdfBytes)], '한글.pdf', { type: 'application/pdf' });
      const results = [];
      for (const format of ['png', 'jpeg']) for (const selected of [[0], [1], [0, 1]]) {
        const result = await pdfToImageArchive(file, format, 96, .9, undefined, 'en', selected);
        results.push({ name: result.fileName, type: result.blob.type, bytes: [...new Uint8Array(await result.blob.arrayBuffer())], count: selected.length });
      }
      await releasePdf(file); return results;
    }, { pdfBytes });
    for (const result of results) {
      if (result.count === 1) {
        assert.match(result.name, /\.(png|jpg)$/); assert.match(result.type, /^image\//);
        assert.ok(result.bytes[0] === 137 || result.bytes[0] === 255);
      } else { const { names } = await unpack(result.bytes); assert.equal(names.length, 2); assert.ok(names.every(name => /\.(png|jpg)$/.test(name))); }
    }
  });
  await test('image batch worker: one image direct; two same-named images in one ZIP', async () => {
    const results = await page.evaluate(async ({ png }) => {
      const { batchProcessImages } = window.zipDownloadTest;
      const file = new File([Uint8Array.from(png)], '한글.png', { type: 'image/png' });
      const options = { mode: 'original', width: 4, height: 4, format: 'png', quality: .9, background: 'transparent', watermarkText: '', watermarkPosition: 'bottom-right', watermarkOpacity: .7 };
      const results = [];
      for (const files of [[file], [file, file]]) {
        const result = await batchProcessImages(files, options, 'results.zip', undefined, undefined, 'en');
        results.push({ name: result.fileName, type: result.mimeType, bytes: [...new Uint8Array(result.buffer)], count: result.images.length });
      }
      return results;
    }, { png });
    assert.match(results[0].name, /\.png$/); assert.equal(results[0].type, 'image/png'); assert.equal(results[0].bytes[0], 137);
    const { names } = await unpack(results[1].bytes); assert.equal(names.length, 2); assert.equal(new Set(names).size, 2);
  });
  await test('video download packaging: singleton keeps MP4; multiple files one flat ZIP', async () => {
    const results = await page.evaluate(async () => {
      const { createVideoZip } = window.zipDownloadTest;
      const source = { fileName: '한글.mp4', blob: new Blob(['video fixture bytes'], { type: 'video/mp4' }) };
      const results = [];
      for (const files of [[source], [source, source]]) {
        const result = await createVideoZip(files, undefined, undefined, 'en');
        if (result.data.kind !== 'file') throw new Error('Expected memory file');
        results.push({ name: result.fileName, type: result.mimeType, bytes: [...new Uint8Array(await result.data.file.arrayBuffer())] });
      }
      return results;
    });
    assert.equal(results[0].name, '한글.mp4'); assert.equal(results[0].type, 'video/mp4');
    assert.equal(Buffer.from(results[0].bytes).toString(), 'video fixture bytes');
    const { names } = await unpack(results[1].bytes); assert.deepEqual(names, ['한글.mp4', '한글-2.mp4']);
  });
  await test('PDF split worker: one group PDF, two groups flat ZIP with collision-safe Korean names', async () => {
    const results = await page.evaluate(async ({ pdfBytes }) => {
      const { exportPdfGroups } = window.zipDownloadTest;
      const file = new File([Uint8Array.from(pdfBytes)], '입력.pdf', { type: 'application/pdf' });
      const pages = [0, 1].map(pageIndex => ({ sourceId: 'source', pageIndex, rotation: 0 }));
      const results = [];
      for (const groups of [[{ fileName: '한글.pdf', pages }], pages.map(page => ({ fileName: '한글.pdf', pages: [page] }))]) {
        const result = await exportPdfGroups([{ id: 'source', file }], groups, 'results', undefined, 'en');
        results.push({ name: result.fileName, type: result.mimeType, bytes: [...new Uint8Array(result.buffer)] });
      }
      return results;
    }, { pdfBytes });
    assert.equal(results[0].name, '한글.pdf'); assert.equal(results[0].type, 'application/pdf');
    assert.equal((await PDFDocument.load(Uint8Array.from(results[0].bytes))).getPageCount(), 2);
    const { names, archive } = await unpack(results[1].bytes); assert.deepEqual(names, ['한글.pdf', '한글-2.pdf']);
    for (const name of names) assert.equal((await PDFDocument.load(await archive.file(name).async('uint8array'))).getPageCount(), 1);
  });
  await test('batch UI download all: no nested ZIP for two PDFs, one successful result downloads directly', async () => {
    await page.goto(base + '/en/tools/pdf-editor/pdf-to-image/');
    await page.locator('input[type=file]').first().setInputFiles([
      { name: '동일.pdf', mimeType: 'application/pdf', buffer: Buffer.from(pdfBytes) },
      { name: '동일.pdf', mimeType: 'application/pdf', buffer: Buffer.from(pdfBytes) },
    ]);
    await page.getByRole('button', { name: 'Convert queued files', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('[data-testid=batch-row][data-state=success]').length === 2);
    await page.getByRole('button', { name: 'Prepare download all', exact: true }).click();
    const combined = page.getByTestId('batch-zip-download'); await combined.waitFor();
    const bytes = await combined.evaluate(async element => [...new Uint8Array(await (await fetch(element.href)).arrayBuffer())]);
    const { names } = await unpack(bytes); assert.equal(names.length, 4); assert.equal(new Set(names).size, 4); assert.ok(names.every(name => /\.png$/.test(name)));
    await page.screenshot({ path: path.join(evidence, 'batch-en-desktop.png'), fullPage: true });
    await page.reload();
    await page.locator('input[type=file]').first().setInputFiles([
      { name: '한 장.pdf', mimeType: 'application/pdf', buffer: Buffer.from(oneBytes) },
      { name: '실패.pdf', mimeType: 'application/pdf', buffer: Buffer.from('invalid pdf') },
    ]);
    await page.getByRole('button', { name: 'Convert queued files', exact: true }).click();
    await page.waitForFunction(() => document.querySelectorAll('[data-testid=batch-row][data-state=success]').length === 1 && document.querySelectorAll('[data-testid=batch-row][data-state=failed]').length === 1);
    await page.getByRole('button', { name: 'Prepare download all', exact: true }).click();
    await combined.waitFor(); assert.match(await combined.getAttribute('download'), /\.png$/);
    assert.equal(await combined.evaluate(async element => new Uint8Array(await (await fetch(element.href)).arrayBuffer())[0]), 137);
  });
  await test('single PDF image UI: Korean mobile dark PNG download and one selectable image', async () => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.emulateMedia({ colorScheme: 'dark' });
    await page.evaluate(() => localStorage.setItem('worklazy-theme', 'dark-coral'));
    await page.goto(base + '/ko/tools/pdf-editor/pdf-to-image/');
    await page.locator('input[type=file]').first().setInputFiles({ name: '한 장.pdf', mimeType: 'application/pdf', buffer: Buffer.from(oneBytes) });
    await page.getByRole('button', { name: '이미지 만들기', exact: true }).click();
    await page.getByTestId('pdf-download').waitFor();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark-coral');
    assert.match(await page.getByTestId('pdf-download').getAttribute('download'), /\.png$/);
    assert.equal(await page.locator('[data-testid=pdf-image-result-grid] input[type=checkbox]').count(), 1);
    assert.match(await page.getByTestId('pdf-images-send-to-studio').innerText(), /편집/);
    await page.screenshot({ path: path.join(evidence, 'single-ko-mobile.png'), fullPage: true });
  });
  assert.deepEqual(errors, []);
} finally { await browser.close(); await server.close(); await fs.rm(cacheDir, { recursive: true, force: true }); }
