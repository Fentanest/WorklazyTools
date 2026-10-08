import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, degrees, rgb, type PDFFont } from "pdf-lib";
import type { AppLanguage } from "../../i18n/languages";
import { parseHocrDocument, calculateWordTransform, calculateSpaceTransform, scaleOcrPageToPdfPoints } from "./bentoHocrTransform";
import { selectPagesWithBento, type BentoPageProfile } from "./bentoPdfClient";
import { renderPdfPageForDocument } from "./pdfPreview";

/** BentoPDF OCR text-layer geometry, applied only to pages Tesseract recognized.
 * Original PDF pages, images, drawings, annotations and existing OCR remain. */
export async function createSearchablePdf(
  file: File,
  selection: number[],
  originalPageCount: number,
  hocrBySourceIndex: ReadonlyMap<number, string>,
  profiles: readonly BentoPageProfile[],
  language: AppLanguage,
  signal?: AbortSignal,
): Promise<{ blob: Blob; warnings: string[]; addedSourceIndexes: number[] }> {
  const identity = selection.length === originalPageCount && selection.every((sourceIndex, index) => sourceIndex === index);
  if (!hocrBySourceIndex.size && identity) return { blob: file, warnings: [], addedSourceIndexes: [] };
  const normalized = await selectPagesWithBento(file, selection, signal);
  if (!hocrBySourceIndex.size) return { blob: normalized, warnings: [], addedSourceIndexes: [] };
  const source = await PDFDocument.load(await normalized.arrayBuffer());
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const base = new URL(import.meta.env.BASE_URL, window.location.origin);
  const response = await fetch(new URL("vendor/zetaoffice/2026-10-07/NanumGothic-Regular.ttf", base), { signal });
  if (!response.ok) throw new Error("OCR_FONT_UNAVAILABLE");
  const font = await pdf.embedFont(await response.arrayBuffer(), { subset: false });
  const warnings: string[] = [];
  const addedSourceIndexes: number[] = [];
  const profileBySource = new Map(profiles.map(profile => [profile.pageIndex, profile]));
  for (const [inputIndex, sourcePageIndex] of selection.entries()) {
    if (signal?.aborted) throw new DOMException("Conversion cancelled", "AbortError");
    const hocr = hocrBySourceIndex.get(sourcePageIndex);
    const sourcePage = source.getPage(inputIndex);
    const originalSpans = profileBySource.get(sourcePageIndex);
    let page: ReturnType<PDFDocument["getPage"]>;
    let crop: { x: number; y: number; width: number; height: number };
    const rasterized = Boolean(hocr && sourcePage.getRotation().angle % 360);
    if (rasterized) {
      const rendered = await renderPdfPageForDocument(file, sourcePageIndex, language, signal);
      page = pdf.addPage([rendered.width, rendered.height]);
      page.drawImage(await pdf.embedJpg(await rendered.blob.arrayBuffer()), { x: 0, y: 0, width: rendered.width, height: rendered.height });
      crop = { x: 0, y: 0, width: rendered.width, height: rendered.height };
      let omitted = 0;
      for (const span of [...(originalSpans?.visibleSpans ?? []), ...(originalSpans?.hiddenSpans ?? [])]) {
        try { drawPreservedSpan(page, span, crop.height, font); }
        catch { omitted += 1; }
      }
      if (omitted) warnings.push(language === "ko" ? `원본 ${sourcePageIndex + 1}페이지의 기존 글자 ${omitted}개를 다시 배치하지 못했습니다.` : `${omitted} existing text spans could not be retained on source page ${sourcePageIndex + 1}.`);
      warnings.push(language === "ko" ? `원본 ${sourcePageIndex + 1}페이지는 회전된 스캔 모양을 보존해 OCR 글자를 배치했습니다.` : `Rotated scan appearance was preserved while placing OCR text on source page ${sourcePageIndex + 1}.`);
    } else {
      page = pdf.addPage((await pdf.copyPages(source, [inputIndex]))[0]);
      crop = page.getCropBox();
    }
    if (!hocr) continue;
    const ocrPage = parseHocrDocument(hocr);
    scaleOcrPageToPdfPoints(ocrPage, crop.width, crop.height);
    let dropped = 0, added = 0;
    const retained = [...(originalSpans?.hiddenSpans ?? []), ...(originalSpans?.visibleSpans ?? [])];
    // Ported placement from BentoPDF src/js/utils/ocr.ts drawOcrTextLayer,
    // commit 3a5f146d1b89d54dc7ca576aa6797c8bd3e42b97.
    for (const line of ocrPage.lines) {
      const words = line.direction === "rtl" ? [...line.words].reverse() : line.words;
      const rotation = degrees(-line.textangle + Math.atan(line.baseline.slope) * 180 / Math.PI);
      for (const [wordIndex, word] of words.entries()) {
        const text = word.text.replace(/[\p{Cc}\p{Cf}]/gu, "").trim();
        if (!text) continue;
        if (retained.some(span => sameOriginalWord(span, word))) continue;
        try {
          const placement = calculateWordTransform(word, line, crop.height, (value, size) => font.widthOfTextAtSize(value, size));
          page.drawText(text, { x: crop.x + placement.x, y: crop.y + placement.y, font, size: placement.fontSize, color: rgb(0, 0, 0), opacity: 0, rotate: rotation });
          added += 1;
          if (line.injectWordBreaks && wordIndex < words.length - 1) drawSpace(page, word, words[wordIndex + 1], line, crop, font, rotation);
        } catch { dropped += 1; }
      }
    }
    if (added) addedSourceIndexes.push(sourcePageIndex);
    if (dropped) warnings.push(language === "ko" ? `원본 ${sourcePageIndex + 1}페이지에서 OCR 단어 ${dropped}개를 배치하지 못했습니다.` : `${dropped} OCR words could not be placed on source page ${sourcePageIndex + 1}.`);
  }
  if (signal?.aborted) throw new DOMException("Conversion cancelled", "AbortError");
  return { blob: new Blob([new Uint8Array(await pdf.save())], { type: "application/pdf" }), warnings, addedSourceIndexes };
}

