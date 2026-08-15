/// <reference lib="webworker" />
import jsQR from "jsqr";
import { workerMessage } from "../../i18n/workerMessages";

self.onmessage = async (event: MessageEvent<{ buffer: ArrayBuffer; type: string }>) => {
  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(new Blob([event.data.buffer], { type: event.data.type }));
    const scale = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale)); const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = new OffscreenCanvas(width, height); const context = canvas.getContext("2d", { willReadFrequently: true }); if (!context) throw new Error(workerMessage(undefined, "qr.errors.scanCanvas"));
    context.drawImage(bitmap, 0, 0, width, height); const image = context.getImageData(0, 0, width, height); const result = jsQR(image.data, width, height, { inversionAttempts: "attemptBoth" });
    self.postMessage({ type: "result", data: result?.data ?? "" });
  } catch (error) { self.postMessage({ type: "error", message: error instanceof Error ? error.message : workerMessage(undefined, "qr.errors.read") }); }
  finally { bitmap?.close(); }
};
export {};
