import type { AppLanguage } from "../../i18n/languages";
import { convertWithBentoPdf } from "./bentoPdfClient";
import { createPageImageDocument } from "./pdfPageImageDocument";
import { extractPdfText, inspectPdf, releasePdf, type PdfOcrMode } from "./pdfPreview";
import { combineOcrPdfPages, mergePdfPages, textDocumentToOffice } from "./pdfWorkerClient";
import { PdfConversionError } from "./pdfConversionErrors";
import type { WorkerProgress } from "./types";

export type PdfDocumentFormat = "docx" | "xlsx" | "txt" | "pptx" | "hwpx" | "searchable-pdf";
export type PdfOutputMode = "editable" | "page-image";
export interface PdfDocumentConversionRequest {
  source: File | Blob;
  fileName: string;
  format: PdfDocumentFormat;
  selectedPageIndexes?: readonly number[];
  ocrMode: PdfOcrMode;
  ocrLanguage: "kor" | "eng" | "kor+eng";
  ocrLayout: "sparse" | "paragraphs";
  outputMode: PdfOutputMode;
  language: AppLanguage;
  signal?: AbortSignal;
  onProgress?: WorkerProgress;
}
export interface PdfPageConversionResult {
  sourcePageIndex: number;
  inputPageIndex: number;
  status: "converted" | "image-preserved" | "ocr" | "blank-preserved";
  warnings: string[];
}
export interface PdfDocumentConversionResult {
  blob: Blob;
  fileName: string;
  mimeType: string;
  warnings: string[];
  pages: PdfPageConversionResult[];
}

const MIME: Record<PdfDocumentFormat, string> = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  txt: "text/plain;charset=utf-8",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  hwpx: "application/hwp+zip",
  "searchable-pdf": "application/pdf",
};

export function normalizeSelectedPages(selected: readonly number[] | undefined, count: number) {
  if (selected === undefined) return Array.from({ length: count }, (_, index) => index);
  const result: number[] = [];
  const seen = new Set<number>();
  for (const index of selected) {
    if (!Number.isInteger(index) || index < 0 || index >= count) throw new PdfConversionError("INVALID_RANGE", { count });
    if (!seen.has(index)) { result.push(index); seen.add(index); }
  }
  if (!result.length) throw new PdfConversionError("INVALID_RANGE", { count });
  return result;
}

/** Browser-only common entrypoint for the single-file and batch workflows. */
export async function convertPdfDocument(request: PdfDocumentConversionRequest): Promise<PdfDocumentConversionResult> {
  const file = request.source instanceof File ? request.source : new File([request.source], request.fileName, { type: "application/pdf" });
  const { format, language, signal, onProgress, fileName } = request;
  const failIfCanceled = () => { if (signal?.aborted) throw new DOMException("Conversion cancelled", "AbortError"); };
  failIfCanceled();
  try {
    const inspected = await inspectPdf(file, language, { signal });
    const selection = normalizeSelectedPages(request.selectedPageIndexes, inspected.pageCount);
    const pageResults: PdfPageConversionResult[] = selection.map((sourcePageIndex, inputPageIndex) => ({ sourcePageIndex, inputPageIndex, status: "converted", warnings: [] }));
    const stem = fileName.trim().replace(/\.[^.]+$/, "") || "worklazy-result";
    let imageMode = request.outputMode === "page-image" && (format === "docx" || format === "pptx" || format === "hwpx");
    if (!imageMode && request.ocrMode === "off" && (format === "docx" || format === "pptx" || format === "hwpx")) {
      const text = await extractPdfText(file, "off", false, undefined, selection, language, signal);
      // An image-only input can still make a valid document. Preserve all its
      // pages and tell the user that the pictured text is not editable.
      imageMode = text.document.characterCount === 0;
    }
    if (imageMode && (format === "docx" || format === "pptx" || format === "hwpx")) {
      const output = await createPageImageDocument(file, selection, format, stem, language, onProgress, signal);
      for (const page of pageResults) page.status = "image-preserved";
      return { blob: output.blob, fileName: output.fileName, mimeType: output.mimeType, warnings: output.warnings, pages: pageResults };
    }
    if (format === "docx" || format === "xlsx") {
      const identity = selection.length === inspected.pageCount && selection.every((index, position) => index === position);
      let input: Blob = file;
      if (!identity) {
        onProgress?.(2, language === "ko" ? "선택한 페이지 순서 정리 중" : "Ordering selected pages");
        const combined = await mergePdfPages([{ id: "source", file }], selection.map(pageIndex => ({ sourceId: "source", pageIndex, rotation: 0 })), "selected.pdf", undefined, language, {}, signal);
        input = new Blob([combined.buffer], { type: "application/pdf" });
      }
      failIfCanceled();
      const converted = await convertWithBentoPdf(input, format, stem, signal, value => onProgress?.(8 + value * 0.9, language === "ko" ? "문서 변환 중" : "Converting document"));
      failIfCanceled();
      return { blob: converted.blob, fileName: `${stem}.${format}`, mimeType: MIME[format], warnings: format === "xlsx" ? [language === "ko" ? "PDF에 보이는 표만 추출했습니다. 원래 수식과 차트는 복원되지 않습니다." : "Only tables visible in the PDF were extracted. Original formulas and charts are unavailable."] : [], pages: pageResults };
    }
    const extracted = await extractPdfText(file, format === "searchable-pdf" ? "all" : request.ocrMode, format === "searchable-pdf", onProgress, selection, language, signal, { includeImages: format === "pptx" || format === "hwpx", ocrLayout: request.ocrLayout, ocrLanguage: request.ocrLanguage });
    failIfCanceled();
    for (const [index, page] of extracted.document.pages.entries()) if (!page.lines.length) pageResults[index].status = "blank-preserved";
    if (format === "searchable-pdf") {
      if (extracted.ocrPdfBuffers.length !== selection.length) throw new PdfConversionError("OCR_OUTPUT");
      const output = await combineOcrPdfPages(extracted.ocrPdfBuffers, stem, onProgress, language, signal);
      return { blob: new Blob([output.buffer], { type: MIME[format] }), fileName: output.fileName, mimeType: MIME[format], warnings: output.warnings, pages: pageResults };
    }
    if (!extracted.document.characterCount) throw new PdfConversionError("NO_TEXT");
    const output = await textDocumentToOffice(extracted.document, format, stem, onProgress, language, signal);
    return { blob: new Blob([output.buffer], { type: MIME[format] }), fileName: output.fileName, mimeType: MIME[format], warnings: output.warnings, pages: pageResults };
  } finally { await releasePdf(file); }
}
