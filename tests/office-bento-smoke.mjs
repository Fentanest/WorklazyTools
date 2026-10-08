// Synthetic inputs; run against a local Vite server with pinned static assets.
import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:4271';
const outputDir = path.resolve(process.env.EVIDENCE_DIR || '/tmp/worklazy-office-bento-smoke');
await fs.mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--disable-dev-shm-usage'], chromiumSandbox: true });
const context = await browser.newContext({ serviceWorkers: 'block' });
const external = [];
await context.route('**/*', route => {
  const url = new URL(route.request().url());
  if (url.origin === new URL(base).origin || ['blob:', 'data:'].includes(url.protocol)) return route.continue();
  external.push(url.href); return route.abort();
});
const page = await context.newPage();
await page.routeWebSocket('**', socket => socket.close());
const workers = [];
const closed = new Set();
page.on('worker', worker => {
  if (!worker.url().includes('browser.worker.global.js')) return;
  workers.push(worker);
  worker.on('close', () => closed.add(worker));
});
await page.exposeFunction('__officeWorkerStarts', () => workers.length);
const liveWorkers = () => workers.filter(worker => !closed.has(worker));
const results = [];
try {
  await page.goto(base + '/en/tools/pdf-converter/document-to-pdf/');
  await page.waitForFunction(() => crossOriginIsolated);
  await page.waitForTimeout(500);
  const fileNames = ['sample.doc', 'sample.docx', 'sample.xls', 'sample.xlsx', 'sample.ppt', 'sample.pptx',
    'rich.xlsx', 'rich.docx', 'rich.xlsx', 'rich.docx', 'sample.pptx', 'sample.xlsx'];
  for (const [index, fileName] of fileNames.entries()) {
    const input = await fs.readFile(path.join('tests/fixtures/document-converters', fileName));
    const result = await page.evaluate(async ({ input, fileName }) => {
      const { convertOfficePdf } = await import('/src/features/pdf-converter/officePdfClient.ts');
      const controller = new AbortController();
      const progress = [];
      const started = performance.now();
      const timeout = setTimeout(() => controller.abort(), 90000);
      try {
        const output = await convertOfficePdf(new File([new Uint8Array(input)], fileName), controller.signal, value => progress.push(value));
        return { ms: performance.now() - started, bytes: Array.from(output.bytes), progress };
      } finally { clearTimeout(timeout); }
    }, { input: [...input], fileName });
    const pdfPath = path.join(outputDir, `${index}-${fileName}.pdf`);
    await fs.writeFile(pdfPath, Buffer.from(result.bytes));
    const info = execFileSync('pdfinfo', [pdfPath], { encoding: 'utf8' });
    const pages = Number(info.match(/^Pages:\s*(\d+)/m)?.[1]);
    const text = execFileSync('pdftotext', ['-layout', pdfPath, '-'], { encoding: 'utf8' });
    assert.ok(pages > 0, `${fileName}: zero pages`);
    assert.ok(text.trim().length > 0, `${fileName}: no text`);
    if (fileName === 'rich.xlsx') {
      assert.ok(pages >= 2, 'Calc print area or sheet output was lost');
      assert.match(text, /FIRST SHEET/); assert.match(text, /SECOND SHEET/);
      assert.match(execFileSync('pdfimages', ['-list', pdfPath], { encoding: 'utf8' }), /\bimage\b/);
      assert.match(execFileSync('pdffonts', [pdfPath], { encoding: 'utf8' }), /NanumGothic/, 'Korean glyph font was not embedded');
    }
    if (fileName === 'rich.docx') {
      assert.ok(pages >= 2, 'Writer page break was lost');
      assert.match(text, /FIRST PAGE/); assert.match(text, /SECOND PAGE/);
      assert.match(execFileSync('pdfimages', ['-list', pdfPath], { encoding: 'utf8' }), /\bimage\b/);
      assert.match(execFileSync('pdffonts', [pdfPath], { encoding: 'utf8' }), /NanumGothic/, 'Korean glyph font was not embedded');
    }
    assert.equal(workers.length, 1, `${fileName}: LibreOffice initialized more than once`);
    assert.equal(liveWorkers()[0], workers[0], `${fileName}: LibreOffice worker changed`);
    results.push({ fileName, ms: result.ms, progress: result.progress, pages, text: text.trim().slice(0, 100), bytes: result.bytes.length });
    console.log(JSON.stringify(results.at(-1)));
  }
  const queueInput = await fs.readFile('tests/fixtures/document-converters/rich.xlsx');
  const nextInput = await fs.readFile('tests/fixtures/document-converters/sample.docx');
  const queuedCancel = await page.evaluate(async ({ input, nextInput }) => {
    const { convertOfficePdf } = await import('/src/features/pdf-converter/officePdfClient.ts');
    const queuedController = new AbortController();
    let queued;
    const active = await convertOfficePdf(new File([new Uint8Array(input)], 'active.xlsx'), new AbortController().signal, value => {
      if (value === 91 && !queued) {
        queued = convertOfficePdf(new File([new Uint8Array(nextInput)], 'queued.docx'), queuedController.signal, () => {}).then(() => 'unexpected-success', error => error.name);
        queuedController.abort();
      }
    });
    return { activePdf: new TextDecoder().decode(active.bytes.subarray(0, 5)) === '%PDF-', queuedError: await queued };
  }, { input: [...queueInput], nextInput: [...nextInput] });
  assert.deepEqual(queuedCancel, { activePdf: true, queuedError: 'AbortError' });
  assert.equal(workers.length, 1);
  assert.equal(liveWorkers()[0], workers[0]);
  const cancelInput = await fs.readFile('tests/fixtures/document-converters/sample.pptx');
  const lifecycle = await page.evaluate(async ({ input, nextInput }) => {
    const { convertOfficePdf, releaseOfficePdfSession } = await import('/src/features/pdf-converter/officePdfClient.ts');
    const controller = new AbortController();
    let conversionError;
    try {
      await convertOfficePdf(new File([new Uint8Array(input)], 'cancel.pptx'), controller.signal,
        value => { if (value >= 93) controller.abort(); });
    } catch (error) { conversionError = error.name; }
    const resumed = await convertOfficePdf(new File([new Uint8Array(nextInput)], 'after-cancel.docx'), new AbortController().signal, () => {});
    releaseOfficePdfSession();
    const beforeLoadingWorkers = await window.__officeWorkerStarts();
    const loadingController = new AbortController();
    let loadingError;
    try {
      await convertOfficePdf(new File([new Uint8Array(nextInput)], 'cancel-loading.docx'), loadingController.signal,
        value => { if (value >= 60) loadingController.abort(); });
    } catch (error) { loadingError = error.name; }
    const afterLoadingWorkers = await window.__officeWorkerStarts();
    const afterLoading = await convertOfficePdf(new File([new Uint8Array(nextInput)], 'after-loading.docx'), new AbortController().signal, () => {});
    releaseOfficePdfSession();
    return { conversionError, resumedPdf: new TextDecoder().decode(resumed.bytes.subarray(0, 5)) === '%PDF-',
      loadingError, beforeLoadingWorkers, afterLoadingWorkers,
      afterLoadingPdf: new TextDecoder().decode(afterLoading.bytes.subarray(0, 5)) === '%PDF-' };
  }, { input: [...cancelInput], nextInput: [...nextInput] });
  assert.equal(lifecycle.conversionError, 'AbortError');
  assert.equal(lifecycle.resumedPdf, true);
  assert.equal(lifecycle.loadingError, 'AbortError');
  assert.equal(lifecycle.afterLoadingPdf, true);
  assert.equal(lifecycle.beforeLoadingWorkers, lifecycle.afterLoadingWorkers, 'loading cancellation started a Worker');
  for (let retry = 0; retry < 20 && liveWorkers().length; retry++) await page.waitForTimeout(100);
  assert.equal(liveWorkers().length, 0, 'Office worker survived explicit release');
  await page.route('**/vendor/libreoffice-converter/2.3.1/soffice.wasm.gz', route => route.fulfill({ status: 503, body: 'unavailable' }));
  const initFailure = await page.evaluate(async input => {
    const { convertOfficePdf } = await import('/src/features/pdf-converter/officePdfClient.ts');
    try { await convertOfficePdf(new File([new Uint8Array(input)], 'init-fail.docx'), new AbortController().signal, () => {}); }
    catch (error) { return error.message; }
    return 'unexpected-success';
  }, [...nextInput]);
  assert.equal(initFailure, 'asset-download-failed');
  await page.unroute('**/vendor/libreoffice-converter/2.3.1/soffice.wasm.gz');
  const afterFailure = await page.evaluate(async input => {
    const { convertOfficePdf, releaseOfficePdfSession } = await import('/src/features/pdf-converter/officePdfClient.ts');
    const output = await convertOfficePdf(new File([new Uint8Array(input)], 'after-init-fail.docx'), new AbortController().signal, () => {});
    releaseOfficePdfSession();
    return new TextDecoder().decode(output.bytes.subarray(0, 5)) === '%PDF-';
  }, [...nextInput]);
  assert.equal(afterFailure, true);
  const damagedFile = await page.evaluate(async input => {
    const { convertOfficePdf, releaseOfficePdfSession } = await import('/src/features/pdf-converter/officePdfClient.ts');
    let code;
    try { await convertOfficePdf(new File([new Uint8Array([1, 2, 3])], 'damaged.docx'), new AbortController().signal, () => {}); }
    catch (error) { code = error.message; }
    const next = await convertOfficePdf(new File([new Uint8Array(input)], 'after-damaged.docx'), new AbortController().signal, () => {});
    releaseOfficePdfSession();
    return { code, nextValid: new TextDecoder().decode(next.bytes.subarray(0, 5)) === '%PDF-' };
  }, [...nextInput]);
  assert.deepEqual(damagedFile, { code: 'invalid-office-file', nextValid: true });
  for (let retry = 0; retry < 20 && liveWorkers().length; retry++) await page.waitForTimeout(100);
  assert.equal(liveWorkers().length, 0);
  assert.deepEqual(external, []);
  await fs.writeFile(path.join(outputDir, 'result.json'), JSON.stringify({ results, workerStarts: workers.length,
    workerCloses: closed.size, queuedCancel, lifecycle, initFailure, afterFailure, damagedFile, external }, null, 2));
} finally { await browser.close(); }
