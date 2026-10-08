import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';

await test('Bento Python and OCR cancellation stop their workers and allow the next file', async () => {
  const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:4188';
  const evidenceDir = process.env.EVIDENCE_DIR || await fs.mkdtemp('/tmp/worklazy-pdf-cancel-');
  await fs.mkdir(evidenceDir, { recursive: true });
  const rich = await fs.readFile('tests/fixtures/document-converters/rich.pdf');
  const large = await fs.readFile('tests/fixtures/document-conversion-engines/highres.png');
  const small = await fs.readFile('tests/fixtures/document-conversion-engines/oracle.png');
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--disable-dev-shm-usage'], chromiumSandbox: true });
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const external = [], pageErrors = [];
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(base).origin || ['blob:', 'data:'].includes(url.protocol)) return route.continue();
    external.push(url.href); return route.abort();
  });
  const page = await context.newPage();
  const createdWorkers = [], closedWorkers = [], workerIds = new Map();
  page.on('worker', worker => { const id = createdWorkers.length + 1; workerIds.set(worker, id); createdWorkers.push({ id, url: worker.url() }); worker.on('close', () => closedWorkers.push({ id, url: worker.url() })); });
  await page.routeWebSocket('**', socket => socket.close());
  page.on('pageerror', error => pageErrors.push(error.message));
  try {
    await page.goto(base + '/en/tools/pdf-converter/pdf-to-document/');
    const result = await page.evaluate(async ({ rich, large, small }) => {
      const { convertWithBentoPdf, releaseBentoPdfSession } = await import('/src/features/pdf-editor/bentoPdfClient.ts');
      const { recognizePdfPage, releasePdfOcrSession } = await import('/src/features/pdf-editor/pdfOcrClient.ts');
      const pdf = new File([new Uint8Array(rich)], 'rich.pdf', { type: 'application/pdf' });
      const bigImage = new Blob([new Uint8Array(large)], { type: 'image/png' });
      const smallImage = new Blob([new Uint8Array(small)], { type: 'image/png' });
      const outcome = {};
      const abortBentoAt = async (value, delay = 0) => {
        const controller = new AbortController();
        let phaseReached = false;
        try {
          await convertWithBentoPdf(pdf, 'docx', 'cancel', controller.signal, progress => {
            if (progress >= value && !phaseReached) { phaseReached = true; setTimeout(() => controller.abort(), delay); }
          });
          return { error: 'unexpected-success', phaseReached };
        } catch (error) { return { error: error.name, phaseReached }; }
      };
      releaseBentoPdfSession();
      outcome.bentoLoadingAbort = await abortBentoAt(5);
      outcome.bentoAfterLoadingValid = (await convertWithBentoPdf(pdf, 'docx', 'after-loading')).blob.size > 1000;
      outcome.bentoComputeAbort = await abortBentoAt(28, 120);
      outcome.bentoAfterComputeValid = (await convertWithBentoPdf(pdf, 'docx', 'after-compute')).blob.size > 1000;
      const originalTimer = globalThis.setTimeout;
      globalThis.setTimeout = ((callback, delay, ...args) => originalTimer(callback, delay === 10 * 60_000 ? 100 : delay, ...args));
      try {
        try { await convertWithBentoPdf(pdf, 'docx', 'timeout'); outcome.bentoTimeout = 'unexpected-success'; }
        catch (error) { outcome.bentoTimeout = error.message; }
      } finally { globalThis.setTimeout = originalTimer; }
      outcome.bentoAfterTimeoutValid = (await convertWithBentoPdf(pdf, 'docx', 'after-timeout')).blob.size > 1000;
      releaseBentoPdfSession();

      releasePdfOcrSession();
      const loading = new AbortController();
      const loadingJob = recognizePdfPage(bigImage, 'kor+eng', 'sparse', false, loading.signal);
      setTimeout(() => loading.abort(), 50);
      try { await loadingJob; outcome.ocrLoadingAbort = 'unexpected-success'; }
      catch (error) { outcome.ocrLoadingAbort = error.name; }
      outcome.ocrAfterLoadingText = (await recognizePdfPage(smallImage, 'kor+eng', 'sparse', false)).text;

      const compute = new AbortController();
      const fallback = setTimeout(() => compute.abort(), 15_000);
      let recognizedProgress = false;
      try {
        await recognizePdfPage(bigImage, 'kor+eng', 'sparse', false, compute.signal, (status, progress) => {
          if (status === 'recognizing text' && progress >= .05) { recognizedProgress = true; compute.abort(); }
        });
        outcome.ocrComputeAbort = 'unexpected-success';
      } catch (error) { outcome.ocrComputeAbort = error.name; }
      clearTimeout(fallback);
      outcome.ocrRecognizeProgress = recognizedProgress;
      outcome.ocrAfterComputeText = (await recognizePdfPage(smallImage, 'kor+eng', 'sparse', false)).text;
      globalThis.setTimeout = ((callback, delay, ...args) => originalTimer(callback, delay === 5 * 60_000 ? 100 : delay, ...args));
      try {
        try { await recognizePdfPage(bigImage, 'kor+eng', 'sparse', false); outcome.ocrTimeout = 'unexpected-success'; }
        catch (error) { outcome.ocrTimeout = error.message; }
      } finally { globalThis.setTimeout = originalTimer; }
      outcome.ocrAfterTimeoutText = (await recognizePdfPage(smallImage, 'kor+eng', 'sparse', false)).text;
      await releasePdfOcrSession();
      await new Promise(resolve => setTimeout(resolve, 3_500));
      return outcome;
    }, { rich: [...rich], large: [...large], small: [...small] });
    result.activeConversionWorkers = page.workers().filter(worker => /bentoPdf|pdfOcr\.worker|blob:/.test(worker.url())).map(worker => ({id:workerIds.get(worker),url:worker.url()}));
    result.createdConversionWorkers = createdWorkers.filter(item => /bentoPdf|pdfOcr\.worker|blob:/.test(item.url));
    result.closedConversionWorkers = closedWorkers.filter(item => /bentoPdf|pdfOcr\.worker|blob:/.test(item.url));
    if (result.activeConversionWorkers.length) {
      await page.evaluate(async () => (await import('/src/features/pdf-editor/pdfOcrClient.ts')).releasePdfOcrSession());
      await page.waitForTimeout(500);
      result.activeAfterSecondRelease = page.workers().filter(worker => /bentoPdf|pdfOcr\.worker|blob:/.test(worker.url())).map(worker => ({id:workerIds.get(worker),url:worker.url()}));
    }
    await fs.writeFile(`${evidenceDir}/result.json`, JSON.stringify({ result, external, pageErrors }, null, 2));
    console.log(JSON.stringify(result));
    assert.deepEqual(result.bentoLoadingAbort, { error: 'AbortError', phaseReached: true });
    assert.deepEqual(result.bentoComputeAbort, { error: 'AbortError', phaseReached: true });
    assert.equal(result.bentoAfterLoadingValid, true);
    assert.equal(result.bentoAfterComputeValid, true);
    assert.equal(result.bentoTimeout, 'CONVERSION_TIMEOUT');
    assert.equal(result.bentoAfterTimeoutValid, true);
    assert.equal(result.ocrLoadingAbort, 'AbortError');
    assert.equal(result.ocrComputeAbort, 'AbortError');
    assert.equal(result.ocrRecognizeProgress, true);
    assert.equal(result.ocrTimeout, 'OCR_TIMEOUT');
    assert.match(result.ocrAfterLoadingText, /SCAN BODY/);
    assert.match(result.ocrAfterComputeText, /SCAN BODY/);
    assert.match(result.ocrAfterTimeoutText, /SCAN BODY/);
    assert.deepEqual(result.activeConversionWorkers, []);
    assert.deepEqual(external, []);
    assert.deepEqual(pageErrors, []);
    console.log('Evidence:', evidenceDir);
  } finally { await browser.close(); }
});
