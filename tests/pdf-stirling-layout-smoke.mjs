import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import JSZip from 'jszip';
import { PDFDocument, StandardFonts, degrees, rgb, PDFName, PDFString, setTextRenderingMode, TextRenderingMode,
  pushGraphicsState, popGraphicsState, concatTransformationMatrix, rectangle, clip, endPath } from 'pdf-lib';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const exec = promisify(execFile);

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
  const timedOut = await page.evaluate(async path => {
    const file = new File([await (await fetch(path)).blob()], 'rich.pdf', { type: 'application/pdf' });
    const mod = await import('/src/features/pdf-editor/stirlingDocumentClient.ts');
    try { await mod.convertStirlingEditableDocument(file, [0, 1], 'pptx', 'timeout', 'en', undefined, undefined, 1); return false; }
    catch (error) { return error?.message === 'DOCUMENT_TIMEOUT'; }
  }, rich);
  assert.equal(timedOut, true, 'stalled worker is forcibly timed out');
  const afterTimeout = await convert(rich, [0], 'pptx', false);
  assert.match(await afterTimeout.file('ppt/slides/slide1.xml').async('string'), /FIRST PAGE/);
  const released = await page.evaluate(async path => {
    const file = new File([await (await fetch(path)).blob()], 'rich.pdf', { type: 'application/pdf' });
    const mod = await import('/src/features/pdf-editor/stirlingDocumentClient.ts');
    const first = mod.convertStirlingEditableDocument(file, [0, 1], 'pptx', 'dispose-first', 'en');
    const queued = mod.convertStirlingEditableDocument(file, [1], 'pptx', 'dispose-queued', 'en');
    setTimeout(() => mod.releaseStirlingDocumentSession(), 10);
    return Promise.all([first, queued].map(async result => {
      try { await result; return 'completed'; } catch (error) { return error?.name; }
    }));
  }, rich);
  assert.deepEqual(released, ['AbortError', 'AbortError'], 'batch disposal rejects active and queued requests');
  const afterDispose = await convert(rich, [0], 'pptx', false);
  assert.match(await afterDispose.file('ppt/slides/slide1.xml').async('string'), /FIRST PAGE/);

  const mixedPdf = await PDFDocument.create();
  const font = await mixedPdf.embedFont(StandardFonts.Helvetica);
  mixedPdf.addPage([612, 792]).drawText('PORTRAIT FIRST', { x: 80, y: 700, font, size: 24 });
  mixedPdf.addPage([900, 450]).drawText('WIDE SECOND', { x: 140, y: 320, font, size: 28 });
  const rotatedPage = mixedPdf.addPage([612, 792]);
  rotatedPage.drawText('ROTATED THIRD', { x: 80, y: 700, font, size: 24 });
  rotatedPage.setRotation(degrees(90));
  const mixedBytes = [...await mixedPdf.save()];
  const mixedOutput = await page.evaluate(async bytes => {
    const file = new File([Uint8Array.from(bytes)], 'mixed.pdf', { type: 'application/pdf' });
    const mod = await import('/src/features/pdf-editor/stirlingDocumentClient.ts');
    const result = await mod.convertStirlingEditableDocument(file, [2, 1, 0], 'pptx', 'mixed', 'en');
    return Array.from(new Uint8Array(await result.blob.arrayBuffer()));
  }, mixedBytes);
  const mixedZip = await JSZip.loadAsync(Uint8Array.from(mixedOutput));
  assert.ok(mixedZip.file('ppt/slides/slide1.xml'), 'rotated nonblank source page retained');
  assert.match(await mixedZip.file('ppt/slides/slide1.xml').async('string'), /<p:pic>/, 'rotated page preserves its full visible geometry');
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
  layeredPage.pushOperators(setTextRenderingMode(TextRenderingMode.Fill));
  layeredPage.drawText('VISIBLE TITLE', { x: 80, y: 710, size: 24 });
  layeredPage.drawRectangle({ x: 430, y: 80, width: 120, height: 50, color: rgb(0.9, 0.1, 0.1) });
  const note = layeredPdf.context.obj({ Type: PDFName.of('Annot'), Subtype: PDFName.of('Text'),
    Rect: [520, 600, 540, 620], Contents: PDFString.of('Visible note') });
  layeredPage.node.addAnnot(layeredPdf.context.register(note));
  const layeredOutput = await page.evaluate(async bytes => {
    const file = new File([Uint8Array.from(bytes)], 'layered.pdf', { type: 'application/pdf' });
    const mod = await import('/src/features/pdf-editor/stirlingDocumentClient.ts');
    const result = await mod.convertStirlingEditableDocument(file, [0], 'pptx', 'layered', 'en');
    return { bytes: Array.from(new Uint8Array(await result.blob.arrayBuffer())), preserved: result.imagePreservedSourceIndexes,
      fallbacks: result.pageFallbacks, warnings: result.warnings };
  }, [...await layeredPdf.save()]);
  const layeredZip = await JSZip.loadAsync(Uint8Array.from(layeredOutput.bytes));
  const layeredSlide = await layeredZip.file('ppt/slides/slide1.xml').async('string');
  assert.deepEqual(layeredOutput.preserved, [0]);
  assert.match(layeredSlide, /<p:pic>/);
  assert.doesNotMatch(layeredSlide, /HIDDEN OCR WORDS/, 'existing invisible OCR layer does not double printed text');
  assert.match(layeredOutput.fallbacks[0].reason, /invisible OCR layer/);
  assert.match(layeredOutput.warnings.join(' '), /picture|preserved/i);

  const paintedPdf = await PDFDocument.create();
  const paintFont = await paintedPdf.embedFont(StandardFonts.Helvetica);
  const asymmetric = new PNG({ width: 40, height: 20 });
  for (let y = 0; y < 20; y++) for (let x = 0; x < 40; x++) {
    const p = (y * 40 + x) * 4;
    asymmetric.data[p] = y < 4 ? 20 : x < 20 ? 230 : 20;
    asymmetric.data[p + 1] = y < 4 ? 210 : 20;
    asymmetric.data[p + 2] = y < 4 ? 20 : x < 20 ? 20 : 230;
    asymmetric.data[p + 3] = 255;
  }
  const asset = await paintedPdf.embedPng(PNG.sync.write(asymmetric));
  const firstPaint = paintedPdf.addPage([612, 792]);
  firstPaint.drawImage(asset, { x: 90, y: 550, width: 240, height: 120 });
  firstPaint.drawText('TITLE OVER IMAGE', { x: 110, y: 610, font: paintFont, size: 20 });
  const lastPaint = paintedPdf.addPage([612, 792]);
  lastPaint.drawText('COVERED TITLE', { x: 110, y: 610, font: paintFont, size: 20 });
  lastPaint.drawImage(asset, { x: 90, y: 550, width: 240, height: 120 });
  const turnedPaint = paintedPdf.addPage([612, 792]);
  turnedPaint.drawImage(asset, { x: 340, y: 380, width: 240, height: 120, rotate: degrees(90) });
  const mirroredPaint = paintedPdf.addPage([612, 792]);
  mirroredPaint.pushOperators(pushGraphicsState(), concatTransformationMatrix(-1, 0, 0, 1, 612, 0));
  mirroredPaint.drawImage(asset, { x: 90, y: 380, width: 240, height: 120 });
  mirroredPaint.pushOperators(popGraphicsState());
  const clippedPaint = paintedPdf.addPage([612, 792]);
  clippedPaint.pushOperators(pushGraphicsState(), rectangle(90, 380, 130, 120), clip(), endPath());
  clippedPaint.drawImage(asset, { x: 90, y: 380, width: 240, height: 120 });
  clippedPaint.pushOperators(popGraphicsState());
  const turnedText = paintedPdf.addPage([612, 792]);
  turnedText.drawText('SIDEWAYS TEXT', { x: 300, y: 380, font: paintFont, size: 24, rotate: degrees(90) });
  const vectorPage = paintedPdf.addPage([612, 792]);
  vectorPage.drawText('EDITABLE VECTOR PAGE', { x: 60, y: 700, font: paintFont, size: 24 });
  vectorPage.drawRectangle({ x: 60, y: 500, width: 200, height: 100, color: rgb(0, 0.6, 0) });
  const paintedOutput = await page.evaluate(async bytes => {
    const file = new File([Uint8Array.from(bytes)], 'painted.pdf', { type: 'application/pdf' });
    const mod = await import('/src/features/pdf-editor/stirlingDocumentClient.ts');
    const result = await mod.convertStirlingEditableDocument(file, [0, 1, 2, 3, 4, 5, 6], 'pptx', 'painted', 'en');
    return { bytes: Array.from(new Uint8Array(await result.blob.arrayBuffer())), fallbacks: result.pageFallbacks,
      graphics: result.graphicsFlattenedSourceIndexes };
  }, [...await paintedPdf.save()]);
  const paintedZip = await JSZip.loadAsync(Uint8Array.from(paintedOutput.bytes));
  assert.deepEqual(paintedOutput.fallbacks.map(item => item.sourceIndex), [0, 1, 2, 3, 4, 5]);
  assert.deepEqual(paintedOutput.graphics, [6]);
  for (let index = 1; index <= 6; index++) {
    const xml = await paintedZip.file(`ppt/slides/slide${index}.xml`).async('string');
    assert.match(xml, /<p:pic>/, `complex source page ${index} preserves complete appearance`);
    assert.doesNotMatch(xml, /<p:sp>/, `complex source page ${index} does not falsely claim editable text`);
  }
  const vectorSlide = await paintedZip.file('ppt/slides/slide7.xml').async('string');
  assert.match(vectorSlide, /EDITABLE VECTOR PAGE/);
  assert.match(vectorSlide, /<p:pic>/, 'vector artwork is flattened behind editable text');

  const largePixels = new PNG({ width: 3500, height: 3500 });
  largePixels.data.fill(255);
  const highResPdf = await PDFDocument.create();
  const highResPage = highResPdf.addPage([612, 792]);
  highResPage.drawImage(await highResPdf.embedPng(PNG.sync.write(largePixels)),
    { x: 0, y: 0, width: 612, height: 792 });
  const highResResult = await page.evaluate(async bytes => {
    const file = new File([Uint8Array.from(bytes)], 'high-resolution.pdf', { type: 'application/pdf' });
    const mod = await import('/src/features/pdf-editor/stirlingDocumentClient.ts');
    const result = await mod.convertStirlingEditableDocument(file, [0], 'pptx', 'high-resolution', 'en');
    return { bytes: Array.from(new Uint8Array(await result.blob.arrayBuffer())), fallbacks: result.pageFallbacks };
  }, [...await highResPdf.save()]);
  assert.match(highResResult.fallbacks[0].reason, /high-resolution image extraction/);
  assert.match(await (await JSZip.loadAsync(Uint8Array.from(highResResult.bytes))).file('ppt/slides/slide1.xml').async('string'), /<p:pic>/);

  if (process.env.STIRLING_NATIVE_RENDER === '1') {
    const artifacts = await fs.mkdtemp(path.join(os.tmpdir(), 'worklazy-stirling-native-'));
    const pdfFile = path.join(artifacts, 'source.pdf');
    const pptxFile = path.join(artifacts, 'layered.pptx');
    await fs.writeFile(pdfFile, await layeredPdf.save());
    await fs.writeFile(pptxFile, Uint8Array.from(layeredOutput.bytes));
    const loProfile = path.join(artifacts, 'lo-profile');
    await exec('libreoffice', [`-env:UserInstallation=file://${loProfile}`, '--headless', '--convert-to', 'pdf', '--outdir', artifacts, pptxFile], { timeout: 120_000 });
    await exec('pdftoppm', ['-f', '1', '-l', '1', '-r', '72', '-png', '-singlefile', pdfFile, path.join(artifacts, 'source')], { timeout: 30_000 });
    await exec('pdftoppm', ['-f', '1', '-l', '1', '-r', '72', '-png', '-singlefile', path.join(artifacts, 'layered.pdf'), path.join(artifacts, 'pptx')], { timeout: 30_000 });
    const pptxRendered = PNG.sync.read(await fs.readFile(path.join(artifacts, 'pptx.png')));
    assert.ok(countColor(pptxRendered, (r, g, b) => r > 150 && g < 100 && b < 100) > 1000, 'native PowerPoint rendering retains red vector stamp');
    assert.ok(countColor(pptxRendered, (r, g, b) => r < 80 && g < 80 && b < 80) > 150, 'native PowerPoint rendering retains visible title');

    const hwpxBytes = await page.evaluate(async bytes => {
      const file = new File([Uint8Array.from(bytes)], 'layered.pdf', { type: 'application/pdf' });
      const mod = await import('/src/features/pdf-editor/stirlingDocumentClient.ts');
      const result = await mod.convertStirlingEditableDocument(file, [0], 'hwpx', 'layered', 'en');
      return Array.from(new Uint8Array(await result.blob.arrayBuffer()));
    }, [...await layeredPdf.save()]);
    const hwpxFile = path.join(artifacts, 'layered.hwpx');
    await fs.writeFile(hwpxFile, Uint8Array.from(hwpxBytes));
    const rhwp = await import('@rhwp/core');
    await rhwp.default({ module_or_path: await fs.readFile('node_modules/@rhwp/core/rhwp_bg.wasm') });
    const hwp = new rhwp.HwpDocument(Uint8Array.from(hwpxBytes));
    const svg = hwp.renderPageSvg(0);
    hwp.free();
    await fs.writeFile(path.join(artifacts, 'hwpx.svg'), svg);
    const hwpxPng = await page.evaluate(async svgSource => {
      const url = URL.createObjectURL(new Blob([svgSource], { type: 'image/svg+xml' }));
      try {
        const image = new Image(); image.src = url; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
        canvas.getContext('2d').drawImage(image, 0, 0);
        return Array.from(new Uint8Array(await new Promise(resolve => canvas.toBlob(async blob => resolve(await blob.arrayBuffer()), 'image/png'))));
      } finally { URL.revokeObjectURL(url); }
    }, svg);
    await fs.writeFile(path.join(artifacts, 'hwpx.png'), Uint8Array.from(hwpxPng));
    const hwpxRendered = PNG.sync.read(Buffer.from(hwpxPng));
    assert.ok(countColor(hwpxRendered, (r, g, b) => r > 150 && g < 100 && b < 100) > 1000, 'HWPX SDK rendering retains red vector stamp');
    assert.ok(countColor(hwpxRendered, (r, g, b) => r < 80 && g < 80 && b < 80) > 150, 'HWPX SDK rendering retains visible title');

    const richHwpxBytes = await page.evaluate(async fixturePath => {
      const file = new File([await (await fetch(fixturePath)).blob()], 'rich.pdf', { type: 'application/pdf' });
      const mod = await import('/src/features/pdf-editor/stirlingDocumentClient.ts');
      const result = await mod.convertStirlingEditableDocument(file, [0, 1], 'hwpx', 'rich', 'en');
      return Array.from(new Uint8Array(await result.blob.arrayBuffer()));
    }, rich);
    const richPptxBytes = await page.evaluate(async fixturePath => {
      const file = new File([await (await fetch(fixturePath)).blob()], 'rich.pdf', { type: 'application/pdf' });
      const mod = await import('/src/features/pdf-editor/stirlingDocumentClient.ts');
      const result = await mod.convertStirlingEditableDocument(file, [0, 1], 'pptx', 'rich', 'en');
      return Array.from(new Uint8Array(await result.blob.arrayBuffer()));
    }, rich);
    await fs.writeFile(path.join(artifacts, 'rich.pptx'), Uint8Array.from(richPptxBytes));
    await exec('libreoffice', [`-env:UserInstallation=file://${loProfile}`, '--headless', '--convert-to', 'pdf', '--outdir', artifacts,
      path.join(artifacts, 'rich.pptx')], { timeout: 120_000 });
    await exec('pdftoppm', ['-f', '1', '-l', '2', '-r', '72', '-png', path.join(artifacts, 'rich.pdf'),
      path.join(artifacts, 'rich-pptx')], { timeout: 30_000 });
    const nativeSlide = PNG.sync.read(await fs.readFile(path.join(artifacts, 'rich-pptx-1.png')));
    assert.ok(countColor(nativeSlide, (r, g, b) => r < 60 && g < 60 && b < 60) > 900,
      'native PowerPoint rendering keeps table borders and text');

    await fs.writeFile(path.join(artifacts, 'painted-source.pdf'), await paintedPdf.save());
    await fs.writeFile(path.join(artifacts, 'painted.pptx'), Uint8Array.from(paintedOutput.bytes));
    await exec('libreoffice', [`-env:UserInstallation=file://${loProfile}`, '--headless', '--convert-to', 'pdf', '--outdir', artifacts,
      path.join(artifacts, 'painted.pptx')], { timeout: 120_000 });
    await exec('pdftoppm', ['-f', '1', '-l', '6', '-r', '72', '-png', path.join(artifacts, 'painted-source.pdf'),
      path.join(artifacts, 'painted-source')], { timeout: 30_000 });
    await exec('pdftoppm', ['-f', '1', '-l', '6', '-r', '72', '-png', path.join(artifacts, 'painted.pdf'),
      path.join(artifacts, 'painted-output')], { timeout: 30_000 });
    for (let index = 1; index <= 6; index++) {
      const source = PNG.sync.read(await fs.readFile(path.join(artifacts, `painted-source-${index}.png`)));
      const output = PNG.sync.read(await fs.readFile(path.join(artifacts, `painted-output-${index}.png`)));
      assert.equal(output.width, source.width); assert.equal(output.height, source.height);
      const difference = pixelmatch(source.data, output.data, undefined, source.width, source.height, { threshold: 0.18 });
      assert.ok(difference / (source.width * source.height) < 0.035,
        `native render of transformed/clipped page ${index} differs on ${difference} pixels`);
    }
    await fs.writeFile(path.join(artifacts, 'rich.hwpx'), Uint8Array.from(richHwpxBytes));
    const richHwp = new rhwp.HwpDocument(Uint8Array.from(richHwpxBytes));
    try {
      assert.equal(richHwp.pageCount(), 2, 'HWPX keeps one physical page per selected source page');
      for (let index = 0; index < 2; index++) {
        const rendered = richHwp.renderPageSvg(index);
        assert.match(rendered, /<image\b/, `source page ${index + 1} picture appears on same HWPX page`);
        await fs.writeFile(path.join(artifacts, `rich-page-${index + 1}.svg`), rendered);
        const renderedPng = await page.evaluate(async svgSource => {
          const url = URL.createObjectURL(new Blob([svgSource], { type: 'image/svg+xml' }));
          try {
            const image = new Image(); image.src = url; await image.decode();
            const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight;
            canvas.getContext('2d').drawImage(image, 0, 0);
            return Array.from(new Uint8Array(await new Promise(resolve => canvas.toBlob(async blob => resolve(await blob.arrayBuffer()), 'image/png'))));
          } finally { URL.revokeObjectURL(url); }
        }, rendered);
        await fs.writeFile(path.join(artifacts, `rich-page-${index + 1}.png`), Uint8Array.from(renderedPng));
        assert.ok(countColor(PNG.sync.read(Buffer.from(renderedPng)), (r, g, b) => r < 80 && g < 80 && b < 80) > 100,
          `source page ${index + 1} text is visible in HWPX SDK render`);
      }
    } finally { richHwp.free(); }
    console.log('native render artifacts:', artifacts);
  }

  assert.deepEqual(external, []);
  assert.deepEqual(errors, []);
  console.log('stirling layout: editable table text with vector borders; complete-page fallback for OCR/annotation, rotated, reflected and clipped content; scan and high-resolution preservation; timeout, cancellation, disposal and retry; no external requests or page errors');
} finally { await browser.close(); }

function countColor(png, match) {
  let count = 0;
  for (let offset = 0; offset < png.data.length; offset += 4) if (match(png.data[offset], png.data[offset + 1], png.data[offset + 2])) count++;
  return count;
}
