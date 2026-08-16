/// <reference lib="webworker" />

import JSZip from "jszip";
import { degrees, PDFDocument, rgb, StandardFonts } from "pdf-lib";

import type {
  PdfPagePlan,
  PdfWorkerInput,
  PdfWorkerResult,
} from "./types";
import { ensurePdfExtension as ensureExtension, normalizePdfRotation as normalizeRotation, pdfBinaryResult as binaryResult, sanitizePdfFileName as sanitizeFileName } from "./pdfShared";
import { workerMessage as featureMessage } from "../../i18n/workerMessages";

const worker = self as unknown as DedicatedWorkerGlobalScope;
let currentLanguage: "ko" | "en" = "ko";
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
    else throw new PdfWorkerError(featureMessage(currentLanguage, "pdf.messages.pdf.unsupportedPdfOperation"), "UNSUPPORTED_REQUEST");
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
  if (!data.pages.length) throw new PdfWorkerError(featureMessage(currentLanguage, "pdf.messages.pdf.thereAreNoPagesToExport"), "NO_PAGES");
  progress(4, featureMessage(currentLanguage, "pdf.messages.pdf.readingSourcePdfs"));
  const sources = await loadSources(data.inputs, 8, 22);
  const output = await createPlannedPdf(sources, data.pages, (index) => {
    progress(30 + ((index + 1) / data.pages.length) * 58, featureMessage(currentLanguage, "pdf.messages.pdf.placingPage", { p0: index + 1, p1: data.pages.length }));
  });
  await decoratePdf(output, data.options);
  progress(92, featureMessage(currentLanguage, "pdf.messages.pdf.writingPageOrderAndRotationsToThePdf"));
  const bytes = await output.save({ useObjectStreams: true });
  return pdfResult(bytes, ensureExtension(data.fileName, "pdf"), [
    featureMessage(currentLanguage, "pdf.messages.pdf.editingAPdfInvalidatesItsDigitalSignatures"),
    featureMessage(currentLanguage, "pdf.messages.pdf.formsBookmarksAttachmentsAndSomeAdvancedPdfObjects"),
  ]);
}

