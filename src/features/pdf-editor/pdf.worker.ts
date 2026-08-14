/// <reference lib="webworker" />

import JSZip from "jszip";
import { degrees, PDFDocument } from "pdf-lib";

import type {
  PdfPagePlan,
  PdfWorkerInput,
  PdfWorkerResult,
} from "./types";

const worker = self as unknown as DedicatedWorkerGlobalScope;
let currentLanguage: "ko" | "en" = "ko";
const L = (ko: string, en: string) => currentLanguage === "ko" ? ko : en;

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
    archive.file(ensureExtension(sanitizeFileName(group.fileName), "pdf"), await output.save({ useObjectStreams: true }));
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
}): Promise<PdfWorkerResult> {
  if (!data.inputs.length) throw new PdfWorkerError(L("변환할 이미지가 없습니다.", "There are no images to convert."), "NO_IMAGES");
  const output = await PDFDocument.create();
  for (let index = 0; index < data.inputs.length; index += 1) {
    const input = data.inputs[index];
    const extension = getExtension(input.name);
    const image = extension === "png"
      ? await output.embedPng(input.buffer)
      : await output.embedJpg(input.buffer);
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
  return pdfResult(await output.save(), ensureExtension(data.fileName, "pdf"), []);
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

function binaryResult(bytes: Uint8Array | ArrayBuffer, fileName: string, mimeType: string, warnings: string[]): PdfWorkerResult {
  const buffer = bytes instanceof ArrayBuffer
    ? bytes
    : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  return { buffer, fileName, mimeType, warnings };
}

function getExtension(name: string) {
  return name.split(".").pop()?.toLowerCase() || "";
}

function stripExtension(name: string) {
  return name.replace(/\.[^.]+$/, "");
}

function ensureExtension(name: string, extension: string) {
  const base = stripExtension(name.trim()) || "worklazy-result";
  return `${base}.${extension}`;
}

function sanitizeFileName(name: string) {
  return name.trim().replace(/[\\/:*?"<>|]+/g, "-") || L("분할-PDF", "split-PDF");
}

function normalizeRotation(value: number) {
  return ((value % 360) + 360) % 360;
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
