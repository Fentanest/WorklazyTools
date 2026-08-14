/// <reference lib="webworker" />
import jsQR from "jsqr";
self.onmessage = async (event: MessageEvent<{ buffer: ArrayBuffer; type: string; language?: string }>) => {
  let bitmap: ImageBitmap | undefined;
  try {
    bitmap = await createImageBitmap(new Blob([event.data.buffer], { type: event.data.type }));
    const scale = Math.min(1, 2200 / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale)); const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = new OffscreenCanvas(width, height); const context = canvas.getContext("2d", { willReadFrequently: true }); if (!context) throw new Error(event.data.language === "en" ? "The QR scanning canvas could not be created." : "QR 스캔 캔버스를 만들 수 없습니다.");
    context.drawImage(bitmap, 0, 0, width, height); const image = context.getImageData(0, 0, width, height); const result = jsQR(image.data, width, height, { inversionAttempts: "attemptBoth" });
    self.postMessage({ type: "result", data: result?.data ?? "" });
  } catch (error) { self.postMessage({ type: "error", message: error instanceof Error ? error.message : event.data.language === "en" ? "The QR code could not be read." : "QR 코드를 읽지 못했습니다." }); }
  finally { bitmap?.close(); }
};
export {};
