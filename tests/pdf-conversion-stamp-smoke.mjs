import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

await test('OCR word cleanup retains a colored stamp crossing recognized text', async () => {
  const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:4188';
  const evidenceDir = process.env.EVIDENCE_DIR || await fs.mkdtemp('/tmp/worklazy-pdf-stamp-');
  await fs.mkdir(evidenceDir, { recursive: true });
  const source = await PDFDocument.create();
  const page = source.addPage([400, 400]);
  const font = await source.embedFont(StandardFonts.Helvetica);
  page.drawText('TEST', { x: 100, y: 267, size: 24, font });
  page.drawRectangle({ x: 172, y: 268, width: 12, height: 12, color: rgb(1, 0, 0) });
  const input = Buffer.from(await source.save());
  const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--disable-dev-shm-usage'], chromiumSandbox: true });
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const external = [];
  await context.route('**/*', route => { const u = new URL(route.request().url()); if (u.origin === new URL(base).origin || ['blob:', 'data:'].includes(u.protocol)) return route.continue(); external.push(u.href); return route.abort(); });
  const browserPage = await context.newPage();
  await browserPage.routeWebSocket('**', socket => socket.close());
  try {
    await browserPage.goto(base + '/en/tools/pdf-converter/pdf-to-document/');
    const result = await browserPage.evaluate(async bytes => {
      const { prepareOcrPdfForDocx } = await import('/src/features/pdf-editor/pdfOcrDocxPreparation.ts');
      const { renderPdfPageForDocument, releasePdf } = await import('/src/features/pdf-editor/pdfPreview.ts');
      const { releaseBentoPdfSession } = await import('/src/features/pdf-editor/bentoPdfClient.ts');
      const original = new File([new Uint8Array(bytes)], 'stamp.pdf', { type: 'application/pdf' });
      const hocr = '<div class="ocr_page" title="bbox 0 0 400 400"><span class="ocr_line" title="bbox 98 115 190 138; baseline 0 -3"><span class="ocrx_word" title="bbox 98 115 190 138; x_wconf 99">TEST</span></span></div>';
      const profile = { pageIndex: 0, rotation: 0, width: 400, height: 400, imageCoverage: 1, visibleCharacters: 0, hiddenSpans: [], visibleSpans: [] };
      const prepared = await prepareOcrPdfForDocx(original, [0], [profile], new Map([[0, hocr]]), 'en');
      const output = new File([prepared.pdf], 'prepared.pdf', { type: 'application/pdf' });
      const countRed = async file => {
        const rendered = await renderPdfPageForDocument(file, 0, 'en');
        const bitmap = await createImageBitmap(rendered.blob);
        const canvas = document.createElement('canvas');canvas.width = bitmap.width;canvas.height = bitmap.height;
        const context = canvas.getContext('2d');context.drawImage(bitmap, 0, 0);bitmap.close();
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let red = 0;for(let i=0;i<pixels.length;i+=4)if(pixels[i]>180&&pixels[i+1]<80&&pixels[i+2]<80)red++;
        canvas.width=1;canvas.height=1;return red;
      };
      const beforeRed = await countRed(original), afterRed = await countRed(output);
      await releasePdf(original);await releasePdf(output);releaseBentoPdfSession();
      return { beforeRed, afterRed, pages: prepared.pages, pdf: Array.from(new Uint8Array(await prepared.pdf.arrayBuffer())) };
    }, [...input]);
    await fs.writeFile(`${evidenceDir}/prepared.pdf`, Buffer.from(result.pdf));
    const summary = { beforeRed: result.beforeRed, afterRed: result.afterRed, pages: result.pages };
    await fs.writeFile(`${evidenceDir}/result.json`, JSON.stringify(summary, null, 2));
    assert.ok(result.beforeRed >= 100, 'synthetic source stamp absent');
    assert.ok(result.afterRed >= result.beforeRed * .8, 'colored stamp was erased by OCR cleanup');
    assert.equal(result.pages[0].method, 'image-fallback');
    assert.match(result.pages[0].warnings.join(' '), /stamp/);
    assert.deepEqual(external, []);
    console.log(JSON.stringify(summary), 'Evidence:', evidenceDir);
  } finally { await browser.close(); }
});
