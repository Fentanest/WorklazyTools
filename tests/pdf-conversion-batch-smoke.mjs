import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import JSZip from 'jszip';

await test('batch keeps completed output after one PDF image fails and retries that file independently', async () => {
  const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:4188';
  const damaged = await fs.readFile('tests/fixtures/document-converters/review-badimage.pdf');
  const rich = await fs.readFile('tests/fixtures/document-converters/rich.pdf');
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
  try {
    await page.goto(base + '/en/tools/pdf-converter/pdf-to-document/');
    const outcome = await page.evaluate(async ({ damaged, rich }) => {
      const { BatchQueue } = await import('/src/features/conversion-batch/batchQueue.ts');
      const { batchProcessor, defaultBatchOptions } = await import('/src/features/conversion-batch/batchProcessors.ts');
      const queue = new BatchQueue(() => undefined);
      const badFile = new File([new Uint8Array(damaged)], 'review-badimage.pdf', { type: 'application/pdf' });
      queue.add([
        badFile,
        new File([new Uint8Array(rich)], 'rich.pdf', { type: 'application/pdf' }),
      ]);
      const processor = batchProcessor('pdf-document', { ...defaultBatchOptions, format: 'docx', ocrMode: 'off' }, 'en');
      let directFailure;
      try { await processor(badFile, new AbortController().signal, () => {}); }
      catch (error) { directFailure = { name: error.name, code: error.code, message: error.message }; }
      await queue.run(processor);
      const first = queue.items.map(item => ({ status: item.status, error: item.error, outputName: item.output?.fileName }));
      const result = queue.items[1].output;
      if (!result) throw new Error('successful file result missing');
      const bytes = Array.from(new Uint8Array(await result.blob.arrayBuffer()));
      queue.retry(queue.items[0].id);
      await queue.run(processor);
      const second = queue.items.map(item => ({ status: item.status, error: item.error, outputName: item.output?.fileName }));
      queue.dispose();
      return { first, second, directFailure, bytes };
    }, { damaged: [...damaged], rich: [...rich] });
    console.log(JSON.stringify({first:outcome.first,second:outcome.second,directFailure:outcome.directFailure}));
    assert.deepEqual(outcome.first.map(item => item.status), ['failed', 'success']);
    assert.equal(outcome.first[0].error, 'image-decode');
    assert.deepEqual(outcome.second.map(item => item.status), ['failed', 'success']);
    assert.equal(outcome.second[0].error, 'image-decode');
    assert.equal(outcome.second[1].outputName, outcome.first[1].outputName);
    const zip = await JSZip.loadAsync(Buffer.from(outcome.bytes));
    const xml = await zip.file('word/document.xml').async('string');
    assert.match(xml, /FIRST PAGE/);
    assert.match(xml, /SECOND PAGE/);
    assert.ok(Object.keys(zip.files).some(name => name.startsWith('word/media/')));
    assert.deepEqual(external, []);
  } finally { await browser.close(); }
});
