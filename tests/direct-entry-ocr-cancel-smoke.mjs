import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { createServer as createNetServer } from 'node:net';
import { PDFDocument } from 'pdf-lib';
import { chromium } from 'playwright';
import { createServer } from 'vite';

// Own a Vite listener (port 0 by default), cache, browser context and fixture.
// No existing server, external input PDF, .env file or operating provider is used.
const root = fileURLToPath(new URL('../', import.meta.url));
const out = await fs.mkdtemp(path.join(path.resolve(process.env.DIRECT_ENTRY_OUTPUT || os.tmpdir()), 'ocr-cancel-'));
const negative = process.env.OCR_CANCEL_NEGATIVE || '';
assert.ok(['', 'owner', 'selection'].includes(negative), 'unknown negative control');
const port = Number(process.env.OCR_CANCEL_PORT || 0);
assert.ok(Number.isInteger(port) && port >= 0 && port <= 65535, 'invalid OCR_CANCEL_PORT');

function negativeControl() {
  let applied = false;
  return {
    name: 'ocr-cancel-negative-control', enforce: 'pre',
    transform(source, id) {
      let before, after;
      if (negative === 'owner' && id.endsWith('/pdfOcrClient.ts')) {
        before = 'active.terminate();';
        after = '/* negative control: leave the real owner alive */';
      } else if (negative === 'selection' && id.endsWith('/PdfConvertPanel.tsx')) {
        before = 'setFormat(next?.format ?? "docx");';
        after = 'if (!next) setFile(null); ' + before;
      } else return;
      assert.equal(source.split(before).length, 2, 'mutation must match exactly once');
      applied = true;
      return source.replace(before, after);
    },
    assertApplied() { if (negative) assert.ok(applied, 'negative mutation was not applied'); },
  };
}

// Observe the real owner. Hold its genuine result to make the cancellation race
// deterministic, then redeliver it to the original listener even after removal.
// Worker creation, recognition, disposal and native terminate remain real.
function observeOcr() {
  const Native = window.Worker;
  const state = window.__ocrCancel = { owners: [], lateDeliveries: 0, resultNodes: 0, downloads: 0 };
  window.Worker = class extends Native {
    constructor(url, options) {
      super(url, options);
      if (!String(url).includes('pdfOcr.worker')) return;
      const owner = { url: String(url), recognizing: false, request: null, held: null, listeners: [], terminationCalls: 0, disposals: 0 };
      state.owners.push(owner);
      const add = this.addEventListener.bind(this), remove = this.removeEventListener.bind(this);
      const wrappers = new Map();
      this.addEventListener = (type, listener, ...args) => {
        if (type !== 'message') return add(type, listener, ...args);
        const wrapped = event => {
          if (event.data?.type === 'progress' && event.data.status === 'recognizing text') owner.recognizing = true;
          if (event.data?.type === 'result') { owner.held = event.data; return; }
          listener.call(this, event);
        };
        wrappers.set(listener, wrapped);
        owner.listeners.push(listener);
        return add(type, wrapped, ...args);
      };
      this.removeEventListener = (type, listener, ...args) => remove(type, wrappers.get(listener) || listener, ...args);
      const post = this.postMessage.bind(this), terminate = this.terminate.bind(this);
      this.postMessage = (...args) => {
        if (args[0]?.type === 'recognize') owner.request = args[0].id;
        if (args[0]?.type === 'dispose') owner.disposals++;
        return post(...args);
      };
      this.terminate = () => { owner.terminationCalls++; return terminate(); };
      owner.deliverLate = () => {
        if (!owner.held) throw Error('No genuine OCR result was held');
        for (const listener of owner.listeners) listener.call(this, new MessageEvent('message', { data: owner.held }));
        state.lateDeliveries++;
      };
    }
  };
  new MutationObserver(records => {
    for (const record of records) for (const node of record.addedNodes) {
      if (node.nodeType === 1) state.resultNodes += Number(node.matches('[data-testid="pdf-download"]')) + node.querySelectorAll('[data-testid="pdf-download"]').length;
    }
  }).observe(document, { childList: true, subtree: true });
}