async function exportGroups(data: {
  inputs: PdfWorkerInput[];
  groups: Array<{ fileName: string; pages: PdfPagePlan[] }>;
  archiveName: string;
  splitPdfFallback: string;
  options?: PdfDecorationOptions;
}): Promise<PdfWorkerResult> {
  if (!data.groups.length) throw new PdfWorkerError(featureMessage(currentLanguage, "pdf.messages.pdf.thereAreNoPdfGroupsToExport"), "NO_GROUPS");
  if (data.groups.some((group) => !group.pages.length)) throw new PdfWorkerError(featureMessage(currentLanguage, "pdf.messages.pdf.aPdfGroupContainsNoPages"), "EMPTY_GROUP");
  progress(3, featureMessage(currentLanguage, "pdf.messages.pdf.readingSourcePdfs"));
  const sources = await loadSources(data.inputs, 3, 20);
  const archive = new JSZip();
  for (let groupIndex = 0; groupIndex < data.groups.length; groupIndex += 1) {
    const group = data.groups[groupIndex];
    const output = await createPlannedPdf(sources, group.pages, (pageIndex) => {
      const groupProgress = (groupIndex + (pageIndex + 1) / group.pages.length) / data.groups.length;
      progress(23 + groupProgress * 62, featureMessage(currentLanguage, "pdf.messages.pdf.buildingPage", { p0: groupIndex + 1, p1: data.groups.length, p2: group.fileName, p3: pageIndex + 1, p4: group.pages.length }));
    });
    await decoratePdf(output, data.options);
    archive.file(ensureExtension(sanitizeFileName(group.fileName, data.splitPdfFallback), "pdf"), await output.save({ useObjectStreams: true }));
  }
  progress(88, featureMessage(currentLanguage, "pdf.messages.pdf.packingPdfsIntoAZip", { p0: data.groups.length }));
  const bytes = await archive.generateAsync(
    { type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } },
    (metadata) => progress(88 + metadata.percent * 0.1, featureMessage(currentLanguage, "pdf.messages.pdf.compressingZip", { p0: Math.round(metadata.percent) })),
  );
  return binaryResult(bytes, ensureExtension(data.archiveName, "zip"), "application/zip", [
    featureMessage(currentLanguage, "pdf.messages.pdf.editingAPdfInvalidatesItsDigitalSignatures"),
    featureMessage(currentLanguage, "pdf.messages.pdf.formsBookmarksAttachmentsAndSomeAdvancedPdfObjects"),
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
    progress(progressStart + ((index + 1) / inputs.length) * progressSize, featureMessage(currentLanguage, "pdf.messages.pdf.ready", { p0: index + 1, p1: inputs.length, p2: input.name }));
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
    if (!source) throw new PdfWorkerError(featureMessage(currentLanguage, "pdf.messages.pdf.theSourcePageCouldNotBeFound"), "SOURCE_NOT_FOUND");
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
  if (!data.inputs.length) throw new PdfWorkerError(featureMessage(currentLanguage, "pdf.messages.pdf.thereAreNoImagesToConvert"), "NO_IMAGES");
  const output = await PDFDocument.create();
  for (let index = 0; index < data.inputs.length; index += 1) {
    const input = data.inputs[index];
    const imageType = detectImageType(input.buffer);
    if (!imageType) throw new PdfWorkerError(featureMessage(currentLanguage, "pdf.messages.pdf.thisIsNotAJpgOrPngImage", { p0: input.name }), "UNSUPPORTED_IMAGE");
    let image;
    try { image = imageType === "png" ? await output.embedPng(input.buffer) : await output.embedJpg(input.buffer); }
    catch { throw new PdfWorkerError(featureMessage(currentLanguage, "pdf.messages.pdf.theImageIsDamagedOrUnreadable", { p0: input.name }), "INVALID_IMAGE"); }
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
    progress(8 + ((index + 1) / data.inputs.length) * 82, featureMessage(currentLanguage, "pdf.messages.pdf.placed", { p0: index + 1, p1: data.inputs.length, p2: input.name }));
  }
  await decoratePdf(output, data.options);
  return pdfResult(await output.save({ useObjectStreams: true }), ensureExtension(data.fileName, "pdf"), [
    featureMessage(currentLanguage, "pdf.messages.pdf.imageBasedCompressionRedrawsPagesSoSearchableText"),
  ]);
}

async function combineOcrPdfs(data: { buffers: ArrayBuffer[]; fileName: string }): Promise<PdfWorkerResult> {
  if (!data.buffers.length) throw new PdfWorkerError(featureMessage(currentLanguage, "pdf.messages.pdf.thereAreNoSearchablePdfPages"), "NO_PAGES");
  const output = await PDFDocument.create();
  for (let index = 0; index < data.buffers.length; index += 1) {
    const source = await loadPdf(data.buffers[index]);
    const copied = await output.copyPages(source, source.getPageIndices());
    copied.forEach((page) => output.addPage(page));
    progress(8 + ((index + 1) / data.buffers.length) * 82, featureMessage(currentLanguage, "pdf.messages.pdf.combiningOcrPage", { p0: index + 1, p1: data.buffers.length }));
  }
  return pdfResult(await output.save(), ensureExtension(data.fileName, "pdf"), [
    featureMessage(currentLanguage, "pdf.messages.pdf.searchablePdfsRebuildEveryPageAsAnImage"),
    featureMessage(currentLanguage, "pdf.messages.pdf.recognizedTextMayDifferFromTheSourceDepending"),
  ]);
}

async function loadPdf(buffer: ArrayBuffer) {
  try {
    return await PDFDocument.load(buffer, { ignoreEncryption: false, updateMetadata: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/encrypt/i.test(message)) throw new PdfWorkerError(featureMessage(currentLanguage, "pdf.messages.pdf.passwordProtectedPdfsCannotBeEditedTryAgain"), "ENCRYPTED_PDF");
    throw new PdfWorkerError(featureMessage(currentLanguage, "pdf.messages.pdf.unableToReadThePdfItMayBe"), "INVALID_PDF");
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
  const message = error instanceof Error ? error.message : featureMessage(currentLanguage, "pdf.messages.pdf.anUnknownErrorOccurredWhileProcessingThePdf");
  return { message, code: "PDF_PROCESSING_ERROR" };
}

export {};
