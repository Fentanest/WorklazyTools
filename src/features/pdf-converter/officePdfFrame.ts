import { BentoOfficeLoader } from "./bentoOfficeLoader";

// The package creates its WASM worker from this disposable same-origin realm.
// Terminating that worker stops a live conversion without waiting for its
// destroy() reply. The WASM worker owns its pthread children.
const workers = new Set<Worker>();
const NativeWorker = window.Worker;
window.Worker = class extends NativeWorker {
  constructor(url: string | URL, options?: WorkerOptions) { super(url, options); workers.add(this); }
  terminate() { workers.delete(this); super.terminate(); }
};

const owner = parent;
const origin = owner.location.origin;
let disposed = false;
let busy = false;
let loader: BentoOfficeLoader | undefined;
let sequence = 0;

(window as Window & { disposeOffice?: () => void }).disposeOffice = () => {
  if (disposed) return;
  disposed = true;
  loader?.dispose();
  loader = undefined;
  for (const worker of workers) worker.terminate();
  workers.clear();
};

window.addEventListener("message", async event => {
  if (event.source !== owner || event.origin !== origin || event.data?.type !== "office-pdf-convert" || disposed) return;
  const { requestId, file, assetBase, fontUrl } = event.data as {
    requestId: string; file: File; assetBase: string; fontUrl: string;
  };
  if (busy) {
    owner.postMessage({ type: "office-pdf-error", requestId, code: "office-busy" }, origin);
    return;
  }
  busy = true;
  const job = ++sequence;
  let initializing = !loader;
  try {
    loader ??= new BentoOfficeLoader(assetBase, fontUrl, value => {
      if (!disposed && job === sequence) owner.postMessage({ type: "office-pdf-progress", requestId, value }, origin);
    });
    loader.setProgress(value => {
      if (!disposed && job === sequence) owner.postMessage({ type: "office-pdf-progress", requestId, value }, origin);
    });
    await loader.initialize();
    initializing = false;
    if (disposed) return;
    owner.postMessage({ type: "office-pdf-progress", requestId, value: 91 }, origin);
    const bytes = await loader.convert(file);
    if (disposed) return;
    const buffer = bytes.byteOffset === 0 && bytes.byteLength === bytes.buffer.byteLength
      ? bytes.buffer : bytes.slice().buffer;
    owner.postMessage({ type: "office-pdf-result", requestId, buffer, fileName: file.name.replace(/\.[^.]+$/, "") + ".pdf" }, origin, [buffer]);
  } catch (error) {
    if (initializing) { loader?.dispose(); loader = undefined; }
    if (!disposed) owner.postMessage({
      type: "office-pdf-error", requestId,
      code: initializing ? "office-init-failed" : error instanceof Error && error.message === "unsupported-office-format" ? "unsupported-office-format" : "conversion-failed",
    }, origin);
  } finally { busy = false; }
});

owner.postMessage({ type: "office-pdf-ready" }, origin);