await test('direct-entry OCR cancellation: real workers, retained input and late-result rejection', { timeout: 240_000 }, async t => {
  // Vite treats 0 as its default port. Ask the OS for an unused port first;
  // strictPort still rejects a racing claimant instead of testing another app.
  let listenPort = port;
  if (!listenPort) {
    const reservation = createNetServer();
    await new Promise((resolve, reject) => { reservation.once('error', reject); reservation.listen(0, '127.0.0.1', resolve); });
    listenPort = reservation.address().port;
    await new Promise((resolve, reject) => reservation.close(error => error ? reject(error) : resolve()));
  }
  const control = negativeControl();
  const server = await createServer({
    root, envFile: false, logLevel: 'error', cacheDir: path.join(root, 'node_modules/.cache', path.basename(out)),
    plugins: [control], server: { host: '127.0.0.1', port: listenPort, strictPort: true, hmr: false },
  });
  let browser;
  const report = { status: 'running', negative, out, cases: [], external: [], pageErrors: [] };
  try {
    await server.listen();
    const base = `http://127.0.0.1:${server.httpServer.address().port}`;
    report.base = base;
    browser = await chromium.launch({
      ...(process.env.BROWSER_PATH ? { executablePath: process.env.BROWSER_PATH } : {}),
      args: ['--no-sandbox', '--disable-dev-shm-usage'],
    });
    // Render synthetic scan pixels here; no text layer and no external fixture.
    const fixturePage = await browser.newPage();
    const png = await fixturePage.evaluate(() => {
      const canvas = document.createElement('canvas'); canvas.width = 1000; canvas.height = 1300;
      const ctx = canvas.getContext('2d'); ctx.fillStyle = 'white'; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'black'; ctx.font = '28px sans-serif';
      for (let i = 0; i < 30; i++) ctx.fillText(`LOCAL OCR CANCEL TEST ${i + 1} 12345`, 45, 65 + i * 39);
      return canvas.toDataURL('image/png').split(',')[1];
    });
    await fixturePage.close();
    const pdf = await PDFDocument.create(), image = await pdf.embedPng(Buffer.from(png, 'base64'));
    for (let i = 0; i < 3; i++) pdf.addPage([500, 650]).drawImage(image, { x: 0, y: 0, width: 500, height: 650 });
    const bytes = await pdf.save(), fixture = path.join(out, 'input.pdf');
    await fs.writeFile(fixture, bytes);
    assert.equal((await PDFDocument.load(bytes)).getPageCount(), 3);
    report.fixture = { path: fixture, pages: 3, sha256: createHash('sha256').update(bytes).digest('hex') };

    for (const action of ['cancel-button', 'confirmed-direct-entry']) await t.test(action, async () => {
      const context = await browser.newContext({ serviceWorkers: 'block' });
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin === base || ['data:', 'blob:'].includes(url.protocol)) return route.continue();
        report.external.push(url.href); return route.abort();
      });
      await context.routeWebSocket('**', socket => socket.close());
      await context.addInitScript(observeOcr);
      const page = await context.newPage(); page.setDefaultTimeout(60_000);
      page.on('pageerror', error => report.pageErrors.push(error.message));
      page.on('download', () => { report.unexpectedDownloads = (report.unexpectedDownloads || 0) + 1; });
      const cdp = await context.newCDPSession(page);
      const evidence = { action, workersCreated: [], workersClosed: [] };
      report.cases.push(evidence);
      let ownerWorker;
      page.on('worker', worker => {
        evidence.workersCreated.push(worker.url());
        if (worker.url().includes('pdfOcr.worker')) ownerWorker = worker;
        worker.on('close', () => evidence.workersClosed.push(worker.url()));
      });
      try {
        await page.goto(`${base}/en/tools/pdf-converter/pdf-to-document/ocr/`);
        await page.locator('[data-direct-purpose="ocr"]').waitFor();
        assert.match(await page.locator('[role="radio"][aria-checked="true"]').first().innerText(), /Searchable PDF/);
        await page.locator('input[type="file"]').setInputFiles(fixture);
        await page.locator('.pdf-page-card').nth(2).waitFor();
        const selectedBefore = await page.locator('[data-ui-component="file-list"]').innerText();
        assert.match(selectedBefore, /input\.pdf/);
        await page.getByRole('button', { name: 'Create OCR PDF', exact: true }).click();
        // A genuine first-page OCR result is kept pending in the client, so the
        // click cannot race normal completion. The live owner/child must exist.
        await page.waitForFunction(() => window.__ocrCancel.owners.some(o => o.recognizing && o.held?.data?.text?.includes('LOCAL OCR')), null, { timeout: 120_000 });
        assert.ok(ownerWorker, 'real OCR owner was created');
        const targets = (await cdp.send('Target.getTargets')).targetInfos;
        const ownerTarget = targets.find(target => target.url === ownerWorker.url());
        assert.ok(ownerTarget, 'real OCR owner target is alive before cancel');
        // Tesseract creates a blob child. PDF preview workers are not blob URLs.
        const childTargets = targets.filter(target => target.type === 'worker' && target.url.startsWith('blob:'));
        assert.ok(childTargets.length > 0, 'real nested Tesseract worker is alive before cancel');
        evidence.activeBefore = [ownerTarget, ...childTargets].map(({ targetId, url }) => ({ targetId, url }));
        assert.equal(await page.locator('[data-testid="pdf-download"]').count(), 0);
        await page.getByRole('button', { name: 'Cancel conversion', exact: true }).waitFor();
        if (action === 'cancel-button') {
          await page.getByRole('button', { name: 'Cancel conversion', exact: true }).click();
        } else {
          await page.locator('nav[aria-label="PDF Converter"]').getByRole('link', { name: 'PDF → Document', exact: true }).click();
          await page.locator('[data-testid="direct-entry-confirm"][open]').waitFor();
          await page.locator('[data-testid="direct-entry-accept"]').click();
          await page.locator('[data-testid="direct-entry-confirm"][open]').waitFor({ state: 'hidden' });
          assert.equal(await page.locator('[data-testid="unsaved-work-dialog"][open]').count(), 0);
        }
        // Close events and CDP target disappearance prove actual termination;
        // the intercepted terminate() call alone is deliberately insufficient.
        await assert.doesNotReject(async () => {
          const deadline = Date.now() + 10_000;
          while (Date.now() < deadline) {
            const live = (await cdp.send('Target.getTargets')).targetInfos;
            const remaining = evidence.activeBefore.filter(old => live.some(target => target.targetId === old.targetId));
            if (!remaining.length && evidence.workersClosed.includes(ownerWorker.url())) return;
            await page.waitForTimeout(50);
          }
          throw Error('OCR owner/child still alive after cancellation');
        }, 'actual OCR owner and child must terminate');
        evidence.activeAfter = (await cdp.send('Target.getTargets')).targetInfos.filter(target => evidence.activeBefore.some(old => old.targetId === target.targetId));
        await page.waitForFunction(() => window.__ocrCancel.owners[0].terminationCalls === 1);
        assert.equal(await page.locator('.pdf-page-card').count(), 3, 'selected three-page PDF must remain');
        assert.equal(await page.locator('[data-ui-component="file-list"]').innerText(), selectedBefore, 'selected file identity must remain');
        if (action === 'confirmed-direct-entry') assert.match(await page.locator('[role="radio"][aria-checked="true"]').first().innerText(), /DOCX\s+Paragraphs/);
        else assert.match(await page.locator('[role="radio"][aria-checked="true"]').first().innerText(), /Searchable PDF/);
        await page.evaluate(() => window.__ocrCancel.owners[0].deliverLate());
        await page.waitForTimeout(750);
        assert.equal(await page.locator('[data-testid="pdf-download"]').count(), 0, 'late OCR result must not register a download');
        evidence.observed = await page.evaluate(() => {
          const s = window.__ocrCancel;
          return { lateDeliveries: s.lateDeliveries, resultNodes: s.resultNodes, owners: s.owners.map(o => ({ url: o.url, recognizing: o.recognizing, request: o.request, heldResultId: o.held.id, heldTextLength: o.held.data.text.length, disposals: o.disposals, terminationCalls: o.terminationCalls })) };
        });
        assert.equal(evidence.observed.lateDeliveries, 1, 'a genuine queued OCR result must be redelivered');
        assert.equal(evidence.observed.resultNodes, 0, 'even transient result registration is forbidden');
        assert.equal(report.unexpectedDownloads || 0, 0);
        assert.equal(await page.locator('.pdf-page-card').count(), 3);
        await page.getByRole('button', { name: action === 'cancel-button' ? 'Create OCR PDF' : 'Convert to DOCX', exact: true }).waitFor();
        await page.screenshot({ path: path.join(out, `${action}.png`), fullPage: true });
        evidence.status = 'passed';
      } catch (error) {
        evidence.status = 'failed'; evidence.error = error.stack;
        await page.screenshot({ path: path.join(out, `${action}-failure.png`), fullPage: true }).catch(() => {});
        throw error;
      } finally { await context.close(); }
    });
    control.assertApplied();
    assert.deepEqual(report.pageErrors, []);
    assert.ok(report.external.every(url => new URL(url).origin !== report.base));
    report.status = report.cases.every(item => item.status === 'passed') ? 'passed' : 'failed';
  } catch (error) { report.status = 'failed'; report.error = error.stack; throw error; }
  finally {
    await browser?.close(); await server.close();
    await fs.writeFile(path.join(out, 'ocr-cancel-report.json'), JSON.stringify(report, null, 2));
    console.log(`OCR cancel evidence: ${out}`);
  }
});
