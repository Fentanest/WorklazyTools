import { PDFDocument } from "pdf-lib";
import type { PDFDocumentLoadingTask, PDFDocumentProxy } from "pdfjs-dist";

import { throwIfAborted, yieldToEventLoop } from "../../../utils/cooperativeCancel.ts";
import type { AppLanguage } from "../../../i18n/languages";
import { waitForPdfRender } from "../pdfRenderLifecycle.ts";
import {
  chooseCanvasDpi,
  measureBatchResources,
  measureCanvas,
  type CanvasMeasurement,
  type RasterOutputFormat,
} from "./canvasPolicy.ts";

export const RASTER_DPI_VALUES = [150, 200, 300] as const;
export type RasterDpi = typeof RASTER_DPI_VALUES[number];
export const DEFAULT_RASTER_DPI: RasterDpi = 150;
export const DEFAULT_RASTER_FORMAT: RasterOutputFormat = "jpeg";
export const JPEG_RASTER_QUALITY = 0.85;

export interface PdfRasterOptions {
  enabled: boolean;
  dpi: RasterDpi;
  format: RasterOutputFormat;
}

export interface RasterPageGeometry {
  pageNumber: number;
  widthPoints: number;
  heightPoints: number;
}

export interface RasterPagePlan extends RasterPageGeometry {
  requestedDpi: RasterDpi;
  appliedDpi: RasterDpi;
  downgraded: boolean;
  measurement: CanvasMeasurement;
}

export interface RasterPreflightResult {
  supported: boolean;
  plans: RasterPagePlan[];
  unsupportedPage?: number;
  cumulativePixels: number;
  cumulativeRawRgbaBytes: number;
  peakRawRgbaBytes: number;
}

export interface RasterPageMetrics {
  pageNumber: number;
  requestedDpi: RasterDpi;
  appliedDpi: RasterDpi;
  width: number;
  height: number;
  pixels: number;
  rgbaBytes: number;
  encodedBytes: number;
  renderMs: number;
  encodeMs: number;
  embedMs: number;
}

export interface RasterRunMetrics {
  pages: RasterPageMetrics[];
  cumulativePixels: number;
  cumulativeRawRgbaBytes: number;
  peakRawRgbaBytes: number;
  peakRawResourceCount: number;
  intermediateImageBytes: number;
  finalPdfBytes: number;
  totalMs: number;
}

export interface RasterizePdfResult {
  bytes: Uint8Array;
  metrics: RasterRunMetrics;
  downgradedPages: number[];
}

export type RasterStage = "load" | "render" | "encode" | "embed" | "save" | "retain" | "release";

export class PdfRasterError extends Error {
  readonly reason: "unsupported-page" | "canvas" | "encode" | "render";
  readonly pageNumber?: number;

  constructor(reason: PdfRasterError["reason"], pageNumber?: number, cause?: unknown) {
    super(`PDF_RASTER_${reason.toUpperCase().replaceAll("-", "_")}`, cause === undefined ? undefined : { cause });
    this.name = "PdfRasterError";
    this.reason = reason;
    this.pageNumber = pageNumber;
  }
}

export function preflightRasterPages(
  pages: readonly RasterPageGeometry[],
  requestedDpi: RasterDpi,
): RasterPreflightResult {
  const plans: RasterPagePlan[] = [];
  for (const page of pages) {
    const policy = chooseCanvasDpi({
      requestedDpi,
      viewportAtDpi: (dpi) => ({
        width: page.widthPoints * dpi / 72,
        height: page.heightPoints * dpi / 72,
      }),
    });
    if (!policy.supported || policy.appliedDpi === null) {
      return {
        supported: false,
        plans,
        unsupportedPage: page.pageNumber,
        cumulativePixels: 0,
        cumulativeRawRgbaBytes: 0,
        peakRawRgbaBytes: 0,
      };
    }
    const measurement = policy.attempts.at(-1)!.measurement;
    plans.push({
      ...page,
      requestedDpi,
      appliedDpi: policy.appliedDpi,
      downgraded: policy.downgraded,
      measurement,
    });
  }
  const resources = measureBatchResources(plans.map(({ measurement }) => measurement));
  return {
    supported: true,
    plans,
    cumulativePixels: resources.cumulativePixels,
    cumulativeRawRgbaBytes: resources.cumulativeRawRgbaBytes,
    peakRawRgbaBytes: resources.peakRawRgbaBytes,
  };
}

