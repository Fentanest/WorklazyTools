import type { AppLanguage } from "../../i18n/languages";
import { convertWithBentoPdf, profilePagesWithBento, selectPagesWithBento } from "./bentoPdfClient";
import { createPageImageDocument } from "./pdfPageImageDocument";
import { extractPdfText, inspectPdf, releasePdf, type PdfOcrMode } from "./pdfPreview";
import { textDocumentToOffice } from "./pdfWorkerClient";
import { PdfConversionError } from "./pdfConversionErrors";
import type { PdfTextDocument, WorkerProgress } from "./types";

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
  status: "converted" | "image-preserved" | "ocr" | "existing-ocr" | "blank-preserved";
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
  const ownsPdfCache = !(request.source instanceof File);
  const { format, language, signal, onProgress, fileName } = request;
  const failIfCanceled = () => { if (signal?.aborted) throw new DOMException("Conversion cancelled", "AbortError"); };
  failIfCanceled();
  try {
    const inspected = await inspectPdf(file, language, { signal });
    const selection = normalizeSelectedPages(request.selectedPageIndexes, inspected.pageCount);
    const pageResults: PdfPageConversionResult[] = selection.map((sourcePageIndex, inputPageIndex) => ({ sourcePageIndex, inputPageIndex, status: "converted", warnings: [] }));
    const stem = fileName.trim().replace(/\.[^.]+$/, "") || "worklazy-result";
    let imageMode = request.outputMode === "page-image" && (format === "docx" || format === "pptx" || format === "hwpx");
    let auditDocument: PdfTextDocument | undefined;
    if (!imageMode && request.ocrMode === "off" && (format === "docx" || format === "pptx" || format === "hwpx")) {
      const text = await extractPdfText(file, "off", false, undefined, selection, language, signal);
      auditDocument = text.document;
      // An image-only input can still make a valid document. Preserve all its
      // pages and tell the user that the pictured text is not editable.
      imageMode = text.document.characterCount === 0;
    }
    if (imageMode && (format === "docx" || format === "pptx" || format === "hwpx")) {
      const output = await createPageImageDocument(file, selection, format, stem, language, onProgress, signal);
      for (const page of pageResults) page.status = "image-preserved";
      return { blob: output.blob, fileName: output.fileName, mimeType: output.mimeType, warnings: output.warnings, pages: pageResults };
    }
    if (format === "searchable-pdf") {
      if (request.ocrMode === "off") {
        const identity = selection.length === inspected.pageCount && selection.every((index, position) => index === position);
        const blob = identity ? file : await selectPagesWithBento(file, selection, signal);
        return { blob, fileName: `${stem}.pdf`, mimeType: MIME[format], warnings: [language === "ko" ? "OCR을 끈 상태로 원본 PDF 페이지만 저장했습니다. 이미지 속 글자는 검색할 수 없습니다." : "OCR was off; the original PDF pages were saved without recognizing text in images."], pages: pageResults };
      }
      const profiles = await profilePagesWithBento(file, selection, signal);
      const existingLayerPages = new Set(profiles.filter(page => page.imageCoverage >= .55 && page.hiddenSpans.length > 0).map(page => page.pageIndex));
      const extracted = await extractPdfText(file, request.ocrMode, false, onProgress, selection, language, signal, { ocrLayout: request.ocrLayout, ocrLanguage: request.ocrLanguage, skipOcrSourceIndexes: existingLayerPages });
      const { createSearchablePdf } = await import("./pdfSearchableOcr");
      const output = await createSearchablePdf(file, selection, extracted.ocrHocrBySourceIndex, language, signal);
      for (const page of pageResults) {
        if (extracted.ocrHocrBySourceIndex.has(page.sourcePageIndex)) page.status = "ocr";
        else if (existingLayerPages.has(page.sourcePageIndex)) page.status = "existing-ocr";
        else if (!extracted.document.pages[page.inputPageIndex]?.lines.length) page.status = "blank-preserved";
      }
      return { blob: output.blob, fileName: `${stem}.pdf`, mimeType: MIME[format], warnings: output.warnings, pages: pageResults };
    }
    if (format === "docx" || format === "xlsx") {
      const identity = selection.length === inspected.pageCount && selection.every((index, position) => index === position);
      let input: Blob = file;
      let normalized = identity;
      const warnings: string[] = [];
      if (format === "docx") {
        onProgress?.(3, language === "ko" ? "원본 글자와 이미지 확인 중" : "Inspecting original text and images");
        const profiles = await profilePagesWithBento(file, selection, signal);
        const existingLayerPages = new Set(profiles.filter(page => page.imageCoverage >= .55 && page.hiddenSpans.length > 0).map(page => page.pageIndex));
        const rotatedTextPages = new Set(profiles.filter(page => page.rotation % 360 !== 0 && page.visibleCharacters > 0).map(page => page.pageIndex));
        for (const page of pageResults) {
          const profile = profiles.find(item => item.pageIndex === page.sourcePageIndex);
          if (profile && profile.visibleCharacters === 0 && profile.hiddenSpans.length === 0 && profile.imageCoverage < .05) page.status = "blank-preserved";
        }
        const extracted = request.ocrMode === "off" ? undefined : await extractPdfText(file, request.ocrMode, false, onProgress, selection, language, signal, { ocrLayout: request.ocrLayout, ocrLanguage: request.ocrLanguage, skipOcrSourceIndexes: existingLayerPages });
        if (extracted) auditDocument = extracted.document;
        if (extracted?.ocrHocrBySourceIndex.size || existingLayerPages.size || rotatedTextPages.size) {
          const { prepareOcrPdfForDocx } = await import("./pdfOcrDocxPreparation");
          const prepared = await prepareOcrPdfForDocx(file, selection, profiles, extracted?.ocrHocrBySourceIndex ?? new Map(), language, signal, value => onProgress?.(value, language === "ko" ? "OCR 글자와 원본 페이지 결합 중" : "Combining OCR text and source pages"));
          input = prepared.pdf;
          normalized = true;
          for (const [index, preparedPage] of prepared.pages.entries()) {
            if (preparedPage.method === "ocr") pageResults[index].status = "ocr";
            else if (preparedPage.method === "existing-ocr") pageResults[index].status = "existing-ocr";
            else if (preparedPage.method === "image-fallback") pageResults[index].status = "image-preserved";
            pageResults[index].warnings.push(...preparedPage.warnings);
            warnings.push(...preparedPage.warnings.map(warning => `${language === "ko" ? "원본" : "Source"} ${preparedPage.sourcePageIndex + 1}: ${warning}`));
          }
        }
      }
      if (!identity && !normalized) {
        onProgress?.(2, language === "ko" ? "선택한 페이지 순서 정리 중" : "Ordering selected pages");
        input = await selectPagesWithBento(file, selection, signal);
      }
      failIfCanceled();
      let converted: Awaited<ReturnType<typeof convertWithBentoPdf>>;
      try {
        converted = await convertWithBentoPdf(input, format, stem, signal, value => onProgress?.(8 + value * 0.9, language === "ko" ? "문서 변환 중" : "Converting document"));
      } catch (error) {
        if (format !== "xlsx" || !(error instanceof Error) || error.message !== "NO_TABLES") throw error;
        const text = await extractPdfText(file, "off", false, undefined, selection, language, signal);
        const profiles = await profilePagesWithBento(file, selection, signal);
        const scanned = profiles.some(page => page.imageCoverage >= .55);
        if (!scanned) throw new PdfConversionError("NO_TABLES");
        if (request.ocrMode === "off" && !text.document.characterCount) throw new PdfConversionError("OCR_REQUIRED_FOR_TABLES");
        if (request.ocrMode === "off") throw new PdfConversionError("SCAN_TABLE_UNAVAILABLE");
        const existingLayerPages = new Set(profiles.filter(page => page.imageCoverage >= .55 && page.hiddenSpans.length > 0).map(page => page.pageIndex));
        const extracted = await extractPdfText(file, request.ocrMode, false, onProgress, selection, language, signal, { ocrLayout: request.ocrLayout, ocrLanguage: request.ocrLanguage, skipOcrSourceIndexes: existingLayerPages });
        if (!extracted.document.characterCount) throw new PdfConversionError("SCAN_TABLE_UNAVAILABLE");
        const { prepareOcrPdfForDocx } = await import("./pdfOcrDocxPreparation");
        const prepared = await prepareOcrPdfForDocx(file, selection, profiles, extracted.ocrHocrBySourceIndex, language, signal);
        try {
          converted = await convertWithBentoPdf(prepared.pdf, "xlsx", stem, signal, value => onProgress?.(8 + value * .9, language === "ko" ? "표 셀 확인 중" : "Checking table cells"));
          for (const [index, page] of prepared.pages.entries()) if (page.method === "ocr" || page.method === "existing-ocr") pageResults[index].status = "ocr";
        } catch (retryError) {
          if (retryError instanceof Error && retryError.message === "NO_TABLES") throw new PdfConversionError("SCAN_TABLE_UNAVAILABLE");
          throw retryError;
        }
      }
      failIfCanceled();
      if (format === "docx" && auditDocument?.characterCount) {
        const { missingDocxSourceText } = await import("./pdfDocxAudit");
        const editablePages = auditDocument.pages.filter((_, index) => pageResults[index]?.status !== "image-preserved");
        const missing = await missingDocxSourceText(converted.blob, { ...auditDocument, pages: editablePages });
        if (missing.length) throw new PdfConversionError("DOCUMENT_EXPORT", { page: missing[0].pageNumber, format });
      }
      return { blob: converted.blob, fileName: `${stem}.${format}`, mimeType: MIME[format], warnings: format === "xlsx" ? [language === "ko" ? "PDF에 보이는 표만 추출했습니다. 원래 수식과 차트는 복원되지 않습니다." : "Only tables visible in the PDF were extracted. Original formulas and charts are unavailable."] : warnings, pages: pageResults };
    }
    const extracted = await extractPdfText(file, request.ocrMode, false, onProgress, selection, language, signal, { includeImages: format === "pptx" || format === "hwpx", ocrLayout: request.ocrLayout, ocrLanguage: request.ocrLanguage });
    failIfCanceled();
    for (const [index, page] of extracted.document.pages.entries()) if (!page.lines.length) pageResults[index].status = "blank-preserved";
    if (!extracted.document.characterCount) throw new PdfConversionError("NO_TEXT");
    const output = await textDocumentToOffice(extracted.document, format, stem, onProgress, language, signal);
    return { blob: new Blob([output.buffer], { type: MIME[format] }), fileName: output.fileName, mimeType: MIME[format], warnings: output.warnings, pages: pageResults };
  } finally { if (ownsPdfCache) await releasePdf(file); }
}
