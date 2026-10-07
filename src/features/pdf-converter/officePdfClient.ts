import frameScript from "./officePdfFrame.ts?worker&url";
import { prepareOfficeAssets } from "../office-editor/officeAssetLoader";
import { OFFICE_EDITOR_FONT_ASSETS } from "../office-editor/officeAssets";

/** One isolated engine at a time. Destroy its document and workers on every exit. */
export async function convertOfficePdf(file: File, signal: AbortSignal, progress: (value: number) => void) {
  if (!crossOriginIsolated || typeof SharedArrayBuffer === "undefined") throw new Error("isolation-required");
  const header = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (/\.(docx|xlsx|pptx)$/i.test(file.name) && header[0] === 0xd0 && header[1] === 0xcf && header[2] === 0x11 && header[3] === 0xe0) throw new Error("encrypted-document");
  signal.throwIfAborted();
  const base = await prepareOfficeAssets(({ loaded, total }) => progress(Math.floor(loaded / total * 70)), signal, "editor");
  signal.throwIfAborted();
  return new Promise<{ bytes: Uint8Array; fileName: string }>((resolve, reject) => {
    const frame = document.createElement("iframe");
    frame.title = "Office conversion"; frame.setAttribute("aria-hidden", "true"); frame.tabIndex = -1;
    frame.dataset.officePdfEngine = "true";
    Object.assign(frame.style, { position: "fixed", left: "-10000px", width: "640px", height: "480px", border: "0" });
    const token = crypto.randomUUID();
    let settled = false;
    const cleanup = () => {
      clearTimeout(timer); signal.removeEventListener("abort", abort); window.removeEventListener("message", receive);
      try { (frame.contentWindow as (Window & { disposeOffice?: () => void }) | null)?.disposeOffice?.(); } finally { frame.remove(); }
    };
    const finish = (error?: Error, result?: { bytes: Uint8Array; fileName: string }) => {
      if (settled) return; settled = true; cleanup();
      if (error) reject(error); else resolve(result!);
    };
    const abort = () => finish(new DOMException("Cancelled", "AbortError"));
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.contentWindow || event.origin !== location.origin) return;
      const data = event.data;
      if (data?.type === "office-pdf-ready") {
        progress(75);
        frame.contentWindow!.postMessage({ type: "office-pdf-start", token, file, base, fonts: OFFICE_EDITOR_FONT_ASSETS.map(font => font.name) }, location.origin);
      } else if (data?.token === token) {
        if (data.type === "office-pdf-progress") progress(90);
        if (data.type === "office-pdf-error") finish(new Error(data.code === "office-operation-timeout" ? data.code : "conversion-failed"));
        if (data.type === "office-pdf-result" && data.buffer instanceof ArrayBuffer) finish(undefined, { bytes: new Uint8Array(data.buffer), fileName: data.fileName });
      }
    };
    const timer = setTimeout(() => finish(new Error("office-operation-timeout")), 180_000);
    signal.addEventListener("abort", abort, { once: true }); window.addEventListener("message", receive);
    // Only a build-owned URL is inserted; no document content enters srcdoc.
    const script = new URL(frameScript, location.href).href.replaceAll("&", "&amp;").replaceAll('"', "&quot;");
    frame.srcdoc = `<!doctype html><html><head><meta charset="utf-8"></head><body><script type="module" src="${script}"></script></body></html>`;
    document.body.append(frame);
    if (signal.aborted) abort();
  });
}
