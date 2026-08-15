/// <reference lib="webworker" />

import JSZip from "jszip";
import { degrees, PDFDocument, rgb, StandardFonts } from "pdf-lib";

import type {
  PdfPagePlan,
  PdfWorkerInput,
  PdfWorkerResult,
} from "./types";
import { ensurePdfExtension as ensureExtension, normalizePdfRotation as normalizeRotation, pdfBinaryResult as binaryResult, sanitizePdfFileName as sanitizeFileName } from "./pdfShared";

const worker = self as unknown as DedicatedWorkerGlobalScope;
let currentLanguage: "ko" | "en" = "ko";
const L = (ko: string, en: string) => currentLanguage === "ko" ? ko : en;
interface PdfDecorationOptions { watermarkImage?: ArrayBuffer; pageNumbers?: boolean }

worker.onmessage = async (event: MessageEvent) => {
  try {
    currentLanguage = event.data.language === "en" ? "en" : "ko";
    const { type } = event.data as { type: string };
    let result: PdfWorkerResult;
    if (type === "merge") result = await mergePages(event.data);
    else if (type === "export-groups") result = await exportGroups(event.data);
    else if (type === "images-to-pdf") result = await buildImagePdf(event.data);
    else if (type === "combine-ocr-pdfs") result = await combineOcrPdfs(event.data);
    else throw new PdfWorkerError(L("지원하지 않는 PDF 작업입니다.", "Unsupported PDF operation."), "UNSUPPORTED_REQUEST");
    worker.postMessage({ type: "result", result }, [result.buffer]);
  } catch (error) {
    const normalized = normalizeError(error);
    worker.postMessage({ type: "error", error: normalized });
  }
};

function progress(value: number, message: string) {
  worker.postMessage({ type: "progress", progress: Math.round(value), message });
}

async function mergePages(data: {
  inputs: PdfWorkerInput[];
  pages: PdfPagePlan[];
  fileName: string;
  options?: PdfDecorationOptions;
}): Promise<PdfWorkerResult> {
  if (!data.pages.length) throw new PdfWorkerError(L("내보낼 페이지가 없습니다.", "There are no pages to export."), "NO_PAGES");
  progress(4, L("원본 PDF를 읽는 중…", "Reading source PDFs…"));
  const sources = new Map<string, PDFDocument>();
  for (let index = 0; index < data.inputs.length; index += 1) {
    const input = data.inputs[index];
    sources.set(input.id, await loadPdf(input.buffer));
    progress(8 + ((index + 1) / data.inputs.length) * 22, L(`[${index + 1}/${data.inputs.length}] ${input.name} 준비 완료`, `[${index + 1}/${data.inputs.length}] ${input.name} ready`));
  }
  const output = await PDFDocument.create();
  copyDocumentMetadata(data.pages[0] ? sources.get(data.pages[0].sourceId) : undefined, output);
  for (let index = 0; index < data.pages.length; index += 1) {
    const plan = data.pages[index];
    const source = sources.get(plan.sourceId);
    if (!source) throw new PdfWorkerError(L("페이지 원본을 찾지 못했습니다.", "The source page could not be found."), "SOURCE_NOT_FOUND");
    const [copied] = await output.copyPages(source, [plan.pageIndex]);
    const originalRotation = copied.getRotation().angle;
    copied.setRotation(degrees(normalizeRotation(originalRotation + plan.rotation)));
    output.addPage(copied);
    progress(30 + ((index + 1) / data.pages.length) * 58, L(`[${index + 1}/${data.pages.length}] 페이지 배치 중…`, `[${index + 1}/${data.pages.length}] Placing page…`));
  }
  await decoratePdf(output, data.options);
  progress(92, L("회전값과 페이지 순서를 PDF에 기록하는 중…", "Writing page order and rotations to the PDF…"));
  const bytes = await output.save({ useObjectStreams: true });
  return pdfResult(bytes, ensureExtension(data.fileName, "pdf"), [
    L("디지털 서명은 PDF를 수정하면 유효하지 않게 됩니다.", "Editing a PDF invalidates its digital signatures."),
    L("양식, 책갈피, 첨부 파일과 일부 고급 PDF 개체는 페이지 복사 과정에서 보존되지 않을 수 있습니다.", "Forms, bookmarks, attachments, and some advanced PDF objects may not survive page copying."),
  ]);
}

