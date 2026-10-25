import type { ImageCompareResult, Region } from '../image-compare/types.ts';
import { createPdfDocument, embedCustomPdfFont, getPdfFontCharacterSet, rgb, type PDFDocument, type PDFFont } from '../../utils/pdfFontEmbed.ts';
import { displayGrapheme } from './pdf.ts';
import { assertOutput, assertReport, type ExportSnapshot } from './snapshot.ts';
import type { ImageExportProjection } from './imageAdapter.ts';

/** Layout of Diffchecker 7.3.0's image PDF report (module 36826): results page with the
 * difference image, a source-images page, then detected changes three per page, numbered pages. */
export const IMAGE_PDF_COPY = {
  en: { title: 'Image comparison report', generated: 'Generated', result: 'Comparison result', view: 'View', changed: 'Changed', pixels: 'Pixels changed', sensitivity: 'Sensitivity', regions: 'Detected regions', difference: 'Difference', sources: 'Source images', files: 'Files used for this comparison', original: 'Original', revised: 'Changed', detected: 'Detected changes', change: 'Change', page: 'Page {n} of {total}', regionCount: '{count} detected regions', none: 'No regions were detected. Run a region scan to list changes.', projections: { left: 'Original', right: 'Changed', highlight: 'Highlight', subtract: 'Difference brightness' } },
  ko: { title: '이미지 비교 보고서', generated: '만든 시각', result: '비교 결과', view: '보기', changed: '변경 비율', pixels: '변경 픽셀', sensitivity: '민감도', regions: '찾은 영역', difference: '차이', sources: '원본 이미지', files: '비교에 쓴 파일', original: '원본', revised: '수정본', detected: '찾은 변경', change: '변경', page: '{n} / {total}쪽', regionCount: '찾은 영역 {count}개', none: '찾은 영역이 없습니다. 변경 영역 찾기를 실행하면 목록이 들어갑니다.', projections: { left: '원본', right: '수정본', highlight: '차이 강조', subtract: '차이 밝기' } },
} as const;

export type PngEncoder = (width: number, height: number, rgba: Uint8ClampedArray) => Promise<Uint8Array>;
/** Browser PNG encoder through a canvas. */
export const canvasPngEncoder: PngEncoder = async (width, height, rgba) => {
  const canvas = new OffscreenCanvas(width, height), context = canvas.getContext('2d');
  assertReport(context, 'REPORT_CAPTURE');
  context.putImageData(new ImageData(Uint8ClampedArray.from(rgba), width, height), 0, 0);
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return new Uint8Array(await blob.arrayBuffer());
};

// Embedded images are reduced to this longest side; the page shows them smaller still.
const EMBED_SIDE = 1600;
const PAGE = { width: 595, height: 842, margin: 48 };

/** Crop then downscale (nearest sample) an RGBA image to fit `maxSide`. */
export function cropScale(rgba: Uint8ClampedArray, width: number, x: number, y: number, cropWidth: number, cropHeight: number, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(cropWidth, cropHeight));
  const w = Math.max(1, Math.round(cropWidth * scale)), h = Math.max(1, Math.round(cropHeight * scale)), out = new Uint8ClampedArray(w * h * 4);
  for (let row = 0; row < h; row++) for (let column = 0; column < w; column++) {
    const sx = x + Math.min(cropWidth - 1, Math.floor((column + 0.5) / scale)), sy = y + Math.min(cropHeight - 1, Math.floor((row + 0.5) / scale));
    out.set(rgba.subarray((sy * width + sx) * 4, (sy * width + sx) * 4 + 4), (row * w + column) * 4);
  }
  return { width: w, height: h, rgba: out };
}

