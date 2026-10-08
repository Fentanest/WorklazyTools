// Run against `vite --host 127.0.0.1 --port 4271 --strictPort`.
// Synthetic inputs only; the browser blocks all external network requests.
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
const results = [];
try {
  await page.goto(base + '/en/tools/pdf-converter/document-to-pdf/');
  await page.waitForFunction(() => crossOriginIsolated);
  await page.waitForTimeout(500);
  for (const fileName of ['sample.doc', 'sample.docx', 'sample.xls', 'sample.xlsx', 'sample.ppt', 'sample.pptx', 'rich.xlsx', 'rich.docx']) {
    const input = await fs.readFile(path.join('tests/fixtures/document-converters', fileName));
    const result = await page.evaluate(async ({ input, fileName }) => {
      const { convertOfficePdf } = await import('/src/features/pdf-converter/officePdfClient.ts');
      const file = new File([new Uint8Array(input)], fileName);
      const controller = new AbortController();
      const progress = [];
      const started = performance.now();
      const timeout = setTimeout(() => controller.abort(), 60000);
      try {
        const output = await convertOfficePdf(file, controller.signal, value => progress.push(value));
        return { ms: performance.now() - started, bytes: Array.from(output.bytes), progress, frames: document.querySelectorAll('iframe[data-office-pdf-engine]').length };
      } finally { clearTimeout(timeout); }
    }, { input: [...input], fileName });
    const pdfPath = path.join(outputDir, fileName + '.pdf');
    await fs.writeFile(pdfPath, Buffer.from(result.bytes));
    const info = execFileSync('pdfinfo', [pdfPath], { encoding: 'utf8' });
    const pages = Number(info.match(/^Pages:\s*(\d+)/m)?.[1]);
    const text = execFileSync('pdftotext', ['-layout', pdfPath, '-'], { encoding: 'utf8' });
    assert.ok(pages > 0, `${fileName}: zero pages`);
    assert.ok(text.trim().length > 0, `${fileName}: no text`);
    if (fileName === 'rich.xlsx') {
      assert.ok(pages >= 2, 'Calc print area or sheet output was lost');
      assert.match(text, /FIRST SHEET/);
      assert.match(text, /SECOND SHEET/);
      assert.match(execFileSync('pdfimages', ['-list', pdfPath], { encoding: 'utf8' }), /\bimage\b/);
    }
    if (fileName === 'rich.docx') {
      assert.ok(pages >= 2, 'Writer page break was lost');
      assert.match(text, /FIRST PAGE/);
      assert.match(text, /SECOND PAGE/);
      assert.match(execFileSync('pdfimages', ['-list', pdfPath], { encoding: 'utf8' }), /\bimage\b/);
    }
    assert.equal(result.frames, 1, `${fileName}: engine was not reused`);
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
    const queuedError = await queued;
    return { activePdf: new TextDecoder().decode(active.bytes.subarray(0, 5)) === '%PDF-', queuedError, frames: document.querySelectorAll('iframe[data-office-pdf-engine]').length };
  }, { input: [...queueInput], nextInput: [...nextInput] });
  assert.deepEqual(queuedCancel, { activePdf: true, queuedError: 'AbortError', frames: 1 });
  const cancelInput = await fs.readFile('tests/fixtures/document-converters/sample.pptx');
  const lifecycle = await page.evaluate(async ({ input, nextInput }) => {
    const { convertOfficePdf, releaseOfficePdfSession } = await import('/src/features/pdf-converter/officePdfClient.ts');
    const file = new File([new Uint8Array(input)], 'cancel.pptx');
    const controller = new AbortController();
    const pending = convertOfficePdf(file, controller.signal, value => { if (value >= 93) controller.abort(); });
    let error;
    try { await pending; } catch (caught) { error = caught.name; }
    const resumed = await convertOfficePdf(new File([new Uint8Array(nextInput)], 'after-cancel.docx'), new AbortController().signal, () => {});
    const resumedPdf = resumed.bytes.length > 5 && new TextDecoder().decode(resumed.bytes.subarray(0, 5)) === '%PDF-';
    releaseOfficePdfSession();
    const loadingController = new AbortController();
    let loadingError;
    try {
      await convertOfficePdf(new File([new Uint8Array(nextInput)], 'cancel-loading.docx'), loadingController.signal,
        value => { if (value >= 60) loadingController.abort(); });
    } catch (caught) { loadingError = caught.name; }
    const afterLoading = await convertOfficePdf(new File([new Uint8Array(nextInput)], 'after-loading.docx'), new AbortController().signal, () => {});
    const afterLoadingPdf = new TextDecoder().decode(afterLoading.bytes.subarray(0, 5)) === '%PDF-';
    releaseOfficePdfSession();
    return { error, resumedPdf, loadingError, afterLoadingPdf, frames: document.querySelectorAll('iframe[data-office-pdf-engine]').length };
  }, { input: [...cancelInput], nextInput: [...nextInput] });
  assert.equal(lifecycle.error, 'AbortError');
  assert.equal(lifecycle.resumedPdf, true);
  assert.equal(lifecycle.loadingError, 'AbortError');
  assert.equal(lifecycle.afterLoadingPdf, true);
  assert.equal(lifecycle.frames, 0);
  await page.route('**/vendor/libreoffice-converter/2.6.0/warmup.docx', route => route.abort('failed'));
  const initFailure = await page.evaluate(async input => {
    const { convertOfficePdf } = await import('/src/features/pdf-converter/officePdfClient.ts');
    try { await convertOfficePdf(new File([new Uint8Array(input)], 'init-fail.docx'), new AbortController().signal, () => {}); }
    catch (error) { return { code: error.message, frames: document.querySelectorAll('iframe[data-office-pdf-engine]').length }; }
    return { code: 'unexpected-success', frames: -1 };
  }, [...nextInput]);
  assert.equal(initFailure.code, 'office-init-failed');
  assert.equal(initFailure.frames, 0);
  await page.unroute('**/vendor/libreoffice-converter/2.6.0/warmup.docx');
  const afterFailure = await page.evaluate(async input => {
    const { convertOfficePdf, releaseOfficePdfSession } = await import('/src/features/pdf-converter/officePdfClient.ts');
    const output = await convertOfficePdf(new File([new Uint8Array(input)], 'after-init-fail.docx'), new AbortController().signal, () => {});
    releaseOfficePdfSession();
    return { valid: new TextDecoder().decode(output.bytes.subarray(0, 5)) === '%PDF-', frames: document.querySelectorAll('iframe[data-office-pdf-engine]').length };
  }, [...nextInput]);
  assert.deepEqual(afterFailure, { valid: true, frames: 0 });
  const damagedFile = await page.evaluate(async input => {
    const { convertOfficePdf, releaseOfficePdfSession } = await import('/src/features/pdf-converter/officePdfClient.ts');
    let code;
    try { await convertOfficePdf(new File([new Uint8Array([1, 2, 3])], 'damaged.docx'), new AbortController().signal, () => {}); }
    catch (error) { code = error.message; }
    const next = await convertOfficePdf(new File([new Uint8Array(input)], 'after-damaged.docx'), new AbortController().signal, () => {});
    releaseOfficePdfSession();
    return { code, nextValid: new TextDecoder().decode(next.bytes.subarray(0, 5)) === '%PDF-', frames: document.querySelectorAll('iframe[data-office-pdf-engine]').length };
  }, [...nextInput]);
  assert.deepEqual(damagedFile, { code: 'invalid-office-file', nextValid: true, frames: 0 });
  assert.deepEqual(external, []);
  await fs.writeFile(path.join(outputDir, 'result.json'), JSON.stringify({ results, queuedCancel, lifecycle, initFailure, afterFailure, damagedFile, external }, null, 2));
} finally { await browser.close(); }
