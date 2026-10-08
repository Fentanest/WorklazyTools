import type { AppLanguage } from "../../i18n/languages";
import { convertWithBentoPdf, hasAdequateOcrLayer, profilePagesWithBento, selectPagesWithBento } from "./bentoPdfClient";
import { createPageImageDocument } from "./pdfPageImageDocument";
import { extractPdfText, getPdfImageCoverages, inspectPdf, releasePdf, validatePdfImages, type PdfOcrMode } from "./pdfPreview";
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
  status: "converted" | "image-preserved" | "ocr" | "ocr-skipped" | "existing-ocr" | "blank-preserved" | "no-table";
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
    if (!imageMode && (format === "docx" || format === "pptx" || format === "hwpx")) await validatePdfImages(file, selection, language, signal);
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
      const coverage = await getPdfImageCoverages(file, selection, language, signal);
      const profiles = [...coverage.values()].some(value => value >= .55) ? await profilePagesWithBento(file, selection, signal) : [];
      const existingLayerPages = new Set(profiles.filter(hasAdequateOcrLayer).map(page => page.pageIndex));
      const extracted = await extractPdfText(file, request.ocrMode, false, onProgress, selection, language, signal, { ocrLayout: request.ocrLayout, ocrLanguage: request.ocrLanguage, skipOcrSourceIndexes: existingLayerPages });
      const { createSearchablePdf } = await import("./pdfSearchableOcr");
      const output = await createSearchablePdf(file, selection, inspected.pageCount, extracted.ocrHocrBySourceIndex, profiles, language, signal);
      const added = new Set(output.addedSourceIndexes);
      const scanned = new Set(profiles.filter(profile => profile.imageCoverage >= .55).map(profile => profile.pageIndex));
      for (const page of pageResults) {
        if (added.has(page.sourcePageIndex)) page.status = "ocr";
        else if (existingLayerPages.has(page.sourcePageIndex)) page.status = "existing-ocr";
        else if (extracted.ocrHocrBySourceIndex.has(page.sourcePageIndex)) {
          page.status = "ocr-skipped";
          const warning = language === "ko" ? `원본 ${page.sourcePageIndex + 1}페이지에서 OCR 글자를 배치하지 못해 원본 모양을 보존했습니다.` : `OCR text could not be placed on source page ${page.sourcePageIndex + 1}; its appearance was preserved.`;
          page.warnings.push(warning); output.warnings.push(warning);
        }
        else if (scanned.has(page.sourcePageIndex)) {
          page.status = "ocr-skipped";
          const warning = language === "ko" ? `원본 ${page.sourcePageIndex + 1}페이지에서 OCR 글자를 인식하지 못해 원본 페이지를 보존했습니다.` : `No OCR text was recognized on source page ${page.sourcePageIndex + 1}; the original page was preserved.`;
          page.warnings.push(warning); output.warnings.push(warning);
        }
        else if (!extracted.document.pages[page.inputPageIndex]?.lines.length) page.status = "blank-preserved";
      }
      return { blob: output.blob, fileName: `${stem}.pdf`, mimeType: MIME[format], warnings: output.warnings, pages: pageResults };
    }
    if (format === "pptx" || format === "hwpx") {
      const { convertStirlingEditableDocument } = await import("./stirlingDocumentClient");
      const coverage = await getPdfImageCoverages(file, selection, language, signal);
      const profiles = [...coverage.values()].some(value => value >= .55) ? await profilePagesWithBento(file, selection, signal) : [];
      const existingLayerPages = new Set(profiles.filter(hasAdequateOcrLayer).map(page => page.pageIndex));
      const extracted = request.ocrMode === "off" ? undefined : await extractPdfText(file, request.ocrMode, false, onProgress, selection, language, signal, { ocrLayout: request.ocrLayout, ocrLanguage: request.ocrLanguage, skipOcrSourceIndexes: existingLayerPages });
      let documentFile = file;
      let inputIndexes = selection;
      const warnings: string[] = [];
      if (extracted?.ocrHocrBySourceIndex.size || existingLayerPages.size) {
        const { prepareOcrPdfForDocx } = await import("./pdfOcrDocxPreparation");
        const prepared = await prepareOcrPdfForDocx(file, selection, profiles, extracted?.ocrHocrBySourceIndex ?? new Map(), language, signal);
        documentFile = new File([prepared.pdf], `${stem}-ocr.pdf`, { type: "application/pdf" });
        inputIndexes = selection.map((_, index) => index);
        for (const [index, page] of prepared.pages.entries()) {
          if (page.method === "ocr") pageResults[index].status = "ocr";
          else if (page.method === "existing-ocr") pageResults[index].status = "existing-ocr";
          else if (page.method === "image-fallback") pageResults[index].status = "image-preserved";
          pageResults[index].warnings.push(...page.warnings);
          warnings.push(...page.warnings);
        }
      }
      const output = await convertStirlingEditableDocument(documentFile, inputIndexes, format, stem, language, onProgress, signal);
      const sourceIndexOf = (index: number) => documentFile === file ? index : selection[index];
      for (const index of output.imagePreservedSourceIndexes ?? []) {
        const sourcePageIndex = sourceIndexOf(index);
        const result = pageResults.find(page => page.sourcePageIndex === sourcePageIndex);
        if (result) { result.status = "image-preserved"; result.warnings.push(language === "ko" ? "원본 모양을 그림으로 보존했습니다. 이 페이지의 글자는 편집할 수 없습니다." : "The source appearance was preserved as a picture. Text on this page is not editable."); }
      }
      for (const fallback of output.pageFallbacks ?? []) {
        const sourcePageIndex = sourceIndexOf(fallback.sourceIndex);
        const detail = /rotation|rotated/.test(fallback.reason) ? language === "ko" ? "페이지 회전" : "page rotation"
          : /annotation/.test(fallback.reason) ? language === "ko" ? "주석" : "annotations"
          : /OCR/.test(fallback.reason) ? language === "ko" ? "기존 OCR 글자" : "an existing OCR layer"
          : language === "ko" ? "겹친 개체나 복잡한 그림" : "overlapping or complex graphics";
        const warning = language === "ko" ? `원본 ${sourcePageIndex + 1}페이지는 ${detail} 때문에 그림으로 보존했습니다.` : `Source page ${sourcePageIndex + 1} was preserved as a picture because of ${detail}.`;
        warnings.push(warning);
        const result = pageResults.find(page => page.sourcePageIndex === sourcePageIndex);
        if (result) { result.status = "image-preserved"; result.warnings.push(warning); }
      }
      for (const index of output.graphicsFlattenedSourceIndexes ?? []) {
        const sourcePageIndex = sourceIndexOf(index);
        const warning = language === "ko" ? `원본 ${sourcePageIndex + 1}페이지의 표 선·도형은 그림으로 보존하고 글자는 편집 가능한 개체로 배치했습니다.` : `Table rules and shapes on source page ${sourcePageIndex + 1} were preserved as pictures; text remains editable.`;
        warnings.push(warning);
        pageResults.find(page => page.sourcePageIndex === sourcePageIndex)?.warnings.push(warning);
      }
      const generalWarnings = output.warnings.filter(warning => !/^(Pages preserved for source layout:|원본 배치 보존이 필요한 페이지:|Pages with shapes and table rules flattened as pictures:|도형·표 선을 그림으로 보존한 페이지:)/.test(warning));
      return { blob: output.blob, fileName: output.fileName, mimeType: output.mimeType, warnings: [...generalWarnings, ...warnings], pages: pageResults };
    }
    if (format === "docx" || format === "xlsx") {
      const identity = selection.length === inspected.pageCount && selection.every((index, position) => index === position);
      let input: Blob = file;
      let normalized = identity;
      const warnings: string[] = [];
      if (format === "docx") {
        onProgress?.(3, language === "ko" ? "원본 글자와 이미지 확인 중" : "Inspecting original text and images");
        const profiles = await profilePagesWithBento(file, selection, signal);
        const existingLayerPages = new Set(profiles.filter(hasAdequateOcrLayer).map(page => page.pageIndex));
        const rotatedTextPages = new Set(profiles.filter(page => page.rotation % 360 !== 0 && page.visibleCharacters > 0).map(page => page.pageIndex));
        for (const page of pageResults) {
          const profile = profiles.find(item => item.pageIndex === page.sourcePageIndex);
          if (profile && profile.visibleCharacters === 0 && profile.hiddenSpans.length === 0 && profile.imageCoverage < .05) page.status = "blank-preserved";
        }
        const extracted = request.ocrMode === "off" ? undefined : await extractPdfText(file, request.ocrMode, false, onProgress, selection, language, signal, { ocrLayout: request.ocrLayout, ocrLanguage: request.ocrLanguage, skipOcrSourceIndexes: existingLayerPages });
        if (extracted) auditDocument = extracted.document;
        const scanFallbackPages = profiles.filter(page => page.imageCoverage >= .55 && !hasAdequateOcrLayer(page) && !extracted?.ocrHocrBySourceIndex.has(page.pageIndex));
        if (extracted?.ocrHocrBySourceIndex.size || existingLayerPages.size || rotatedTextPages.size || scanFallbackPages.length) {
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
        converted = await convertWithBentoPdf(input, format, stem, signal, value => onProgress?.(8 + value * 0.9, language === "ko" ? "문서 변환 중" : "Converting document"), selection);
      } catch (error) {
        if (format !== "xlsx" || !(error instanceof Error) || error.message !== "NO_TABLES") throw error;
        const text = await extractPdfText(file, "off", false, undefined, selection, language, signal);
        const profiles = await profilePagesWithBento(file, selection, signal);
        const scanned = profiles.some(page => page.imageCoverage >= .55);
        if (!scanned) throw new PdfConversionError("NO_TABLES");
        if (request.ocrMode === "off" && !text.document.characterCount) throw new PdfConversionError("OCR_REQUIRED_FOR_TABLES");
        if (request.ocrMode === "off") throw new PdfConversionError("SCAN_TABLE_UNAVAILABLE");
        const existingLayerPages = new Set(profiles.filter(hasAdequateOcrLayer).map(page => page.pageIndex));
        const extracted = await extractPdfText(file, request.ocrMode, false, onProgress, selection, language, signal, { ocrLayout: request.ocrLayout, ocrLanguage: request.ocrLanguage, skipOcrSourceIndexes: existingLayerPages });
        if (!extracted.document.characterCount) throw new PdfConversionError("SCAN_TABLE_UNAVAILABLE");
        const { prepareOcrPdfForDocx } = await import("./pdfOcrDocxPreparation");
        const prepared = await prepareOcrPdfForDocx(file, selection, profiles, extracted.ocrHocrBySourceIndex, language, signal);
        try {
          converted = await convertWithBentoPdf(prepared.pdf, "xlsx", stem, signal, value => onProgress?.(8 + value * .9, language === "ko" ? "표 셀 확인 중" : "Checking table cells"), selection);
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
      if (format === "xlsx") {
        let tablePages = new Set(converted.tablePages ?? []);
        const missingPages = pageResults.filter(page => !tablePages.has(page.inputPageIndex));
        let scannedIndexes = new Set<number>();
        if (missingPages.length) {
          const profiles = await profilePagesWithBento(file, missingPages.map(page => page.sourcePageIndex), signal);
          scannedIndexes = new Set(profiles.filter(page => page.imageCoverage >= .55).map(page => page.pageIndex));
          if (scannedIndexes.size && request.ocrMode !== "off") {
            const allProfiles = await profilePagesWithBento(file, selection, signal);
            const existingLayerPages = new Set(allProfiles.filter(hasAdequateOcrLayer).map(page => page.pageIndex));
            const extracted = await extractPdfText(file, request.ocrMode, false, onProgress, selection, language, signal, { ocrLayout: request.ocrLayout, ocrLanguage: request.ocrLanguage, skipOcrSourceIndexes: existingLayerPages });
            if (extracted.document.characterCount) {
              const { prepareOcrPdfForDocx } = await import("./pdfOcrDocxPreparation");
              const prepared = await prepareOcrPdfForDocx(file, selection, allProfiles, extracted.ocrHocrBySourceIndex, language, signal);
              try {
                const retry = await convertWithBentoPdf(prepared.pdf, "xlsx", stem, signal, undefined, selection);
                const retryPages = new Set(retry.tablePages ?? []);
                if ([...tablePages].every(index => retryPages.has(index)) && retryPages.size > tablePages.size) { converted = retry; tablePages = retryPages; }
              } catch (error) { if (!(error instanceof Error) || error.message !== "NO_TABLES") throw error; }
            }
          }
        }
        for (const page of pageResults) if (!tablePages.has(page.inputPageIndex)) {
          page.status = "no-table";
          const warning = scannedIndexes.has(page.sourcePageIndex)
            ? language === "ko" ? `원본 ${page.sourcePageIndex + 1}페이지의 스캔 표 셀을 찾지 못했습니다.` : `No reliable scan table cells were found on source page ${page.sourcePageIndex + 1}.`
            : language === "ko" ? `원본 ${page.sourcePageIndex + 1}페이지에 추출할 표가 없습니다.` : `No extractable table was found on source page ${page.sourcePageIndex + 1}.`;
          page.warnings.push(warning); warnings.push(warning);
        }
        warnings.unshift(language === "ko" ? "PDF에 보이는 표만 추출했습니다. 원래 수식과 차트는 복원되지 않습니다." : "Only tables visible in the PDF were extracted. Original formulas and charts are unavailable.");
      }
      return { blob: converted.blob, fileName: `${stem}.${format}`, mimeType: MIME[format], warnings, pages: pageResults };
    }
    const coverage = request.ocrMode === "off" ? undefined : await getPdfImageCoverages(file, selection, language, signal);
    const existingLayerPages = !coverage || ![...coverage.values()].some(value => value >= .55) ? new Set<number>()
      : new Set((await profilePagesWithBento(file, selection, signal)).filter(hasAdequateOcrLayer).map(page => page.pageIndex));
    const extracted = await extractPdfText(file, request.ocrMode, false, onProgress, selection, language, signal, { ocrLayout: request.ocrLayout, ocrLanguage: request.ocrLanguage, skipOcrSourceIndexes: existingLayerPages });
    failIfCanceled();
    const recognized = new Set(extracted.ocrSourceIndexes);
    for (const [index, page] of extracted.document.pages.entries()) {
      const result = pageResults[index];
      if (recognized.has(result.sourcePageIndex)) result.status = "ocr";
      else if (existingLayerPages.has(result.sourcePageIndex)) result.status = "existing-ocr";
      else if ((coverage?.get(result.sourcePageIndex) ?? 0) >= .55) {
        result.status = "ocr-skipped";
        result.warnings.push(language === "ko" ? `원본 ${result.sourcePageIndex + 1}페이지의 스캔 글자를 인식하지 못했습니다.` : `Scan text on source page ${result.sourcePageIndex + 1} was not recognized.`);
      }
      else if (!page.lines.length) result.status = "blank-preserved";
    }
    if (!extracted.document.characterCount) throw new PdfConversionError("NO_TEXT");
    const output = await textDocumentToOffice(extracted.document, format, stem, onProgress, language, signal);
    const warnings = [...output.warnings];
    if (recognized.size) warnings.push(language === "ko" ? `${recognized.size}개 원본 페이지에 OCR 글자를 사용했습니다.` : `OCR text was used on ${recognized.size} source pages.`);
    warnings.push(...pageResults.flatMap(page => page.warnings));
    return { blob: new Blob([output.buffer], { type: MIME[format] }), fileName: output.fileName, mimeType: MIME[format], warnings, pages: pageResults };
  } finally { if (ownsPdfCache) await releasePdf(file); }
}