async function exportGroups(data: {
  inputs: PdfWorkerInput[];
  groups: Array<{ fileName: string; pages: PdfPagePlan[] }>;
  archiveName: string;
  options?: PdfDecorationOptions;
}): Promise<PdfWorkerResult> {
  if (!data.groups.length) throw new PdfWorkerError(L("내보낼 PDF 그룹이 없습니다.", "There are no PDF groups to export."), "NO_GROUPS");
  if (data.groups.some((group) => !group.pages.length)) throw new PdfWorkerError(L("페이지가 없는 PDF 그룹이 있습니다.", "A PDF group contains no pages."), "EMPTY_GROUP");
  progress(3, L("원본 PDF를 읽는 중…", "Reading source PDFs…"));
  const sources = await loadSources(data.inputs, 3, 20);
  const archive = new JSZip();
  for (let groupIndex = 0; groupIndex < data.groups.length; groupIndex += 1) {
    const group = data.groups[groupIndex];
    const output = await createPlannedPdf(sources, group.pages, (pageIndex) => {
      const groupProgress = (groupIndex + (pageIndex + 1) / group.pages.length) / data.groups.length;
      progress(23 + groupProgress * 62, L(`[${groupIndex + 1}/${data.groups.length}] ${group.fileName} · ${pageIndex + 1}/${group.pages.length}페이지 구성 중…`, `[${groupIndex + 1}/${data.groups.length}] ${group.fileName} · building page ${pageIndex + 1}/${group.pages.length}…`));
    });
    await decoratePdf(output, data.options);
    archive.file(ensureExtension(sanitizeFileName(group.fileName, L("분할-PDF", "split-PDF")), "pdf"), await output.save({ useObjectStreams: true }));
  }
  progress(88, L(`${data.groups.length}개 PDF를 ZIP으로 묶는 중…`, `Packing ${data.groups.length} PDFs into a ZIP…`));
  const bytes = await archive.generateAsync(
    { type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } },
    (metadata) => progress(88 + metadata.percent * 0.1, L(`ZIP 압축 중… ${Math.round(metadata.percent)}%`, `Compressing ZIP… ${Math.round(metadata.percent)}%`)),
  );
  return binaryResult(bytes, ensureExtension(data.archiveName, "zip"), "application/zip", [
    L("디지털 서명은 PDF를 수정하면 유효하지 않게 됩니다.", "Editing a PDF invalidates its digital signatures."),
    L("양식, 책갈피, 첨부 파일과 일부 고급 PDF 개체는 페이지 복사 과정에서 보존되지 않을 수 있습니다.", "Forms, bookmarks, attachments, and some advanced PDF objects may not survive page copying."),
  ]);
}

async function decoratePdf(document: PDFDocument, options?: PdfDecorationOptions) {
  if (!options?.pageNumbers && !options?.watermarkImage) return;
  const font = options.pageNumbers ? await document.embedFont(StandardFonts.Helvetica) : undefined;
  const watermark = options.watermarkImage ? await document.embedPng(options.watermarkImage) : undefined;
  const pages = document.getPages();
  pages.forEach((page, index) => {
    const { width, height } = page.getSize();
    if (watermark) {
      const targetWidth = Math.min(width * 0.72, watermark.width * 0.55);
      const targetHeight = targetWidth * watermark.height / watermark.width;
      page.drawImage(watermark, {
        x: (width - targetWidth) / 2,
        y: (height - targetHeight) / 2,
        width: targetWidth,
        height: targetHeight,
        rotate: degrees(-32),
        opacity: 0.2,
      });
    }
    if (font) {
      const label = `${index + 1} / ${pages.length}`;
      const size = 9;
      page.drawText(label, { x: (width - font.widthOfTextAtSize(label, size)) / 2, y: 12, size, font, color: rgb(0.35, 0.35, 0.38), opacity: 0.9 });
    }
  });
}

