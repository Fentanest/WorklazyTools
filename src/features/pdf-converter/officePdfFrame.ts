import { launchOfficeRuntime } from "../office-editor/officeRuntime";

// This Vite entry is bundled as a standalone script, but runs in a disposable
// same-origin document: LibreOffice needs a canvas and a document-owned Module.
const workers = new Set<Worker>();
const NativeWorker = window.Worker;
window.Worker = class extends NativeWorker {
  constructor(url: string | URL, options?: WorkerOptions) { super(url, options); workers.add(this); }
  terminate() { workers.delete(this); super.terminate(); }
};
let disposed = false;
(window as Window & { disposeOffice?: () => void }).disposeOffice = () => {
  disposed = true;
  for (const worker of workers) worker.terminate();
  workers.clear();
};
const owner = parent;
const origin = owner.location.origin;
let started = false;
window.addEventListener("message", async event => {
  if (event.source !== owner || event.origin !== origin || started || event.data?.type !== "office-pdf-start") return;
  started = true;
  const { token, file, base, fonts } = event.data;
  try {
    const canvas = document.createElement("canvas");
    canvas.id = "qtcanvas"; canvas.width = 640; canvas.height = 480; document.body.append(canvas);
    const runtime = await launchOfficeRuntime(canvas, base, fonts);
    if (disposed) return;
    owner.postMessage({ type: "office-pdf-progress", token }, origin);
    const result = await runtime.convertToPdf(file);
    if (disposed) return;
    const buffer = result.bytes.slice().buffer;
    owner.postMessage({ type: "office-pdf-result", token, buffer, fileName: result.fileName }, origin, [buffer]);
  } catch (error) {
    if (!disposed) owner.postMessage({ type: "office-pdf-error", token, code: error instanceof Error && error.message === "office-operation-timeout" ? "office-operation-timeout" : "conversion-failed" }, origin);
  }
});
owner.postMessage({ type: "office-pdf-ready" }, origin);
