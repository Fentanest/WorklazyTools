import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, rgb, type PDFFont } from "pdf-lib";
import type { AppLanguage } from "../../i18n/languages";
import { parseHocrDocument, calculateWordTransform, scaleOcrPageToPdfPoints } from "./bentoHocrTransform";
import type { OcrPage, OcrWord } from "./bentoOcrTypes";
import type { BentoPageProfile } from "./bentoPdfClient";
import { hasAdequateOcrLayer, selectPagesWithBento } from "./bentoPdfClient";
import { renderPdfPageForOcrCanvas } from "./pdfPreview";

interface PreparedPage { sourcePageIndex: number; method: "ocr" | "existing-ocr" | "image-fallback" | "digital"; warnings: string[] }

/** Bento OCR's hOCR geometry/text placement applied to individual raster pages.
 * Digital pages are copied unchanged. On scanned pages, dark neutral glyph ink
 * is cleared inside recognized word boxes before editable glyphs are drawn. */
export async function prepareOcrPdfForDocx(
  file: File,
  selection: number[],
  profiles: BentoPageProfile[],
  hocrBySourceIndex: ReadonlyMap<number, string>,
  language: AppLanguage,
  signal?: AbortSignal,
  onProgress?: (value: number) => void,
): Promise<{ pdf: Blob; pages: PreparedPage[] }> {
  const normalized = await selectPagesWithBento(file, selection, signal);
  const original = await PDFDocument.load(await normalized.arrayBuffer());
  const output = await PDFDocument.create();
  output.registerFontkit(fontkit);
  let font: PDFFont | undefined;
  const pageResults: PreparedPage[] = [];
  const bySource = new Map(profiles.map(profile => [profile.pageIndex, profile]));
  for (const [index, sourcePageIndex] of selection.entries()) {
    if (signal?.aborted) throw new DOMException("Conversion cancelled", "AbortError");
    const profile = bySource.get(sourcePageIndex);
    const hocr = hocrBySourceIndex.get(sourcePageIndex);
    const existing = !hocr && profile && hasAdequateOcrLayer(profile);
    const scanFallback = !hocr && profile && profile.imageCoverage >= .55 && !existing;
    const rebuildVisible = !hocr && !existing && !scanFallback && profile && profile.rotation % 360 !== 0 && (profile.visibleSpans?.length ?? 0) > 0;
    if (!hocr && !existing && !scanFallback && !rebuildVisible) {
      output.addPage((await output.copyPages(original, [index]))[0]);
      pageResults.push({ sourcePageIndex, method: "digital", warnings: [] });
      continue;
    }
    const warnings: string[] = [];
    const canvas = await renderPdfPageForOcrCanvas(file, sourcePageIndex, language, signal);
    try {
      const width = profile?.width ?? canvas.width;
      const height = profile?.height ?? canvas.height;
      if (rebuildVisible || scanFallback) {
        // pdf2docx 0.5.8 omits text on a rotated digital page even after
        // PyMuPDF.remove_rotation(). Keep the complete displayed source page,
        // including annotations, rather than claiming dropped text succeeded.
        const image = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("PDF_PAGE_ENCODE_FAILED")), "image/jpeg", .95));
        const page = output.addPage([width, height]);
        page.drawImage(await output.embedJpg(await image.arrayBuffer()), { x: 0, y: 0, width, height });
        pageResults.push({ sourcePageIndex, method: "image-fallback", warnings: [scanFallback
          ? language === "ko" ? "인식된 본문 글자가 없어 원본 스캔 페이지를 이미지로 보존했습니다. 글자는 편집할 수 없습니다." : "No body text was recognized; the source scan page was preserved as an image and its text is not editable."
          : language === "ko" ? "회전된 원본 페이지를 이미지로 보존했습니다. 이 페이지의 글자는 편집할 수 없습니다." : "The rotated source page was preserved as an image. Text on this page is not editable."] });
        continue;
      }
      let ocrPage: OcrPage;
      if (hocr) ocrPage = parseHocrDocument(hocr);
      else {
        const spans = existing ? profile?.hiddenSpans ?? [] : profile?.visibleSpans ?? [];
        ocrPage = {
          width: canvas.width, height: canvas.height, dpi: 72,
          lines: spans.map(span => {
            const bbox = { x0: span.bbox[0] * canvas.width / width, y0: span.bbox[1] * canvas.height / height, x1: span.bbox[2] * canvas.width / width, y1: span.bbox[3] * canvas.height / height };
            const word: OcrWord = { text: span.text, bbox, confidence: 100 };
            return { bbox, words: [word], baseline: { slope: 0, intercept: 0 }, textangle: 0, direction: "ltr" as const, injectWordBreaks: false };
          }),
        };
      }
      if (hocr && profile && (profile.visibleSpans.length || profile.hiddenSpans.length)) {
        for (const span of [...profile.visibleSpans, ...profile.hiddenSpans]) {
          const normalized = span.text.replace(/\s+/g, "").toLocaleLowerCase();
          const recognized = ocrPage.lines.some(line => line.words.map(word => word.text).join("").replace(/\s+/g, "").toLocaleLowerCase() === normalized || line.words.some(word => word.text.replace(/\s+/g, "").toLocaleLowerCase() === normalized));
          if (recognized) continue;
          const bbox = { x0: span.bbox[0] * canvas.width / width, y0: span.bbox[1] * canvas.height / height, x1: span.bbox[2] * canvas.width / width, y1: span.bbox[3] * canvas.height / height };
          ocrPage.lines.push({ bbox, words: [{ text: span.text, bbox, confidence: 100 }], baseline: { slope: 0, intercept: 0 }, textangle: 0, direction: "ltr", injectWordBreaks: false });
        }
      }
      if (!ocrPage.lines.some(line => line.words.some(word => word.text.trim()))) {
        output.addPage((await output.copyPages(original, [index]))[0]);
        pageResults.push({ sourcePageIndex, method: "image-fallback", warnings: [language === "ko" ? "인식된 글자가 없어 원본 페이지 이미지를 보존했습니다." : "No text was recognized; the original page image was preserved."] });
        continue;
      }
      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) throw new Error("OCR_PAGE_CANVAS_UNAVAILABLE");
      // Bento hOCR boxes are in the same canvas coordinates used for recognition.
      const effectiveScaleX = canvas.width / Math.max(1, ocrPage.width);
      const effectiveScaleY = canvas.height / Math.max(1, ocrPage.height);
      const coloredOverlap = ocrPage.lines.some(line => line.words.some(word => hasColoredOverlap(context,
        word.bbox.x0 * effectiveScaleX, word.bbox.y0 * effectiveScaleY, word.bbox.x1 * effectiveScaleX, word.bbox.y1 * effectiveScaleY)));
      if (coloredOverlap) {
        const image = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("PDF_PAGE_ENCODE_FAILED")), "image/jpeg", .95));
        const page = output.addPage([width, height]);
        page.drawImage(await output.embedJpg(await image.arrayBuffer()), { x: 0, y: 0, width, height });
        pageResults.push({ sourcePageIndex, method: "image-fallback", warnings: [language === "ko" ? "OCR 글자 영역이 색상 그림·도장과 겹쳐 원본 페이지 이미지를 보존했습니다. 글자는 편집할 수 없습니다." : "OCR text overlaps a colored picture or stamp; the source page was preserved as an image and its text is not editable."] });
        continue;
      }
      for (const line of ocrPage.lines) for (const word of line.words) {
        clearNeutralInk(context, word.bbox.x0 * effectiveScaleX, word.bbox.y0 * effectiveScaleY, word.bbox.x1 * effectiveScaleX, word.bbox.y1 * effectiveScaleY);
      }
      const image = await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("OCR_PAGE_ENCODE_FAILED")), "image/jpeg", .92));
      if (!font) {
        const base = new URL(import.meta.env.BASE_URL, window.location.origin);
        const response = await fetch(new URL("vendor/zetaoffice/2026-10-07/NanumGothic-Regular.ttf", base), { signal });
        if (!response.ok) throw new Error("OCR_FONT_UNAVAILABLE");
        font = await output.embedFont(await response.arrayBuffer(), { subset: false });
      }
      const page = output.addPage([width, height]);
      const embedded = await output.embedJpg(await image.arrayBuffer());
      page.drawImage(embedded, { x: 0, y: 0, width, height });
      scaleOcrPageToPdfPoints(ocrPage, width, height);
      let dropped = 0;
      for (const line of ocrPage.lines) for (const word of line.words) {
        const text = word.text.replace(/[\p{Cc}\p{Cf}]/gu, "").trim();
        if (!text) continue;
        try {
          const placement = calculateWordTransform(word, line, height, (value, size) => font!.widthOfTextAtSize(value, size));
          // pdf2docx 0.5.8 drops every line whose direction is not exactly
          // horizontal or vertical. hOCR baseline noise can rotate a word by
          // a fraction of a degree and silently lose otherwise valid text.
          page.drawText(text, { x: placement.x, y: placement.y, size: placement.fontSize, font, color: rgb(0, 0, 0) });
        } catch { dropped += 1; }
      }
      if (dropped) warnings.push(language === "ko" ? `${dropped}개 글자 영역을 배치하지 못했습니다.` : `${dropped} recognized text regions could not be placed.`);
      pageResults.push({ sourcePageIndex, method: existing ? "existing-ocr" : "ocr", warnings });
    } finally { canvas.width = 1; canvas.height = 1; }
    onProgress?.(30 + 40 * (index + 1) / selection.length);
  }
  if (signal?.aborted) throw new DOMException("Conversion cancelled", "AbortError");
  return { pdf: new Blob([new Uint8Array(await output.save())], { type: "application/pdf" }), pages: pageResults };
}

