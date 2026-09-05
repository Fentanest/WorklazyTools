/// <reference lib="webworker" />
import { workerMessage } from "../../i18n/workerMessages";
import { decodeQrImageData } from "./qrDecoder.ts";

self.onmessage = async (event: MessageEvent<{ buffer: ArrayBuffer; type: string }>) => {
  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(new Blob([event.data.buffer], { type: event.data.type }));
    const scale = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale)); const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = new OffscreenCanvas(width, height); const context = canvas.getContext("2d", { willReadFrequently: true }); if (!context) throw new Error(workerMessage(undefined, "qr.errors.scanCanvas"));
    context.fillStyle = "#ffffff"; context.fillRect(0, 0, width, height); context.drawImage(bitmap, 0, 0, width, height); const image = context.getImageData(0, 0, width, height);
    self.postMessage({ type: "result", data: decodeQrImageData(image) });
  } catch (error) { self.postMessage({ type: "error", message: error instanceof Error ? error.message : workerMessage(undefined, "qr.errors.read") }); }
  finally { bitmap?.close(); }
};
export {};
