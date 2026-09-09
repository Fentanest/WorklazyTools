/// <reference lib="webworker" />

import pdfDisplayUrl from "pdfjs-dist/build/pdf.mjs?url";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

const worker = self as unknown as DedicatedWorkerGlobalScope;

class OffscreenCanvasFactory {
  create(width: number, height: number) {
    if (width <= 0 || height <= 0) throw new Error("Invalid canvas size");
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Canvas context unavailable");
    return { canvas, context };
  }

  reset(entry: { canvas: OffscreenCanvas }, width: number, height: number) {
    entry.canvas.width = width;
    entry.canvas.height = height;
  }

  destroy(entry: { canvas: OffscreenCanvas | null; context: OffscreenCanvasRenderingContext2D | null }) {
    if (entry.canvas) entry.canvas.width = entry.canvas.height = 1;
    entry.canvas = null;
    entry.context = null;
  }
}

worker.onmessage = async (event: MessageEvent<{ file: File; pageIndex: number; targetWidth: number; outputScale: number }>) => {
  const { file, pageIndex, targetWidth, outputScale } = event.data;
  let loadingTask: { promise: Promise<{ numPages: number; getPage(pageNumber: number): Promise<any> }>; destroy(): Promise<void> } | undefined;
  try {
    const buffer = await file.arrayBuffer();
    const [{ getDocument, GlobalWorkerOptions }, workerModule] = await Promise.all([
      import(/* @vite-ignore */ pdfDisplayUrl) as Promise<typeof import("pdfjs-dist")>,
      import(/* @vite-ignore */ pdfWorkerUrl) as Promise<{ WorkerMessageHandler: unknown }>,
    ]);
    GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    Object.assign(globalThis, { pdfjsWorker: { WorkerMessageHandler: workerModule.WorkerMessageHandler } });
    loadingTask = getDocument({
      data: new Uint8Array(buffer),
      password: "",
      enableXfa: true,
      useSystemFonts: true,
      isOffscreenCanvasSupported: false,
      isImageDecoderSupported: false,
      CanvasFactory: OffscreenCanvasFactory,
    });
    const document = await loadingTask.promise;
    const page = await document.getPage(pageIndex + 1);
    const natural = page.getViewport({ scale: 1 });
    const cssScale = targetWidth / natural.width;
    const viewport = page.getViewport({ scale: cssScale });
    const width = Math.max(1, Math.floor(viewport.width * outputScale));
    const height = Math.max(1, Math.floor(viewport.height * outputScale));
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("Canvas context unavailable");
    await page.render({
      canvas: canvas as unknown as HTMLCanvasElement,
      canvasContext: context as unknown as CanvasRenderingContext2D,
      viewport,
      transform: outputScale === 1 ? undefined : [outputScale, 0, 0, outputScale, 0, 0],
      background: "#ffffff",
    }).promise;
    const bitmap = canvas.transferToImageBitmap();
    worker.postMessage({
      type: "result",
      bitmap,
      dimensions: { width: viewport.width, height: viewport.height, sourceWidth: natural.width, sourceHeight: natural.height },
    }, [bitmap]);
  } catch (error) {
    worker.postMessage({ type: "error", message: error instanceof Error ? error.message : "Preview worker failed" });
  } finally {
    try { await loadingTask?.destroy(); } catch { /* Worker termination also releases the document. */ }
  }
};
