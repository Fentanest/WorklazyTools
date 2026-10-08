import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, degrees, rgb, type PDFFont } from "pdf-lib";
import type { AppLanguage } from "../../i18n/languages";
import { parseHocrDocument, calculateWordTransform, calculateSpaceTransform, scaleOcrPageToPdfPoints } from "./bentoHocrTransform";
import { selectPagesWithBento } from "./bentoPdfClient";

/** BentoPDF OCR text-layer geometry, applied only to pages Tesseract recognized.
 * Original PDF pages, images, drawings, annotations and existing OCR remain. */
export async function createSearchablePdf(
  file: File,
  selection: number[],
  hocrBySourceIndex: ReadonlyMap<number, string>,
  language: AppLanguage,
  signal?: AbortSignal,
): Promise<{ blob: Blob; warnings: string[] }> {
  const normalized = await selectPagesWithBento(file, selection, signal);
  if (!hocrBySourceIndex.size) return { blob: normalized, warnings: [] };
  const pdf = await PDFDocument.load(await normalized.arrayBuffer());
  pdf.registerFontkit(fontkit);
  const base = new URL(import.meta.env.BASE_URL, window.location.origin);
  const response = await fetch(new URL("vendor/zetaoffice/2026-10-07/NanumGothic-Regular.ttf", base), { signal });
  if (!response.ok) throw new Error("OCR_FONT_UNAVAILABLE");
  const font = await pdf.embedFont(await response.arrayBuffer(), { subset: false });
  const warnings: string[] = [];
  for (const [inputIndex, sourcePageIndex] of selection.entries()) {
    if (signal?.aborted) throw new DOMException("Conversion cancelled", "AbortError");
    const hocr = hocrBySourceIndex.get(sourcePageIndex);
    if (!hocr) continue;
    const page = pdf.getPage(inputIndex);
    if (page.getRotation().angle % 360) {
      warnings.push(language === "ko" ? `원본 ${sourcePageIndex + 1}페이지의 회전된 OCR 글자는 정확히 배치할 수 없어 원본을 보존했습니다.` : `OCR text on rotated source page ${sourcePageIndex + 1} could not be placed accurately; the original page was preserved.`);
      continue;
    }
    const crop = page.getCropBox();
    const ocrPage = parseHocrDocument(hocr);
    scaleOcrPageToPdfPoints(ocrPage, crop.width, crop.height);
    let dropped = 0;
    // Ported placement from BentoPDF src/js/utils/ocr.ts drawOcrTextLayer,
    // commit 3a5f146d1b89d54dc7ca576aa6797c8bd3e42b97.
    for (const line of ocrPage.lines) {
      const words = line.direction === "rtl" ? [...line.words].reverse() : line.words;
      const rotation = degrees(-line.textangle + Math.atan(line.baseline.slope) * 180 / Math.PI);
      for (const [wordIndex, word] of words.entries()) {
        const text = word.text.replace(/[\p{Cc}\p{Cf}]/gu, "").trim();
        if (!text) continue;
        try {
          const placement = calculateWordTransform(word, line, crop.height, (value, size) => font.widthOfTextAtSize(value, size));
          page.drawText(text, { x: crop.x + placement.x, y: crop.y + placement.y, font, size: placement.fontSize, color: rgb(0, 0, 0), opacity: 0, rotate: rotation });
          if (line.injectWordBreaks && wordIndex < words.length - 1) drawSpace(page, word, words[wordIndex + 1], line, crop, font, rotation);
        } catch { dropped += 1; }
      }
    }
    if (dropped) warnings.push(language === "ko" ? `원본 ${sourcePageIndex + 1}페이지에서 OCR 단어 ${dropped}개를 배치하지 못했습니다.` : `${dropped} OCR words could not be placed on source page ${sourcePageIndex + 1}.`);
  }
  if (signal?.aborted) throw new DOMException("Conversion cancelled", "AbortError");
  return { blob: new Blob([new Uint8Array(await pdf.save())], { type: "application/pdf" }), warnings };
}

function drawSpace(page: ReturnType<PDFDocument["getPage"]>, word: Parameters<typeof calculateSpaceTransform>[0], next: Parameters<typeof calculateSpaceTransform>[1], line: Parameters<typeof calculateSpaceTransform>[2], crop: { x: number; y: number; height: number }, font: PDFFont, rotation: ReturnType<typeof degrees>) {
  const placement = calculateSpaceTransform(word, next, line, crop.height, size => font.widthOfTextAtSize(" ", size));
  if (!placement || placement.horizontalScale <= .1) return;
  page.drawText(" ", { x: crop.x + placement.x, y: crop.y + placement.y, font, size: placement.fontSize, color: rgb(0, 0, 0), opacity: 0, rotate: rotation });
}