function elapsed(start: number) {
  return Math.max(0, performance.now() - start);
}

function canvasBlob(canvas: HTMLCanvasElement, format: RasterOutputFormat) {
  const mimeType = format === "png" ? "image/png" : "image/jpeg";
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new PdfRasterError("encode")),
      mimeType,
      format === "jpeg" ? JPEG_RASTER_QUALITY : undefined,
    );
  });
}

export async function rasterizePdf(input: {
  bytes: Uint8Array | ArrayBuffer;
  selectedPages: readonly number[];
  options: PdfRasterOptions;
  language?: AppLanguage;
  signal?: AbortSignal;
  onPage?: (completed: number, total: number) => void;
  onStage?: (stage: { name: RasterStage; pageNumber?: number }) => void | Promise<void>;
}): Promise<RasterizePdfResult> {
  if (!input.options.enabled) throw new PdfRasterError("render");
  throwIfAborted(input.signal);
  const startedAt = performance.now();
  const sourceBytes = input.bytes instanceof Uint8Array ? input.bytes : new Uint8Array(input.bytes);
  const selected = new Set(input.selectedPages);
  let owned: { document: PDFDocumentProxy; loadingTask: PDFDocumentLoadingTask } | undefined;
  try {
    const { openOwnedPdfDocument } = await import("../pdfPreview.ts");
    owned = await openOwnedPdfDocument(sourceBytes, input.language, input.signal);
    await input.onStage?.({ name: "load" });
    const pageNumbers = [...selected].sort((left, right) => left - right);
    if (!pageNumbers.length || pageNumbers.some((pageNumber) => !Number.isSafeInteger(pageNumber) || pageNumber < 1 || pageNumber > owned!.document.numPages)) {
      throw new PdfRasterError("unsupported-page", pageNumbers.find((pageNumber) => pageNumber < 1 || pageNumber > owned!.document.numPages));
    }
    const geometries: RasterPageGeometry[] = [];
    for (const pageNumber of pageNumbers) {
      const page = await owned.document.getPage(pageNumber);
      try {
        const viewport = page.getViewport({ scale: 1 });
        geometries.push({ pageNumber, widthPoints: viewport.width, heightPoints: viewport.height });
      } finally {
        try { page.cleanup(); } catch { /* Preflight resources are not retained. */ }
      }
    }
    const preflight = preflightRasterPages(geometries, input.options.dpi);
    if (!preflight.supported) throw new PdfRasterError("unsupported-page", preflight.unsupportedPage);

    const output = await PDFDocument.create();
    const vectorSource = selected.size === owned.document.numPages
      ? undefined
      : await PDFDocument.load(sourceBytes, { updateMetadata: false });
    const pageMetrics: RasterPageMetrics[] = [];
    let completed = 0;
    for (let pageIndex = 0; pageIndex < owned.document.numPages; pageIndex += 1) {
      throwIfAborted(input.signal);
      await yieldToEventLoop();
      throwIfAborted(input.signal);
      const pageNumber = pageIndex + 1;
      const plan = preflight.plans.find((candidate) => candidate.pageNumber === pageNumber);
      if (!plan) {
        const [copied] = await output.copyPages(vectorSource!, [pageIndex]);
        output.addPage(copied);
        continue;
      }

      const page = await owned.document.getPage(pageNumber);
      let canvas: HTMLCanvasElement | undefined;
      try {
        const viewport = page.getViewport({ scale: plan.appliedDpi / 72 });
        const immediate = measureCanvas(viewport);
        if (!immediate.allowed || immediate.width !== plan.measurement.width || immediate.height !== plan.measurement.height) {
          throw new PdfRasterError("canvas", pageNumber);
        }
        canvas = document.createElement("canvas");
        canvas.width = immediate.width;
        canvas.height = immediate.height;
        const context = canvas.getContext("2d", { alpha: false });
        if (!context) throw new PdfRasterError("canvas", pageNumber);
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        const renderStartedAt = performance.now();
        const renderTask = page.render({ canvas, canvasContext: context, viewport, background: "#ffffff" });
        try {
          await waitForPdfRender(renderTask, page, {
            signal: input.signal,
            canceledMessage: "PDF raster rendering was canceled.",
            cleanupOnCancel: false,
          });
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") throw error;
          throw new PdfRasterError("render", pageNumber, error);
        }
        const renderMs = elapsed(renderStartedAt);
        await input.onStage?.({ name: "render", pageNumber });
        throwIfAborted(input.signal);
        const encodeStartedAt = performance.now();
        let imageBytes: Uint8Array;
        try {
          imageBytes = new Uint8Array(await (await canvasBlob(canvas, input.options.format)).arrayBuffer());
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") throw error;
          throw new PdfRasterError("encode", pageNumber, error);
        }
        const encodeMs = elapsed(encodeStartedAt);
        await input.onStage?.({ name: "encode", pageNumber });
        throwIfAborted(input.signal);
        const embedStartedAt = performance.now();
        const image = input.options.format === "png"
          ? await output.embedPng(imageBytes)
          : await output.embedJpg(imageBytes);
        const natural = page.getViewport({ scale: 1 });
        const outputPage = output.addPage([natural.width, natural.height]);
        outputPage.drawImage(image, { x: 0, y: 0, width: natural.width, height: natural.height });
        const embedMs = elapsed(embedStartedAt);
        await input.onStage?.({ name: "embed", pageNumber });
        pageMetrics.push({
          pageNumber,
          requestedDpi: plan.requestedDpi,
          appliedDpi: plan.appliedDpi,
          width: immediate.width,
          height: immediate.height,
          pixels: immediate.pixels,
          rgbaBytes: immediate.rgbaBytes,
          encodedBytes: imageBytes.byteLength,
          renderMs,
          encodeMs,
          embedMs,
        });
      } finally {
        if (canvas) {
          canvas.width = 1;
          canvas.height = 1;
        }
        try { page.cleanup(); } catch { /* The current page is no longer needed. */ }
        await input.onStage?.({ name: "release", pageNumber });
      }
      completed += 1;
      input.onPage?.(completed, pageNumbers.length);
    }
    throwIfAborted(input.signal);
    const bytes = await output.save({ updateFieldAppearances: false });
    await input.onStage?.({ name: "save" });
    throwIfAborted(input.signal);
    const resources = measureBatchResources(preflight.plans.map(({ measurement }) => measurement));
    const result = {
      bytes,
      downgradedPages: preflight.plans.filter(({ downgraded }) => downgraded).map(({ pageNumber }) => pageNumber),
      metrics: {
        pages: pageMetrics,
        cumulativePixels: resources.cumulativePixels,
        cumulativeRawRgbaBytes: resources.cumulativeRawRgbaBytes,
        peakRawRgbaBytes: resources.peakRawRgbaBytes,
        peakRawResourceCount: resources.peakRawResourceCount,
        intermediateImageBytes: pageMetrics.reduce((sum, page) => sum + page.encodedBytes, 0),
        finalPdfBytes: bytes.byteLength,
        totalMs: elapsed(startedAt),
      },
    };
    await input.onStage?.({ name: "retain" });
    return result;
  } finally {
    if (owned) {
      try { await owned.loadingTask.destroy(); } catch { /* Owned raster documents never enter the preview cache. */ }
    }
    await input.onStage?.({ name: "release" });
  }
}
