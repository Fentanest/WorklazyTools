import frameScript from "./officePdfFrame.ts?worker&url";
import { officeAssetBaseUrl } from "../office-editor/officeAssets";

interface Session {
  frame: HTMLIFrameElement;
  ready: Promise<void>;
  accept: ((message: Record<string, unknown>) => void) | undefined;
  abortActive: (() => void) | undefined;
  dispose: () => void;
  idleTimer: number | undefined;
}

let session: Session | undefined;
let queue = Promise.resolve();
const ASSET_BASE = new URL("vendor/libreoffice-converter/2.6.0/", new URL(import.meta.env.BASE_URL, location.origin)).href;
const FONT_URL = new URL("NanumGothic-Regular.ttf", officeAssetBaseUrl()).href;

function createSession(): Session {
  const frame = document.createElement("iframe");
  frame.title = "Office conversion";
  frame.setAttribute("aria-hidden", "true");
  frame.tabIndex = -1;
  frame.dataset.officePdfEngine = "true";
  Object.assign(frame.style, { position: "fixed", left: "-10000px", width: "640px", height: "480px", border: "0" });
  let resolveReady!: () => void;
  let rejectReady!: (error: Error) => void;
  const ready = new Promise<void>((resolve, reject) => { resolveReady = resolve; rejectReady = reject; });
  let readyReceived = false;
  const readyTimeout = window.setTimeout(() => {
    if (!readyReceived) rejectReady(new Error("office-start-failed"));
  }, 30_000);
  const state: Session = {
    frame, ready, accept: undefined, abortActive: undefined, idleTimer: undefined,
    dispose: () => {
      if (session === state) session = undefined;
      if (state.idleTimer !== undefined) clearTimeout(state.idleTimer);
      clearTimeout(readyTimeout);
      window.removeEventListener("message", receive);
      if (!readyReceived) rejectReady(new DOMException("Cancelled", "AbortError"));
      try { (frame.contentWindow as (Window & { disposeOffice?: () => void }) | null)?.disposeOffice?.(); }
      catch { /* Removing the iframe still tears down its realm. */ }
      finally { frame.remove(); }
    },
  };
  const receive = (event: MessageEvent) => {
    if (event.source !== frame.contentWindow || event.origin !== location.origin) return;
    if (event.data?.type === "office-pdf-ready") {
      readyReceived = true;
      clearTimeout(readyTimeout);
      resolveReady();
    } else if (event.data && typeof event.data === "object") {
      state.accept?.(event.data as Record<string, unknown>);
    }
  };
  window.addEventListener("message", receive);
  const script = new URL(frameScript, location.href).href.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
  frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"></head><body><script type="module" src="${script}"></script></body></html>`;
  document.body.append(frame);
  return state;
}

/** End a batch/session and release the large WASM worker immediately. */
export function releaseOfficePdfSession() {
  session?.abortActive?.();
  session?.dispose();
}

function waitForTurn(previous: Promise<void>, signal: AbortSignal) {
  if (signal.aborted) return Promise.reject(new DOMException("Cancelled", "AbortError"));
  return new Promise<void>((resolve, reject) => {
    const abort = () => { signal.removeEventListener("abort", abort); reject(new DOMException("Cancelled", "AbortError")); };
    signal.addEventListener("abort", abort, { once: true });
    previous.then(() => { signal.removeEventListener("abort", abort); resolve(); }, reject);
  });
}

/** Serial conversion over one LibreOffice engine; the caller owns the download. */
export async function convertOfficePdf(file: File, signal: AbortSignal, progress: (value: number) => void) {
  if (!crossOriginIsolated || typeof SharedArrayBuffer === "undefined") throw new Error("isolation-required");
  const extension = file.name.split(".").at(-1)?.toLowerCase() ?? "";
  if (!["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(extension)) throw new Error("unsupported-office-format");
  const header = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  const compound = header[0] === 0xd0 && header[1] === 0xcf && header[2] === 0x11 && header[3] === 0xe0;
  const zip = header[0] === 0x50 && header[1] === 0x4b && header[2] === 0x03 && header[3] === 0x04;
  if (["docx", "xlsx", "pptx"].includes(extension)) {
    if (compound) throw new Error("encrypted-document");
    if (!zip) throw new Error("invalid-office-file");
  }
  const previous = queue;
  let release!: () => void;
  queue = new Promise<void>(resolve => { release = resolve; });
  try {
    await waitForTurn(previous, signal);
    signal.throwIfAborted();
    const current = session ?? (session = createSession());
    if (current.idleTimer !== undefined) clearTimeout(current.idleTimer);
    const requestId = crypto.randomUUID();
    return await new Promise<{ bytes: Uint8Array; fileName: string }>((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error, output?: { bytes: Uint8Array; fileName: string }, reset = false) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        signal.removeEventListener("abort", abort);
        current.accept = undefined;
        current.abortActive = undefined;
        if (reset) current.dispose();
        else current.idleTimer = window.setTimeout(() => { if (session === current) current.dispose(); }, 30_000);
        if (error) reject(error); else resolve(output!);
      };
      const abort = () => finish(new DOMException("Cancelled", "AbortError"), undefined, true);
      current.abortActive = abort;
      const timeout = window.setTimeout(() => finish(new Error("office-operation-timeout"), undefined, true), 180_000);
      current.accept = message => {
        if (message.requestId !== requestId || session !== current) return;
        if (message.type === "office-pdf-progress" && typeof message.value === "number") progress(message.value);
        if (message.type === "office-pdf-error") finish(new Error(String(message.code ?? "conversion-failed")), undefined, true);
        if (message.type === "office-pdf-result" && message.buffer instanceof ArrayBuffer && typeof message.fileName === "string") {
          progress(100);
          finish(undefined, { bytes: new Uint8Array(message.buffer), fileName: message.fileName });
        }
      };
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) { abort(); return; }
      void current.ready.then(() => {
        if (!settled) current.frame.contentWindow!.postMessage({ type: "office-pdf-convert", requestId, file, assetBase: ASSET_BASE, fontUrl: FONT_URL }, location.origin);
      }, error => finish(error instanceof Error ? error : new Error("conversion-failed"), undefined, true));
    });
  } finally { release(); }
}