async function loadSources(inputs: PdfWorkerInput[], progressStart: number, progressSize: number) {
  const sources = new Map<string, PDFDocument>();
  for (let index = 0; index < inputs.length; index += 1) {
    const input = inputs[index];
    sources.set(input.id, await loadPdf(input.buffer));
    progress(progressStart + ((index + 1) / inputs.length) * progressSize, L(`[${index + 1}/${inputs.length}] ${input.name} 준비 완료`, `[${index + 1}/${inputs.length}] ${input.name} ready`));
  }
  return sources;
}

async function createPlannedPdf(
  sources: Map<string, PDFDocument>,
  pages: PdfPagePlan[],
  onPage?: (pageIndex: number) => void,
) {
  const output = await PDFDocument.create();
  copyDocumentMetadata(pages[0] ? sources.get(pages[0].sourceId) : undefined, output);
  for (let index = 0; index < pages.length; index += 1) {
    const plan = pages[index];
    const source = sources.get(plan.sourceId);
    if (!source) throw new PdfWorkerError(L("페이지 원본을 찾지 못했습니다.", "The source page could not be found."), "SOURCE_NOT_FOUND");
    const [copied] = await output.copyPages(source, [plan.pageIndex]);
    copied.setRotation(degrees(normalizeRotation(copied.getRotation().angle + plan.rotation)));
    output.addPage(copied);
    onPage?.(index);
  }
  return output;
}

async function buildImagePdf(data: {
  inputs: PdfWorkerInput[];
  pageMode: "a4" | "image";
  fileName: string;
  options?: PdfDecorationOptions;
}): Promise<PdfWorkerResult> {
  if (!data.inputs.length) throw new PdfWorkerError(L("변환할 이미지가 없습니다.", "There are no images to convert."), "NO_IMAGES");
  const output = await PDFDocument.create();
  for (let index = 0; index < data.inputs.length; index += 1) {
    const input = data.inputs[index];
    const imageType = detectImageType(input.buffer);
    if (!imageType) throw new PdfWorkerError(L(`${input.name}: JPG 또는 PNG 이미지가 아닙니다.`, `${input.name}: this is not a JPG or PNG image.`), "UNSUPPORTED_IMAGE");
    let image;
    try { image = imageType === "png" ? await output.embedPng(input.buffer) : await output.embedJpg(input.buffer); }
    catch { throw new PdfWorkerError(L(`${input.name}: 이미지가 손상되었거나 읽을 수 없습니다.`, `${input.name}: the image is damaged or unreadable.`), "INVALID_IMAGE"); }
    const originalWidth = image.width * 0.75;
    const originalHeight = image.height * 0.75;
    let pageWidth = originalWidth;
    let pageHeight = originalHeight;
    let x = 0;
    let y = 0;
    let width = originalWidth;
    let height = originalHeight;
    if (data.pageMode === "a4") {
      const portrait = image.height >= image.width;
      pageWidth = portrait ? 595.28 : 841.89;
      pageHeight = portrait ? 841.89 : 595.28;
      const margin = 28;
      const scale = Math.min((pageWidth - margin * 2) / originalWidth, (pageHeight - margin * 2) / originalHeight);
      width = originalWidth * scale;
      height = originalHeight * scale;
      x = (pageWidth - width) / 2;
      y = (pageHeight - height) / 2;
    }
    const page = output.addPage([pageWidth, pageHeight]);
    page.drawImage(image, { x, y, width, height });
    progress(8 + ((index + 1) / data.inputs.length) * 82, L(`[${index + 1}/${data.inputs.length}] ${input.name} 배치 완료`, `[${index + 1}/${data.inputs.length}] ${input.name} placed`));
  }
  await decoratePdf(output, data.options);
  return pdfResult(await output.save({ useObjectStreams: true }), ensureExtension(data.fileName, "pdf"), [
    L("이미지 기반 압축은 페이지를 다시 그리므로 검색 가능한 텍스트, 링크, 양식과 디지털 서명이 보존되지 않습니다.", "Image-based compression redraws pages, so searchable text, links, forms, and digital signatures are not preserved."),
  ]);
}