function hasColoredOverlap(context: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
  const left = Math.max(0, Math.floor(x0));
  const top = Math.max(0, Math.floor(y0));
  const width = Math.min(context.canvas.width - left, Math.ceil(x1 - x0));
  const height = Math.min(context.canvas.height - top, Math.ceil(y1 - y0));
  if (width <= 0 || height <= 0) return false;
  const pixels = context.getImageData(left, top, width, height).data;
  let colored = 0;
  const limit = Math.max(12, width * height * .005);
  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index], green = pixels[index + 1], blue = pixels[index + 2];
    if (Math.max(red, green, blue) - Math.min(red, green, blue) > 45 && Math.min(red, green, blue) < 210 && ++colored >= limit) return true;
  }
  return false;
}

function clearNeutralInk(context: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
  const left = Math.max(0, Math.floor(x0 - 3));
  const top = Math.max(0, Math.floor(y0 - 3));
  const width = Math.min(context.canvas.width - left, Math.ceil(x1 - x0 + 6));
  const height = Math.min(context.canvas.height - top, Math.ceil(y1 - y0 + 6));
  if (width <= 0 || height <= 0) return;
  const pixels = context.getImageData(left, top, width, height);
  // Preserve colored picture/stamp pixels even when OCR boxes overlap them.
  // Only neutral ink and its light antialias fringes are removed.
  for (let i = 0; i < pixels.data.length; i += 4) {
    const r = pixels.data[i], g = pixels.data[i + 1], b = pixels.data[i + 2];
    if (Math.max(r, g, b) - Math.min(r, g, b) <= 32 && (r + g + b) / 3 < 250) {
      pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = 255;
    }
  }
  context.putImageData(pixels, left, top);
}
