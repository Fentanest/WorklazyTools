import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { test } from 'node:test';
import { chromium } from 'playwright';

await test('Bento PDF Worker reports cold engine initialization separately from warm page profiling', async () => {
  const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:4272';
  const evidence = process.env.EVIDENCE_DIR || await fs.mkdtemp('/tmp/worklazy-bento-startup-');
  await fs.mkdir(evidence, { recursive: true });
  const input = await fs.readFile('tests/fixtures/document-converters/rich.pdf');
  const inputSha256 = createHash('sha256').update(input).digest('hex');
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--disable-dev-shm-usage'], chromiumSandbox: true });
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const external = [], errors = [], started = [], closed = new Set();
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(base).origin || ['blob:', 'data:'].includes(url.protocol)) return route.continue();
    external.push(url.href); return route.abort();
  });
  const page = await context.newPage();
  await page.routeWebSocket('**', socket => socket.close());
  page.on('pageerror', error => errors.push(error.message));
  page.on('worker', worker => {
    if (!worker.url().includes('bentoPdf.worker.ts')) return;
    started.push(worker); worker.on('close', () => closed.add(worker));
  });
  try {
    await page.goto(base + '/en/tools/pdf-converter/pdf-to-document/');
    const result = await page.evaluate(async bytes => {
      const workerCreatedAt = performance.now();
      const worker = new Worker('/src/features/pdf-editor/bentoPdf.worker.ts?worker_file&type=module', { type: 'module' });
      const pdf = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
      const profile = id => new Promise((resolve, reject) => {
        const postedAt = performance.now();
        const progress = [];
        const timeout = setTimeout(() => { cleanup(); reject(new Error('Bento startup probe timeout')); }, 120_000);
        const message = event => {
          if (event.data?.id !== id) return;
          if (event.data.type === 'progress') { progress.push({ value: event.data.value, ms: performance.now() - postedAt }); return; }
          cleanup();
          if (event.data.type === 'error') reject(new Error(event.data.code));
          else resolve({ ms: performance.now() - postedAt, progress, pages: event.data.profiles?.length ?? 0,
            width: event.data.profiles?.[0]?.width, height: event.data.profiles?.[0]?.height });
        };
        const failure = event => { cleanup(); reject(new Error(event.message || 'Bento worker failed')); };
        const cleanup = () => { clearTimeout(timeout); worker.removeEventListener('message', message); worker.removeEventListener('error', failure); };
        worker.addEventListener('message', message); worker.addEventListener('error', failure);
        worker.postMessage({ id, type: 'profile-pages', pdf, pages: [0] });
      });
      try {
        const cold = await profile(1);
        const warm = await profile(2);
        return { workerCreationToFirstProgressMs: cold.progress.find(item => item.value === 5)?.ms,
          cold, warm, totalMs: performance.now() - workerCreatedAt };
      } finally { worker.terminate(); }
    }, [...input]);
    const point = (sample, value) => sample.progress.find(item => item.value === value)?.ms;
    assert.ok(point(result.cold, 5) !== undefined && point(result.cold, 28) !== undefined);
    assert.ok(point(result.warm, 5) !== undefined && point(result.warm, 28) !== undefined);
    assert.ok(result.cold.pages === 1 && result.warm.pages === 1);
    assert.ok(point(result.cold, 28) >= point(result.cold, 5));
    assert.ok(point(result.warm, 28) >= point(result.warm, 5));
    for (let attempt = 0; attempt < 50 && closed.size !== started.length; attempt++) await page.waitForTimeout(100);
    assert.equal(started.length, 1);
    assert.equal(closed.size, 1);
    assert.deepEqual(external, []);
    assert.deepEqual(errors, []);
    const receipt = { base, input: 'rich.pdf', inputSha256, result, workersStarted: started.length,
      workersClosed: closed.size, external, errors };
    await fs.writeFile(path.join(evidence, 'result.json'), JSON.stringify(receipt, null, 2));
    console.log(JSON.stringify(receipt));
  } finally { await browser.close(); }
});
