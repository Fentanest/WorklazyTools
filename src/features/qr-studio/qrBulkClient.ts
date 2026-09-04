import type { QrErrorCorrectionLevel } from "./qrBulk.ts";

export interface QrBulkRasterSettings {
  size: number;
  quietZone: number;
  errorCorrection: QrErrorCorrectionLevel;
  foreground: string;
  background: string;
  transparent: boolean;
}

export type QrBulkRasterErrorCode = "LOGO" | "NOT_READY" | "ENCODE" | "RESCAN" | "CANVAS";

export class QrBulkRasterError extends Error {
  constructor(readonly code: QrBulkRasterErrorCode) {
    super(code);
    this.name = "QrBulkRasterError";
  }
}

export async function createQrBulkRasterClient(settings: QrBulkRasterSettings, logo?: File) {
  const worker = new Worker(new URL("./qr-bulk.worker.ts", import.meta.url), { type: "module" });
  let nextId = 1;
  let stopped = false;
  const pending = new Map<number, { resolve: (blob: Blob) => void; reject: (error: Error) => void }>();

  const ready = new Promise<void>((resolve, reject) => {
    const fail = () => reject(new QrBulkRasterError("NOT_READY"));
    worker.onerror = fail;
    worker.onmessage = (event) => {
      if (event.data.type === "ready") {
        worker.onerror = handleWorkerError;
        resolve();
      } else if (event.data.type === "error") {
        reject(new QrBulkRasterError(event.data.code));
      }
    };
  });

  function handleWorkerError() {
    stop(new QrBulkRasterError("ENCODE"));
  }

  function stop(reason: Error = new DOMException("Aborted", "AbortError")) {
    if (stopped) return;
    stopped = true;
    worker.terminate();
    pending.forEach(({ reject }) => reject(reason));
    pending.clear();
  }

  try {
    const logoBytes = logo ? await logo.arrayBuffer() : undefined;
    worker.postMessage({ type: "init", settings, logo: logoBytes, logoType: logo?.type }, logoBytes ? [logoBytes] : []);
    await ready;
  } catch (error) {
    worker.terminate();
    throw error instanceof QrBulkRasterError ? error : new QrBulkRasterError("NOT_READY");
  }
  worker.onmessage = (event) => {
    if (event.data.type !== "result") return;
    const request = pending.get(event.data.id);
    if (!request) return;
    pending.delete(event.data.id);
    if (event.data.ok) request.resolve(new Blob([event.data.bytes], { type: "image/png" }));
    else request.reject(new QrBulkRasterError(event.data.code));
  };

  return {
    generate(payload: string) {
      if (stopped) return Promise.reject(new DOMException("Aborted", "AbortError"));
      const id = nextId++;
      return new Promise<Blob>((resolve, reject) => {
        pending.set(id, { resolve, reject });
        worker.postMessage({ type: "generate", id, payload });
      });
    },
    stop,
  };
}
