import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import JSZip from 'jszip';
import { PDFDocument, StandardFonts, degrees, setTextRenderingMode, TextRenderingMode } from 'pdf-lib';
import { PNG } from 'pngjs';

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:4273';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const errors = [], external = [];
context.route('**/*', route => {
  const url = new URL(route.request().url());
  if (url.origin === new URL(base).origin || ['blob:', 'data:'].includes(url.protocol)) return route.continue();
  external.push(url.href); return route.abort();
});
const page = await context.newPage();
page.on('pageerror', error => errors.push(error.message));
page.on('framenavigated', frame => { if (frame === page.mainFrame()) console.log('navigated:', frame.url()); });
page.setDefaultTimeout(120_000);

async function convert(path, selection, format, imageMode) {
  const bytes = await page.evaluate(async ({ path, selection, format, imageMode }) => {
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Fixture unavailable: ${path}`);
    const file = new File([await response.blob()], path.split('/').at(-1), { type: 'application/pdf' });
    const mod = await import('/src/features/pdf-editor/stirlingDocumentClient.ts');
    const output = imageMode
      ? await (async () => {
        const preview = await import('/src/features/pdf-editor/pdfPreview.ts');
        const images = [];
        try {
          for (const sourceIndex of selection) images.push({ sourceIndex, ...await preview.renderPdfPageForDocument(file, sourceIndex, 'en') });
        } finally { await preview.releasePdf(file); }
        return mod.convertStirlingImagePages(images, format, 'test', 'en');
      })()
      : await mod.convertStirlingEditableDocument(file, selection, format, 'test', 'en');
    return Array.from(new Uint8Array(await output.blob.arrayBuffer()));
  }, { path, selection, format, imageMode });
  return JSZip.loadAsync(Uint8Array.from(bytes));
}

try {
  await page.goto(base + '/en/tools/pdf-converter/pdf-to-document/');
  await page.locator('input[type=file]').waitFor();
  await page.evaluate(() => {
    const NativeWorker = window.Worker;
    window.__stirlingWorkerStarts = 0;
    window.Worker = class extends NativeWorker {
      constructor(url, options) {
        if (String(url).includes('stirlingDocument.worker')) window.__stirlingWorkerStarts += 1;
        super(url, options);
      }
    };
  });
  const rich = '/tests/fixtures/document-converters/rich.pdf';
  const scanned = '/tests/fixtures/document-converters/scanned.pdf';
  const editablePptx = await convert(rich, [1, 0], 'pptx', false);
  const slide1 = await editablePptx.file('ppt/slides/slide1.xml').async('string');
  const slide2 = await editablePptx.file('ppt/slides/slide2.xml').async('string');
  assert.match(slide1, /SECOND PAGE/);
  assert.match(slide2, /FIRST PAGE/);
  assert.match(slide2, /한글/);
  assert.ok((slide2.match(/<p:sp>/g) || []).length > 0, 'editable text shapes exist');
  const offsets = [...slide2.matchAll(/<a:off x="(\d+)" y="(\d+)"\/>/g)].map(match => `${match[1]}:${match[2]}`);
  assert.ok(new Set(offsets).size > 2, 'PDF text and images use source positions');
  assert.ok(Object.keys(editablePptx.files).some(name => name.startsWith('ppt/media/')), 'original PDF pictures retained');

  const editableHwpx = await convert(rich, [1, 0], 'hwpx', false);
  const editableSection = await editableHwpx.file('Contents/section0.xml').async('string');
  assert.match(editableSection, /SECOND PAGE/);
  assert.match(editableSection, /FIRST PAGE/);
  assert.ok(editableSection.indexOf('SECOND PAGE') < editableSection.indexOf('FIRST PAGE'), 'requested source page order in HWPX');
  assert.match(editableSection, /한글/);
  assert.match(editableSection, /horzRelTo="PAPER"|horzRelTo="Paper"/, 'PDF image placement uses page coordinates');

  const imagePptx = await convert(scanned, [0], 'pptx', true);
  const imageSlide = await imagePptx.file('ppt/slides/slide1.xml').async('string');
  assert.match(imageSlide, /<p:pic>/);
  assert.ok(Object.keys(imagePptx.files).some(name => name.startsWith('ppt/media/')), 'scanned page image embedded');

  const imageHwpx = await convert(scanned, [0], 'hwpx', true);
  const hwpxSections = Object.keys(imageHwpx.files).filter(name => /^Contents\/section\d+\.xml$/.test(name));
  assert.equal(hwpxSections.length, 1);
  const section = await imageHwpx.file(hwpxSections[0]).async('string');
  assert.match(section, /<hp:pic\b/);
  assert.ok(Object.keys(imageHwpx.files).some(name => /BinData\//.test(name)), 'scanned page bitmap embedded');

  const cancellation = await page.evaluate(async path => {
    const file = new File([await (await fetch(path)).blob()], 'rich.pdf', { type: 'application/pdf' });
    const mod = await import('/src/features/pdf-editor/stirlingDocumentClient.ts');
    const controller = new AbortController();
    const work = mod.convertStirlingEditableDocument(file, [0, 1], 'pptx', 'cancel', 'en', undefined, controller.signal);
    setTimeout(() => controller.abort(), 10);
    try { await work; return 'completed'; } catch (error) { return error?.name; }
  }, rich);
  assert.equal(cancellation, 'AbortError', 'in-flight worker is terminated on abort');
  const retry = await convert(rich, [0], 'pptx', false);
  assert.match(await retry.file('ppt/slides/slide1.xml').async('string'), /FIRST PAGE/);
  assert.equal(await page.evaluate(() => window.__stirlingWorkerStarts), 2, 'one worker reused until cancellation, then a new session');

  const mixedPdf = await PDFDocument.create();
  const font = await mixedPdf.embedFont(StandardFonts.Helvetica);
  mixedPdf.addPage([612, 792]).drawText('PORTRAIT FIRST', { x: 80, y: 700, font, size: 24 });
  mixedPdf.addPage([900, 450]).drawText('WIDE SECOND', { x: 140, y: 320, font, size: 28 });
  mixedPdf.addPage([612, 792]).setRotation(degrees(90));
  const mixedBytes = [...await mixedPdf.save()];
  const mixedOutput = await page.evaluate(async bytes => {
    const file = new File([Uint8Array.from(bytes)], 'mixed.pdf', { type: 'application/pdf' });
    const mod = await import('/src/features/pdf-editor/stirlingDocumentClient.ts');
    const result = await mod.convertStirlingEditableDocument(file, [2, 1, 0], 'pptx', 'mixed', 'en');
    return Array.from(new Uint8Array(await result.blob.arrayBuffer()));
  }, mixedBytes);
  const mixedZip = await JSZip.loadAsync(Uint8Array.from(mixedOutput));
  assert.ok(mixedZip.file('ppt/slides/slide1.xml'), 'rotated blank source page retained');
  assert.match(await mixedZip.file('ppt/slides/slide2.xml').async('string'), /WIDE SECOND/);
  assert.match(await mixedZip.file('ppt/slides/slide3.xml').async('string'), /PORTRAIT FIRST/);

  const scanRaster = new PNG({ width: 20, height: 20 });
  scanRaster.data.fill(255);
  const layeredPdf = await PDFDocument.create();
  const layeredPage = layeredPdf.addPage([612, 792]);
  const layeredImage = await layeredPdf.embedPng(PNG.sync.write(scanRaster));
  layeredPage.drawImage(layeredImage, { x: 0, y: 0, width: 612, height: 792 });
  layeredPage.pushOperators(setTextRenderingMode(TextRenderingMode.Invisible));
  layeredPage.drawText('HIDDEN OCR WORDS', { x: 80, y: 640, size: 18 });
  const layeredOutput = await page.evaluate(async bytes => {
    const file = new File([Uint8Array.from(bytes)], 'layered.pdf', { type: 'application/pdf' });
    const mod = await import('/src/features/pdf-editor/stirlingDocumentClient.ts');
    const result = await mod.convertStirlingEditableDocument(file, [0], 'pptx', 'layered', 'en');
    return { bytes: Array.from(new Uint8Array(await result.blob.arrayBuffer())), preserved: result.imagePreservedSourceIndexes };
  }, [...await layeredPdf.save()]);
  const layeredZip = await JSZip.loadAsync(Uint8Array.from(layeredOutput.bytes));
  const layeredSlide = await layeredZip.file('ppt/slides/slide1.xml').async('string');
  assert.deepEqual(layeredOutput.preserved, [0]);
  assert.match(layeredSlide, /<p:pic>/);
  assert.doesNotMatch(layeredSlide, /HIDDEN OCR WORDS/, 'existing invisible OCR layer does not double printed text');

  assert.deepEqual(external, []);
  assert.deepEqual(errors, []);
  console.log('stirling layout: reversed editable PPTX/HWPX text and positions; scanned page PPTX/HWPX bitmap; in-flight cancel/retry; no external requests or page errors');
} finally { await browser.close(); }
