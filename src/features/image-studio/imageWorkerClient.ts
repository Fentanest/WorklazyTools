import type { BatchImageOptions, CollageOptions, GifOptions, ImageWorkerInput, ImageWorkerProgress, ImageWorkerResult } from "./types";

async function serializeFiles(files: File[]): Promise<ImageWorkerInput[]> {
  const inputs: ImageWorkerInput[] = [];
  for (const file of files) {
    inputs.push({ name: file.name, mimeType: file.type, buffer: await file.arrayBuffer() });
  }
  return inputs;
}

async function runImageWorker(message: object, transfers: ArrayBuffer[], onProgress?: ImageWorkerProgress, signal?: AbortSignal) {
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
      reject(new DOMException("이미지 작업이 취소되었습니다.", "AbortError"));
    };
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) return abort();
    worker.onmessage = (event: MessageEvent) => {
      const data = event.data as { type: "progress" | "result" | "error"; progress?: number; message?: string; result?: ImageWorkerResult; error?: { message?: string; code?: string } };
      if (data.type === "progress") {
        onProgress?.(data.progress ?? 0, data.message ?? "이미지 처리 중…");
        return;
      }
      if (!finish()) return;
      if (data.type === "result") resolve(data.result as ImageWorkerResult);
      else reject(Object.assign(new Error(data.error?.message || "이미지 처리에 실패했습니다."), { code: data.error?.code }));
    };
    worker.onerror = (event) => {
      if (!finish()) return;
      reject(new Error(event.message || "이미지 작업을 시작하지 못했습니다."));
    };
    worker.postMessage(message, transfers);
  });
}

export async function batchProcessImages(files: File[], options: BatchImageOptions, archiveName: string, onProgress?: ImageWorkerProgress, signal?: AbortSignal) {
  const inputs = await serializeFiles(files);
  let watermarkImage = options.watermarkImage;
  const transfers = inputs.map((input) => input.buffer);
  if (watermarkImage) transfers.push(watermarkImage.buffer);
  return runImageWorker({ type: "batch", inputs, options: { ...options, watermarkImage }, archiveName }, transfers, onProgress, signal);
}

export async function buildCollage(files: File[], options: CollageOptions, fileName: string, onProgress?: ImageWorkerProgress, signal?: AbortSignal) {
  const inputs = await serializeFiles(files);
  return runImageWorker({ type: "collage", inputs, options, fileName }, inputs.map((input) => input.buffer), onProgress, signal);
}

export async function buildAnimatedGif(files: File[], options: GifOptions, fileName: string, onProgress?: ImageWorkerProgress, signal?: AbortSignal) {
  const inputs = await serializeFiles(files);
  return runImageWorker({ type: "gif", inputs, options, fileName }, inputs.map((input) => input.buffer), onProgress, signal);
}

export async function serializeWatermark(file?: File) {
  if (!file) return undefined;
  return { name: file.name, mimeType: file.type, buffer: await file.arrayBuffer() } satisfies ImageWorkerInput;
}