async function combineOcrPdfs(data: { buffers: ArrayBuffer[]; fileName: string }): Promise<PdfWorkerResult> {
  if (!data.buffers.length) throw new PdfWorkerError(L("검색 가능한 PDF 페이지가 없습니다.", "There are no searchable PDF pages."), "NO_PAGES");
  const output = await PDFDocument.create();
  for (let index = 0; index < data.buffers.length; index += 1) {
    const source = await loadPdf(data.buffers[index]);
    const copied = await output.copyPages(source, source.getPageIndices());
    copied.forEach((page) => output.addPage(page));
    progress(8 + ((index + 1) / data.buffers.length) * 82, L(`[${index + 1}/${data.buffers.length}] OCR 페이지 결합 중…`, `[${index + 1}/${data.buffers.length}] Combining OCR page…`));
  }
  return pdfResult(await output.save(), ensureExtension(data.fileName, "pdf"), [
    L("검색 가능한 PDF는 각 페이지를 이미지로 다시 구성하므로 원본의 벡터, 링크, 양식과 디지털 서명은 보존되지 않습니다.", "Searchable PDFs rebuild every page as an image, so original vectors, links, forms, and digital signatures are not preserved."),
    L("인식된 텍스트는 OCR 정확도에 따라 실제 문서와 다를 수 있습니다.", "Recognized text may differ from the source depending on OCR accuracy."),
  ]);
}

async function loadPdf(buffer: ArrayBuffer) {
  try {
    return await PDFDocument.load(buffer, { ignoreEncryption: false, updateMetadata: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/encrypt/i.test(message)) throw new PdfWorkerError(L("암호로 보호된 PDF는 편집할 수 없습니다. 보호가 해제된 사본으로 다시 시도해 주세요.", "Password-protected PDFs cannot be edited. Try again with an unlocked copy."), "ENCRYPTED_PDF");
    throw new PdfWorkerError(L("PDF 파일을 읽지 못했습니다. 손상되었거나 지원하지 않는 형식일 수 있습니다.", "Unable to read the PDF. It may be damaged or unsupported."), "INVALID_PDF");
  }
}

function pdfResult(bytes: Uint8Array, fileName: string, warnings: string[]) {
  return binaryResult(bytes, fileName, "application/pdf", warnings);
}

function detectImageType(buffer: ArrayBuffer): "png" | "jpeg" | undefined {
  const bytes = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 12));
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 && bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return "png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  return undefined;
}

function copyDocumentMetadata(source: PDFDocument | undefined, output: PDFDocument) {
  if (!source) return;
  const values = [
    [source.getTitle(), (value: string) => output.setTitle(value)],
    [source.getAuthor(), (value: string) => output.setAuthor(value)],
    [source.getSubject(), (value: string) => output.setSubject(value)],
    [source.getCreator(), (value: string) => output.setCreator(value)],
    [source.getProducer(), (value: string) => output.setProducer(value)],
  ] as const;
  values.forEach(([value, setter]) => { if (value) setter(value); });
  const keywords = source.getKeywords();
  if (keywords) output.setKeywords(keywords.split(/[,;]\s*/).filter(Boolean));
  const created = source.getCreationDate();
  const modified = source.getModificationDate();
  if (created) output.setCreationDate(created);
  if (modified) output.setModificationDate(modified);
}

class PdfWorkerError extends Error {
  constructor(message: string, public code?: string) {
    super(message);
  }
}

function normalizeError(error: unknown) {
  if (error instanceof PdfWorkerError) return { message: error.message, code: error.code };
  const message = error instanceof Error ? error.message : L("PDF 처리 중 알 수 없는 오류가 발생했습니다.", "An unknown error occurred while processing the PDF.");
  return { message, code: "PDF_PROCESSING_ERROR" };
}

export {};