function drawPreservedSpan(page: ReturnType<PDFDocument["getPage"]>, span: BentoPageProfile["hiddenSpans"][number], pageHeight: number, font: PDFFont) {
  const text = span.text.replace(/[\p{Cc}\p{Cf}]/gu, "").trim();
  if (!text) return;
  const [x0, y0, x1, y1] = span.bbox;
  const bbox = { x0, y0, x1, y1 };
  const word = { text, bbox, confidence: 100 };
  const line = { bbox, baseline: { slope: 0, intercept: 0 }, textangle: 0, words: [word], direction: "ltr" as const, injectWordBreaks: false };
  const placement = calculateWordTransform(word, line, pageHeight, (value, size) => font.widthOfTextAtSize(value, size));
  page.drawText(text, { x: placement.x, y: placement.y, font, size: placement.fontSize, opacity: 0, color: rgb(0, 0, 0) });
}

function sameOriginalWord(span: BentoPageProfile["hiddenSpans"][number], word: Parameters<typeof calculateWordTransform>[0]) {
  const text = word.text.normalize("NFKC").replace(/\s+/g, "").toLocaleLowerCase();
  const existing = span.text.normalize("NFKC").replace(/\s+/g, "").toLocaleLowerCase();
  if (!text || !existing.includes(text)) return false;
  const [x0, y0, x1, y1] = span.bbox;
  const overlap = Math.max(0, Math.min(x1, word.bbox.x1) - Math.max(x0, word.bbox.x0)) * Math.max(0, Math.min(y1, word.bbox.y1) - Math.max(y0, word.bbox.y0));
  const wordArea = Math.max(1, (word.bbox.x1 - word.bbox.x0) * (word.bbox.y1 - word.bbox.y0));
  return overlap / wordArea >= .4;
}

function drawSpace(page: ReturnType<PDFDocument["getPage"]>, word: Parameters<typeof calculateSpaceTransform>[0], next: Parameters<typeof calculateSpaceTransform>[1], line: Parameters<typeof calculateSpaceTransform>[2], crop: { x: number; y: number; height: number }, font: PDFFont, rotation: ReturnType<typeof degrees>) {
  const placement = calculateSpaceTransform(word, next, line, crop.height, size => font.widthOfTextAtSize(" ", size));
  if (!placement || placement.horizontalScale <= .1) return;
  page.drawText(" ", { x: crop.x + placement.x, y: crop.y + placement.y, font, size: placement.fontSize, color: rgb(0, 0, 0), opacity: 0, rotate: rotation });
}
