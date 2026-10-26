import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs/promises';import { PNG } from 'pngjs';
import { compareRgba } from '../src/features/image-compare/kernel.ts';
import { DEFAULT_PIXEL_OPTIONS } from '../src/features/image-compare/types.ts';
import { writeImagePdfReport, cropScale } from '../src/features/comparison-report/imagePdf.ts';
import { imagePdfReservation, imagePdfPages, IMAGE_PDF_SIDES } from '../src/features/comparison-report/imageAdapter.ts';
import { IMAGE_LIMITS } from '../src/features/image-compare/types.ts';
import { createExportSnapshot } from '../src/features/comparison-report/snapshot.ts';
const font = () => fs.readFile('public/vendor/qr-label-font/noto-cjk-sans-2.004/NotoSansKR-Regular.otf');
const encodePng = async (width, height, rgba) => { const png = new PNG({ width, height }); png.data = Buffer.from(rgba); return new Uint8Array(PNG.sync.write(png)); };
function fixture() {
  const width = 300, height = 200, left = new Uint8ClampedArray(width * height * 4).fill(255), right = left.slice(), valid = new Uint8Array(width * height).fill(1);
  for (let y = 40; y < 80; y++) for (let x = 30; x < 90; x++) right.set([20, 20, 20, 255], (y * width + x) * 4);
  for (let y = 120; y < 150; y++) for (let x = 200; x < 260; x++) right.set([250, 0, 0, 255], (y * width + x) * 4);
  const source = (name) => ({ name, bytes: 1, mime: 'image/png', width, height, decodedWidth: width, decodedHeight: height, bitDepth: 8, exifOrientation: 1, decodeOrientation: 'from-image', workingColorSpace: '8-bit sRGB' });
  return { ...compareRgba(left, right, width, height, valid, valid, DEFAULT_PIXEL_OPTIONS), left, right, width, height, options: DEFAULT_PIXEL_OPTIONS, sources: { left: source('원본 화면 😀.png'), right: source('after.png') } };
}
const regions = [{ id: 'r1', bounds: { x: 30, y: 40, width: 60, height: 40 } }, { id: 'r2', bounds: { x: 200, y: 120, width: 60, height: 30 } }, { id: 'r3', bounds: { x: 0, y: 0, width: 10, height: 10 } }, { id: 'r4', bounds: { x: 290, y: 190, width: 10, height: 10 } }];
async function text(blob) { const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs'); const job = pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()), disableFontFace: true }); const doc = await job.promise;
  try { const pages = []; for (let i = 1; i <= doc.numPages; i++) pages.push((await (await doc.getPage(i)).getTextContent()).items.map(x => x.str).join('')); return pages; } finally { await job.destroy(); } }