export async function writeImagePdfReport(input: { snapshot: ExportSnapshot; result: ImageCompareResult; regions: readonly Region[]; projection: ImageExportProjection; signal: AbortSignal; fontBytes: Uint8Array; encodePng?: PngEncoder }): Promise<Blob> {
  const { snapshot, result, regions, projection, signal, fontBytes } = input, encode = input.encodePng ?? canvasPngEncoder;
  const c = IMAGE_PDF_COPY[snapshot.language];
  const document = await createPdfDocument(), font = await embedCustomPdfFont(document, fontBytes, { subset: true });
  signal.throwIfAborted();
  const embed = async (rgba: Uint8ClampedArray, x = 0, y = 0, w = result.width, h = result.height, side = EMBED_SIDE) => {
    const image = cropScale(rgba, result.width, x, y, w, h, side); signal.throwIfAborted();
    return document.embedPng(await encode(image.width, image.height, image.rgba));
  };
  // File names may hold characters the font lacks: they are shown as [U+XXXX] like the text report.
  const coverage = new Set(getPdfFontCharacterSet(fontBytes)), segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' });
  const show = (text: string) => Array.from(segmenter.segment(text), item => displayGrapheme(item.segment, coverage)).join('');
  const write = (page: ReturnType<PDFDocument['addPage']>, text: string, x: number, y: number, size: number, f: PDFFont = font, color = rgb(0.08, 0.08, 0.1)) => page.drawText(show(text), { x, y, size, font: f, color });
  const fit = (width: number, height: number, maxWidth: number, maxHeight: number) => { const s = Math.min(maxWidth / width, maxHeight / height); return { width: width * s, height: height * s }; };
  const contentWidth = PAGE.width - 2 * PAGE.margin;
  // 1. Results.
  let page = document.addPage([PAGE.width, PAGE.height]); let y = PAGE.height - PAGE.margin - 20;
  write(page, c.title, PAGE.margin, y, 20); y -= 22;
  write(page, `${c.generated} ${snapshot.createdAt.replace('T', ' ').replace(/\.\d+Z$/u, ' UTC')}`, PAGE.margin, y, 10, font, rgb(0.35, 0.37, 0.42)); y -= 30;
  write(page, c.result, PAGE.margin, y, 13); y -= 20;
  const stats: [string, string][] = [[c.view, c.projections[projection]], [c.changed, `${(100 * result.differenceRatio).toFixed(2)}%`], [c.pixels, result.changedPixelCount.toLocaleString('en-US')],
    [c.sensitivity, String(result.options.threshold)], [c.regions, String(regions.length)]];
  for (const [label, value] of stats) { write(page, label, PAGE.margin, y, 10, font, rgb(0.35, 0.37, 0.42)); write(page, value, PAGE.margin + 150, y, 10); y -= 16; }
  y -= 10; write(page, c.difference, PAGE.margin, y, 13); y -= 8;
  const differencePixels = projection === 'left' ? result.left : projection === 'right' ? result.right : projection === 'subtract' ? result.subtract : result.overlay;
  const difference = await embed(differencePixels), size = fit(difference.width, difference.height, contentWidth, y - PAGE.margin - 20);
  page.drawImage(difference, { x: PAGE.margin, y: y - size.height, width: size.width, height: size.height });
  // 2. Source images.
  page = document.addPage([PAGE.width, PAGE.height]); y = PAGE.height - PAGE.margin - 16;
  write(page, c.sources, PAGE.margin, y, 16); y -= 18; write(page, c.files, PAGE.margin, y, 10, font, rgb(0.35, 0.37, 0.42)); y -= 20;
  const half = (PAGE.height - 2 * PAGE.margin - 110) / 2;
  for (const side of ['left', 'right'] as const) {
    const source = result.sources[side];
    write(page, `${side === 'left' ? c.original : c.revised}: ${source.name}`, PAGE.margin, y, 11); y -= 14;
    write(page, `${source.width} x ${source.height} px`, PAGE.margin, y, 9, font, rgb(0.35, 0.37, 0.42)); y -= 6;
    const image = await embed(result[side]), box = fit(image.width, image.height, contentWidth, half - 30);
    page.drawImage(image, { x: PAGE.margin, y: y - box.height, width: box.width, height: box.height }); y -= box.height + 24;
  }
  // 3. Detected changes, three per page: original, changed and difference crops.
  const pagesForRegions = Math.max(1, Math.ceil(regions.length / 3));
  for (let p = 0; p < pagesForRegions; p++) {
    page = document.addPage([PAGE.width, PAGE.height]); y = PAGE.height - PAGE.margin - 16;
    write(page, c.detected, PAGE.margin, y, 16); y -= 18; write(page, c.regionCount.replace('{count}', String(regions.length)), PAGE.margin, y, 10, font, rgb(0.35, 0.37, 0.42)); y -= 22;
    if (!regions.length) { write(page, c.none, PAGE.margin, y, 10); break; }
    for (const [index, region] of regions.slice(p * 3, p * 3 + 3).entries()) {
      signal.throwIfAborted();
      const b = region.bounds, number = p * 3 + index + 1;
      write(page, `${c.change} ${number} · ${b.width} x ${b.height} px @ ${b.x},${b.y}`, PAGE.margin, y, 11); y -= 8;
      const cellWidth = (contentWidth - 16) / 3, cellHeight = 180;
      for (const [column, [pixels, label]] of ([[result.left, c.original], [result.right, c.revised], [result.overlay, c.difference]] as const).entries()) {
        const crop = await embed(pixels, b.x, b.y, b.width, b.height, 600), box = fit(crop.width, crop.height, cellWidth, cellHeight - 14), x = PAGE.margin + column * (cellWidth + 8);
        write(page, label, x, y - 10, 9, font, rgb(0.35, 0.37, 0.42));
        page.drawRectangle({ x, y: y - 14 - box.height, width: box.width, height: box.height, borderColor: rgb(0.8, 0.82, 0.86), borderWidth: 0.75 });
        page.drawImage(crop, { x, y: y - 14 - box.height, width: box.width, height: box.height });
      }
      y -= cellHeight + 24;
    }
  }
  // Page numbers on every page.
  const pages = document.getPages();
  pages.forEach((item, index) => { const text = c.page.replace('{n}', String(index + 1)).replace('{total}', String(pages.length)); item.drawText(text, { x: PAGE.width - PAGE.margin - font.widthOfTextAtSize(text, 9), y: PAGE.margin / 2, size: 9, font, color: rgb(0.45, 0.47, 0.52) }); });
  signal.throwIfAborted();
  const bytes = await document.save(); signal.throwIfAborted();
  return assertOutput(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: 'application/pdf' }));
}
