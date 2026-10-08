// Browser stress for the pinned Bento LibreOffice worker. Run against local Vite.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:4271';
const outputDir = path.resolve(process.env.EVIDENCE_DIR || '/tmp/worklazy-office-batch-stress');
await fs.mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--disable-dev-shm-usage'], chromiumSandbox: true });
const baseFiles = ['rich.xlsx', 'rich.docx', 'sample.pptx', 'sample.doc', 'sample.xls', 'sample.xlsx',
  'sample.docx', 'sample.ppt', 'rich.xlsx', 'rich.docx', 'sample.pptx', 'sample.xlsx'];
const firstFormats = ['rich.xlsx', 'rich.docx', 'sample.pptx'];
const selectedSessions = process.env.OFFICE_STRESS_SESSION === undefined
  ? [0, 1, 2] : [Number(process.env.OFFICE_STRESS_SESSION)];
for (const index of selectedSessions) assert.ok(Number.isInteger(index) && index >= 0 && index < firstFormats.length);
async function resourceSnapshot() {
  const [memory, pressure] = await Promise.all([fs.readFile('/proc/meminfo', 'utf8'), fs.readFile('/proc/pressure/memory', 'utf8')]);
  return {
    availableGiB: Number(memory.match(/^MemAvailable:\s*(\d+)/m)?.[1]) / 1024 ** 2,
    fullAvg10: Number(pressure.match(/^full avg10=([\d.]+)/m)?.[1]),
  };
}
function assertResources(snapshot) {
  if (snapshot.availableGiB < 2 || snapshot.fullAvg10 > 10) {
    throw new Error(`ENVIRONMENT_INVALID ${JSON.stringify(snapshot)}`);
  }
}
const expected = {
  'rich.xlsx': ['FIRST SHEET', 'SECOND SHEET', '42'],
  'rich.docx': ['FIRST PAGE', 'SECOND PAGE', '42'],
  'sample.doc': ['한글 문서 PDF 확인'], 'sample.docx': ['한글 문서 PDF 확인'],
  'sample.xls': ['한글 표 PDF 확인'], 'sample.xlsx': ['한글 표 PDF 확인'],
  'sample.ppt': ['한글 발표 PDF 확인'], 'sample.pptx': ['한글 발표 PDF 확인'],
};
const summary = [];
try {
  for (const sessionIndex of selectedSessions) {
    const firstFile = firstFormats[sessionIndex];
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const external = [];
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin === new URL(base).origin || ['blob:', 'data:'].includes(url.protocol)) return route.continue();
      external.push(url.href); return route.abort();
    });
    const page = await context.newPage();
    await page.routeWebSocket('**', socket => socket.close());
    const started = [], closed = new Set();
    const engineLogs = [];
    page.on('console', message => {
      const value = message.text();
      if (value.includes('lok_document') || value.includes('Unipoll') || message.type() === 'error') engineLogs.push(value.slice(0, 500));
    });
    page.on('worker', worker => {
      if (!worker.url().includes('browser.worker.global.js')) return;
      started.push(worker); worker.on('close', () => closed.add(worker));
    });
    const files = [firstFile, ...baseFiles.filter((name, index) => index !== baseFiles.indexOf(firstFile))];
    assert.equal(files.length, 12);
    const records = [];
    try {
      await page.goto(base + '/en/tools/pdf-converter/document-to-pdf/');
      await page.waitForFunction(() => crossOriginIsolated);
      await page.waitForTimeout(400);
      for (const [fileIndex, name] of files.entries()) {
        const resourcesBefore = await resourceSnapshot();
        assertResources(resourcesBefore);
        const input = [...await fs.readFile(path.join('tests/fixtures/document-converters', name))];
        const result = await page.evaluate(async ({ input, name }) => {
          const { convertOfficePdf } = await import('/src/features/pdf-converter/officePdfClient.ts');
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 90_000);
          const start = performance.now();
          const progress = [];
          try {
            const output = await convertOfficePdf(new File([new Uint8Array(input)], name), controller.signal, value => progress.push(value));
            return { bytes: Array.from(output.bytes), ms: performance.now() - start, progress, heap: performance.memory?.usedJSHeapSize };
          } finally { clearTimeout(timer); }
        }, { input, name });
        const pdfPath = path.join(outputDir, `${sessionIndex}-${fileIndex}-${name}.pdf`);
        await fs.writeFile(pdfPath, Buffer.from(result.bytes));
        const info = execFileSync('pdfinfo', [pdfPath], { encoding: 'utf8' });
        const pages = Number(info.match(/^Pages:\s*(\d+)/m)?.[1]);
        const text = execFileSync('pdftotext', ['-layout', pdfPath, '-'], { encoding: 'utf8' });
        assert.ok(pages >= (name.startsWith('rich.') ? 2 : 1), `${name}: pages`);
        for (const label of expected[name]) assert.ok(text.includes(label), `${name}: missing ${label}`);
        if (name.startsWith('rich.')) {
          const images = execFileSync('pdfimages', ['-list', pdfPath], { encoding: 'utf8' });
          assert.match(images, /\bimage\b/, `${name}: missing image`);
          assert.match(execFileSync('pdffonts', [pdfPath], { encoding: 'utf8' }), /NanumGothic/, `${name}: Korean glyph font not embedded`);
        }
        if (name.endsWith('pptx')) {
          const size = info.match(/^Page size:\s*([\d.]+) x ([\d.]+)/m);
          assert.ok(size && Math.abs(Number(size[1]) / Number(size[2]) - 16 / 9) < .03, 'slide ratio');
        }
        assert.equal(started.length, 1, `${name}: reinitialized worker`);
        assert.equal(closed.has(started[0]), false, `${name}: worker retired during normal batch`);
        const resourcesAfter = await resourceSnapshot();
        records.push({ name, ms: result.ms, pages, bytes: result.bytes.length, heap: result.heap,
          progress: result.progress, resourcesBefore, resourcesAfter });
        console.log(JSON.stringify({ sessionIndex, fileIndex, name, ms: result.ms, pages, availableGiB: resourcesAfter.availableGiB }));
        assertResources(resourcesAfter);
      }
      await page.evaluate(async () => {
        const { releaseOfficePdfSession } = await import('/src/features/pdf-converter/officePdfClient.ts');
        releaseOfficePdfSession();
      });
      for (let retry = 0; retry < 20 && closed.size !== started.length; retry++) await page.waitForTimeout(100);
      assert.equal(started.length, 1);
      assert.equal(closed.size, 1, 'Bento worker survived release');
      assert.deepEqual(external, []);
      summary.push({ sessionIndex, firstFile, workerStarts: started.length, workerCloses: closed.size, external, records, engineLogs });
      console.log(JSON.stringify({ sessionIndex, firstFile, files: records.length, workerStarts: started.length,
        workerCloses: closed.size, firstMs: records[0].ms, warmMs: records.slice(1).map(r => Math.round(r.ms)) }));
    } catch (error) {
      await fs.writeFile(path.join(outputDir, `failure-${sessionIndex}.json`), JSON.stringify({
        sessionIndex, firstFile, error: String(error), workerStarts: started.length,
        workerCloses: closed.size, external, records, engineLogs, resources: await resourceSnapshot(),
      }, null, 2));
      throw error;
    } finally { await context.close(); }
  }
  await fs.writeFile(path.join(outputDir, 'result.json'), JSON.stringify(summary, null, 2));
} finally { await browser.close(); }