test('image PDF report has results, sources and changes three per page with page numbers', async () => {
  const result = fixture(), snapshot = createExportSnapshot({ language: 'ko', tool: 'image-compare', sources: [{ id: 'left', revision: '1', label: '원본 화면 😀.png' }, { id: 'right', revision: '1', label: 'after.png' }], appliedOptions: {}, coordinates: {}, completion: 'complete', warnings: [], rows: [] });
  const blob = await writeImagePdfReport({ snapshot, result, regions, projection: 'highlight', signal: new AbortController().signal, fontBytes: new Uint8Array(await font()), encodePng });
  const pages = await text(blob);
  assert.equal(pages.length, 4); // results, sources, 3 changes + 1 change
  assert.ok(pages[0].includes('이미지 비교 보고서') && pages[0].includes('찾은 영역') && pages[0].includes('차이 강조'));
  assert.ok(pages[1].includes('[U+1F600]') && pages[1].includes('300 x 200 px'));
  assert.ok(pages[2].includes('변경 1') && pages[2].includes('변경 3') && !pages[2].includes('변경 4') && pages[3].includes('변경 4'));
  pages.forEach((page, index) => assert.ok(page.includes(`${index + 1} / 4쪽`), page));
  assert.ok(blob.size < 1024 * 1024, `${blob.size}`);
  if (process.env.IMAGE_PDF_OUTPUT) await fs.writeFile(process.env.IMAGE_PDF_OUTPUT, new Uint8Array(await blob.arrayBuffer()));
  // Without regions a single page says so.
  const empty = await text(await writeImagePdfReport({ snapshot, result, regions: [], projection: 'left', signal: new AbortController().signal, fontBytes: new Uint8Array(await font()), encodePng }));
  assert.equal(empty.length, 3); assert.ok(empty[2].includes('찾은 영역이 없습니다'));
});
test('PDF reservation grows with regions and the page count is capped (Astra R17)', () => {
  const result = fixture(), none = imagePdfReservation(result, []), one = imagePdfReservation(result, [regions[0]]);
  // Each region adds three 60x40 crops kept as RGB+alpha streams and copied once on save.
  assert.equal(one - none, 3 * 60 * 40 * 4 * 2);
  const big = { bounds: { width: 4000, height: 3000 } };
  assert.equal(imagePdfReservation(result, [big]) - none, 3 * IMAGE_PDF_SIDES.crop * 450 * 4 * 2);
  assert.equal(imagePdfPages(0), 3); assert.equal(imagePdfPages(3), 3); assert.equal(imagePdfPages(4), 4);
  const limit = (2000 - 2) * 3;
  assert.doesNotThrow(() => imagePdfReservation(result, Array.from({ length: limit }, () => regions[3])));
  assert.throws(() => imagePdfReservation(result, Array.from({ length: limit + 1 }, () => regions[3])), /REPORT_PDF_LIMIT/u);
  assert.throws(() => imagePdfReservation(result, [], IMAGE_LIMITS.memoryBytes), /IMAGE_MEMORY_LIMIT/u);
  const many = Array.from({ length: 5000 }, () => big);
  assert.throws(() => imagePdfReservation(result, many), /IMAGE_MEMORY_LIMIT/u);
});
test('long file names are cut to the page width with an ellipsis (Astra R19)', async () => {
  const result = fixture(); result.sources.left = { ...result.sources.left, name: `${'가'.repeat(100)}.png` };
  const snapshot = createExportSnapshot({ language: 'ko', tool: 'image-compare', sources: [{ id: 'left', revision: '1', label: '원본 화면 😀.png' }, { id: 'right', revision: '1', label: 'after.png' }], appliedOptions: {}, coordinates: {}, completion: 'complete', warnings: [], rows: [] });
  const blob = await writeImagePdfReport({ snapshot, result, regions: [], projection: 'left', signal: new AbortController().signal, fontBytes: new Uint8Array(await font()), encodePng });
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs'), job = pdfjs.getDocument({ data: new Uint8Array(await blob.arrayBuffer()), disableFontFace: true });
  try {
    const page = await (await job.promise).getPage(2), items = (await page.getTextContent()).items.filter(item => item.str.includes('가'));
    assert.equal(items.length, 1); assert.ok(items[0].str.endsWith('…'), items[0].str);
    assert.ok(items[0].transform[4] + items[0].width <= 595 - 48 + 0.5, `${items[0].transform[4] + items[0].width}`);
  } finally { await job.destroy(); }
});
test('crop and scale keeps the crop and bounds the longest side', () => {
  const width = 10, rgba = new Uint8ClampedArray(width * 10 * 4); for (let i = 0; i < 100; i++) rgba[i * 4] = i;
  const crop = cropScale(rgba, width, 2, 3, 4, 2, 100); assert.deepEqual([crop.width, crop.height], [4, 2]); assert.equal(crop.rgba[0], 32);
  const small = cropScale(rgba, width, 0, 0, 10, 10, 5); assert.deepEqual([small.width, small.height], [5, 5]);
});
