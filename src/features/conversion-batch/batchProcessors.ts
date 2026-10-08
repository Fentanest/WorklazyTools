import type { AppLanguage } from "../../i18n/languages";
import { convertToMarkdown, MARKDOWN_EXTENSIONS } from "../document-markdown/markdownClient";
import { convertOfficePdf } from "../pdf-converter/officePdfClient";
import { extractPdfText, inspectPdf, parsePageRange, pdfToImageArchive, releasePdf, type PdfOcrMode } from "../pdf-editor/pdfPreview";
import { combineOcrPdfPages, textDocumentToOffice } from "../pdf-editor/pdfWorkerClient";
import { convertPdfDocument, type PdfOutputMode } from "../pdf-editor/pdfConversionCore";
import { BatchFailure, type BatchError, type BatchOutput, type BatchProcessor } from "./batchQueue";
export type BatchMode = "document-pdf" | "pdf-document" | "pdf-images" | "markdown";
export interface BatchOptions {
  format: "docx" | "xlsx" | "txt" | "pptx" | "hwpx" | "searchable-pdf";
  ocrMode: PdfOcrMode; ocrLayout: "sparse" | "paragraphs"; pageRange: string;
  outputMode: PdfOutputMode;
  imageFormat: "png" | "jpeg"; dpi: 96 | 144 | 216;
}
export const defaultBatchOptions: BatchOptions = { format: "docx", ocrMode: "auto", ocrLayout: "sparse", outputMode: "editable", pageRange: "", imageFormat: "png", dpi: 144 };
export function validateBatchFile(mode: BatchMode, file: File): BatchError | "print-needed" | undefined {
  const ext = file.name.split(".").at(-1)?.toLowerCase() ?? "";
  if (mode === "document-pdf") return /^(hwp|hwpx)$/.test(ext) ? "print-needed" : /^(doc|docx|xls|xlsx|ppt|pptx)$/.test(ext) ? undefined : "unsupported";
  if (mode === "markdown") return MARKDOWN_EXTENSIONS.has(ext) ? undefined : "unsupported";
  return ext === "pdf" ? undefined : "unsupported";
}
export function batchProcessor(mode: BatchMode, options: BatchOptions, language: AppLanguage): BatchProcessor {
  return async (file, signal, progress): Promise<BatchOutput> => {
    try {
      const stem = file.name.replace(/\.[^.]+$/, "");
      if (mode === "markdown") {
        const text = await convertToMarkdown(file, signal, event => progress(event.progress));
        return { blob: new Blob([text], { type: "text/markdown;charset=utf-8" }), fileName: `${stem}.md` };
      }
      if (mode === "document-pdf") {
        const result = await convertOfficePdf(file, signal, progress);
        return { blob: new Blob([result.bytes.slice().buffer], { type: "application/pdf" }), fileName: `${stem}.pdf` };
      }
      try {
        const inspected = await inspectPdf(file, language, { signal });
        let selected: number[] | undefined;
        try { selected = options.pageRange.trim() ? parsePageRange(options.pageRange, inspected.pageCount, language) : undefined; }
        catch { throw new BatchFailure("range"); }
        // Batch processing is deliberately smaller than the single-document path.
        // Input bytes do not bound decoded images, OCR canvases or document output.
        if ((selected?.length ?? inspected.pageCount) > 200) throw new BatchFailure("page-limit");
        if (mode === "pdf-images") return await pdfToImageArchive(file, options.imageFormat, options.dpi, .9, progress, language, selected, signal, 64 * 1024 ** 2);
        const output = await convertPdfDocument({ source: file, fileName: stem, format: options.format, selectedPageIndexes: selected, ocrMode: options.ocrMode, ocrLanguage: "kor+eng", ocrLayout: options.ocrLayout, outputMode: options.outputMode, language, signal, onProgress: value => progress(value) });
        return { blob: output.blob, fileName: output.fileName, warningCount: output.warnings.length + output.pages.filter(page => page.warnings.length > 0).length };
      } finally { await releasePdf(file); }
    } catch (error) {
      if (signal.aborted || error instanceof BatchFailure) throw error;
      const code = error && typeof error === "object" && "code" in error ? error.code : error instanceof Error ? error.message : "";
      throw new BatchFailure(code === "ENCRYPTED" || code === "encrypted-document" ? "encrypted"
        : code === "NO_TEXT" ? "no-text" : code === "NO_TABLES" ? "no-tables" : code === "OCR_REQUIRED_FOR_TABLES" ? "ocr-required-for-tables" : code === "SCAN_TABLE_UNAVAILABLE" ? "scan-table-unavailable" : code === "BATCH_IMAGE_LIMIT" ? "output-limit"
        : code === "RUNTIME_UNAVAILABLE" || code === "isolation-required" ? "unavailable"
        : ["WORKER_TIMEOUT", "CONVERSION_TIMEOUT", "office-operation-timeout"].includes(String(code)) ? "timeout" : "conversion");
    }
  };
}
