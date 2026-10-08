import { BentoOfficeLoader } from "./bentoOfficeLoader";

interface Session {
  loader: BentoOfficeLoader;
  activeId: string | undefined;
  abortActive: (() => void) | undefined;
  idleTimer: number | undefined;
}

let session: Session | undefined;
let queue = Promise.resolve();
const ASSET_BASE = new URL("vendor/libreoffice-converter/2.3.1/", new URL(import.meta.env.BASE_URL, location.origin)).href;

function createSession(): Session {
  return {
    loader: new BentoOfficeLoader(ASSET_BASE, () => {}),
    activeId: undefined,
    abortActive: undefined,
    idleTimer: undefined,
  };
}

function disposeSession(current: Session) {
  if (session === current) session = undefined;
  if (current.idleTimer !== undefined) clearTimeout(current.idleTimer);
  current.loader.dispose();
}

/** End a batch and terminate the owned Bento worker without waiting for destroy(). */
export function releaseOfficePdfSession() {
  session?.abortActive?.();
  if (session) disposeSession(session);
}

function waitForTurn(previous: Promise<void>, signal: AbortSignal) {
  if (signal.aborted) return Promise.reject(new DOMException("Cancelled", "AbortError"));
  return new Promise<void>((resolve, reject) => {
    const abort = () => { signal.removeEventListener("abort", abort); reject(new DOMException("Cancelled", "AbortError")); };
    signal.addEventListener("abort", abort, { once: true });
    previous.then(() => { signal.removeEventListener("abort", abort); resolve(); }, reject);
  });
}

/** Serial conversion over one browser Worker; the caller owns the download. */
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
    const operationId = crypto.randomUUID();
    current.activeId = operationId;
    return await new Promise<{ bytes: Uint8Array; fileName: string }>((resolve, reject) => {
      let settled = false;
      const finish = (error?: Error, output?: { bytes: Uint8Array; fileName: string }, reset = false) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        signal.removeEventListener("abort", abort);
        current.activeId = undefined;
        current.abortActive = undefined;
        if (reset) disposeSession(current);
        else current.idleTimer = window.setTimeout(() => { if (session === current) disposeSession(current); }, 30_000);
        if (error) reject(error); else resolve(output!);
      };
      const abort = () => finish(new DOMException("Cancelled", "AbortError"), undefined, true);
      current.abortActive = abort;
      const timeout = window.setTimeout(() => finish(new Error("office-operation-timeout"), undefined, true), 180_000);
      current.loader.setProgress(value => {
        if (!settled && session === current && current.activeId === operationId) progress(value);
      });
      signal.addEventListener("abort", abort, { once: true });
      if (signal.aborted) { abort(); return; }
      void (async () => {
        try {
          await current.loader.initialize();
          if (settled || session !== current) return;
          progress(91);
          if (settled || session !== current) return;
          const bytes = await current.loader.convert(file);
          if (settled || session !== current) return;
          progress(100);
          finish(undefined, { bytes, fileName: file.name.replace(/\.[^.]+$/, "") + ".pdf" });
        } catch (reason) {
          finish(reason instanceof Error ? reason : new Error("conversion-failed"), undefined, true);
        }
      })();
    });
  } finally { void previous.then(release); }
}
