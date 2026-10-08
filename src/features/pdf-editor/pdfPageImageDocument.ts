import type { AppLanguage } from "../../i18n/languages";
import { createEditableDocument } from "./pdfEditableDocument";
import { renderPdfPageForDocument } from "./pdfPreview";
import type { PdfTextDocument, PdfWorkerResult, WorkerProgress } from "./types";
import { ensurePdfExtension, pdfBinaryResult } from "./pdfShared";
import { stirlingPageFit } from "./stirlingPageFit";
import { convertPageImagesWithBento } from "./bentoPdfClient";

type Format = "docx" | "pptx" | "hwpx";
interface ImagePage { sourceIndex: number; blob: Blob; width: number; height: number }
const MIME = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  hwpx: "application/hwp+zip",
};

export async function createPageImageDocument(file: File, pageIndexes: number[], format: Format, name: string, language: AppLanguage, progress?: WorkerProgress, signal?: AbortSignal): Promise<{ blob: Blob; fileName: string; mimeType: string; warnings: string[] }> {
  const pages: ImagePage[] = [];
  let bytes = 0;
  for (const [index, sourceIndex] of pageIndexes.entries()) {
    if (signal?.aborted) throw new DOMException("Conversion cancelled", "AbortError");
    const rendered = await renderPdfPageForDocument(file, sourceIndex, language, signal);
    bytes += rendered.blob.size;
    if (bytes > 128 * 1024 ** 2) throw new Error("BATCH_IMAGE_LIMIT");
    pages.push({ sourceIndex, ...rendered });
    progress?.(5 + 70 * (index + 1) / pageIndexes.length, language === "ko" ? "PDF 페이지 모양을 저장하는 중" : "Preserving PDF page appearance");
  }
  if (signal?.aborted) throw new DOMException("Conversion cancelled", "AbortError");
  let result: PdfWorkerResult;
  if (format === "pptx") result = await makePptx(pages, name);
  else if (format === "hwpx") {
    const document: PdfTextDocument = { sourceName: file.name, characterCount: 0, pages: [] };
    for (const page of pages) document.pages.push({ pageNumber: page.sourceIndex + 1, lines: [], images: [{ data: await dataUrl(page.blob), width: page.width, height: page.height }] });
    result = await createEditableDocument(document, "hwpx", name, language, progress ?? (() => undefined));
  } else {
    const converted = await convertPageImagesWithBento(pages, signal, value => progress?.(75 + value * .23, language === "ko" ? "페이지 문서 작성 중" : "Writing page document"));
    return { blob: converted.blob, fileName: ensurePdfExtension(name, "docx"), mimeType: MIME.docx, warnings: [language === "ko" ? "페이지 이미지를 원본 비율로 보존했습니다. 이미지 속 글자는 편집할 수 없습니다." : "Pages are preserved as proportionally fitted images. Text inside the images is not editable."] };
  }
  result.warnings = [language === "ko" ? "페이지 이미지를 원본 비율로 보존했습니다. 이미지 속 글자는 편집할 수 없습니다." : "Pages are preserved as proportionally fitted images. Text inside the images is not editable."];
  return { blob: new Blob([result.buffer], { type: result.mimeType }), fileName: result.fileName, mimeType: result.mimeType, warnings: result.warnings };
}

async function makePptx(pages: ImagePage[], name: string): Promise<PdfWorkerResult> {
  const PptxGenJS = (await import("pptxgenjs")).default;
  const pptx = new PptxGenJS();
  const width = Math.max(...pages.map(page => page.width)) / 72;
  const height = Math.max(...pages.map(page => page.height)) / 72;
  pptx.defineLayout({ name: "PdfPages", width, height });
  pptx.layout = "PdfPages";
  for (const page of pages) {
    const slide = pptx.addSlide();
    const fitted = stirlingPageFit({ width: page.width, height: page.height }, width * 72, height * 72);
    slide.addImage({ data: await dataUrl(page.blob), x: fitted.dx / 72, y: fitted.dy / 72, w: page.width * fitted.scale / 72, h: page.height * fitted.scale / 72 });
  }
  return pdfBinaryResult(await pptx.write({ outputType: "arraybuffer" }) as ArrayBuffer, ensurePdfExtension(name, "pptx"), MIME.pptx, []);
}

async function dataUrl(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  return `data:image/jpeg;base64,${btoa(binary)}`;
}
