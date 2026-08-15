import type { BatchImageOptions, CollageOptions, GifOptions, ImageWorkerInput, ImageWorkerProgress, ImageWorkerRequest, ImageWorkerResponse, ImageWorkerResult } from "./types";

async function serializeFiles(files: File[]): Promise<ImageWorkerInput[]> {
  const inputs: ImageWorkerInput[] = [];
  for (const file of files) {
    inputs.push({ name: file.name, mimeType: file.type, buffer: await file.arrayBuffer() });
  }
  return inputs;
}

async function runImageWorker(message: ImageWorkerRequest, transfers: ArrayBuffer[], onProgress?: ImageWorkerProgress, signal?: AbortSignal, language: "ko" | "en" = "ko") {
  const worker = new Worker(new URL("./image.worker.ts", import.meta.url), { type: "module" });
  return new Promise<ImageWorkerResult>((resolve, reject) => {
    let settled = false;
    const finish = () => {
      if (settled) return false;
      settled = true;
      signal?.removeEventListener("abort", abort);
      worker.terminate();
      return true;
    };
    const abort = () => {
      if (!finish()) return;
      reject(new DOMException(language === "en" ? "The image operation was cancelled." : "이미지 작업이 취소되었습니다.", "AbortError"));
    };
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) return abort();
    worker.onmessage = (event: MessageEvent<ImageWorkerResponse>) => {
      const data = event.data;
      if (data.type === "progress") {
        onProgress?.(data.progress, data.message || (language === "en" ? "Processing images…" : "이미지 처리 중…"));
        return;
      }
      if (!finish()) return;
      if (data.type === "result") resolve(data.result);
      else reject(Object.assign(new Error(data.error?.message || (language === "en" ? "Image processing failed." : "이미지 처리에 실패했습니다.")), { code: data.error?.code }));
    };
    worker.onerror = (event) => {
      if (!finish()) return;
      reject(new Error(event.message || (language === "en" ? "The image worker could not start." : "이미지 작업을 시작하지 못했습니다.")));
    };
    worker.postMessage(message, transfers);
  });
}

export async function batchProcessImages(files: File[], options: BatchImageOptions, archiveName: string, onProgress?: ImageWorkerProgress, signal?: AbortSignal, language: "ko" | "en" = "ko") {
  const inputs = await serializeFiles(files);
  let watermarkImage = options.watermarkImage;
  const transfers = inputs.map((input) => input.buffer);
  if (watermarkImage) transfers.push(watermarkImage.buffer);
  return runImageWorker({ type: "batch", inputs, options: { ...options, watermarkImage }, archiveName, language }, transfers, onProgress, signal, language);
}

export async function buildCollage(files: File[], options: CollageOptions, fileName: string, onProgress?: ImageWorkerProgress, signal?: AbortSignal, language: "ko" | "en" = "ko") {
  const inputs = await serializeFiles(files);
  return runImageWorker({ type: "collage", inputs, options, fileName, language }, inputs.map((input) => input.buffer), onProgress, signal, language);
}

export async function buildAnimatedGif(files: File[], options: GifOptions, fileName: string, onProgress?: ImageWorkerProgress, signal?: AbortSignal, language: "ko" | "en" = "ko") {
  const inputs = await serializeFiles(files);
  return runImageWorker({ type: "gif", inputs, options, fileName, language }, inputs.map((input) => input.buffer), onProgress, signal, language);
}

export async function serializeWatermark(file?: File) {
  if (!file) return undefined;
  return { name: file.name, mimeType: file.type, buffer: await file.arrayBuffer() } satisfies ImageWorkerInput;
}
