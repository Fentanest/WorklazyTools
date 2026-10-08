import { WorkerBrowserConverter, type InputFormat } from "@matbee/libreoffice-converter/browser";

// Adapted from BentoPDF src/js/utils/libreoffice-loader.ts at
// 3a5f146d1b89d54dc7ca576aa6797c8bd3e42b97. The package is pinned to
// @matbee/libreoffice-converter 2.3.1 and all runtime assets come from that
// package. This variant owns its Blob URLs and supports aborting initialization.
export class BentoOfficeLoader {
  private converter: WorkerBrowserConverter | undefined;
  private initializing: Promise<void> | undefined;
  private readonly urls = new Set<string>();
  private readonly controller = new AbortController();
  private lastProgress = 0;

  constructor(
    private readonly assetBase: string,
    private report: (percent: number) => void,
  ) {}

  setProgress(report: (percent: number) => void) {
    this.report = report;
    this.lastProgress = this.converter?.isReady() ? 90 : 0;
  }

  async initialize() {
    if (this.converter?.isReady()) return;
    if (this.initializing) return this.initializing;
    this.initializing = this.initializeOnce();
    try { await this.initializing; }
    catch (error) { this.dispose(); throw error; }
    finally { this.initializing = undefined; }
  }

  private async initializeOnce() {
    const wasm = this.objectUrl("soffice.wasm.gz", "application/wasm");
    const data = this.objectUrl("soffice.data.gz", "application/octet-stream");
    let wasmUrl: string;
    let dataUrl: string;
    try {
      [wasmUrl, dataUrl] = await Promise.all([wasm, data]);
    } catch (error) {
      this.controller.abort();
      await Promise.allSettled([wasm, data]);
      throw error;
    }
    this.controller.signal.throwIfAborted();
    this.emit(60);
    this.controller.signal.throwIfAborted();
    const base = new URL(this.assetBase);
    const converter = new WorkerBrowserConverter({
      sofficeJs: new URL("soffice.js", base).href,
      sofficeWasm: wasmUrl,
      sofficeData: dataUrl,
      sofficeWorkerJs: new URL("soffice.worker.js", base).href,
      browserWorkerJs: new URL("browser.worker.global.js", base).href,
      onProgress: info => this.emit(info.phase === "converting" && this.converter?.isReady()
        ? Math.min(99, 91 + Math.round(info.percent * .08))
        : Math.min(89, 60 + Math.round(info.percent * .29))),
    });
    this.converter = converter;
    await converter.initialize();
    this.controller.signal.throwIfAborted();
    this.emit(90);
    this.controller.signal.throwIfAborted();
  }

  async convert(file: File): Promise<Uint8Array> {
    await this.initialize();
    this.controller.signal.throwIfAborted();
    const extension = file.name.split(".").at(-1)?.toLowerCase() ?? "";
    if (!["doc", "docx", "xls", "xlsx", "ppt", "pptx"].includes(extension)) throw new Error("unsupported-office-format");
    const bytes = new Uint8Array(await file.arrayBuffer());
    this.controller.signal.throwIfAborted();
    const result = await this.converter!.convert(bytes, { outputFormat: "pdf", inputFormat: extension as InputFormat }, file.name);
    if (result.data.length < 5 || new TextDecoder().decode(result.data.subarray(0, 5)) !== "%PDF-") {
      throw new Error("office-convert-verification-failed");
    }
    // Upstream sends the result before its `finally` destroys the LOK document.
    // A queued ping is handled only after that cleanup returns.
    if (!await this.waitForCleanup(10_000)) throw new Error("office-operation-timeout");
    return result.data;
  }

  private async waitForCleanup(timeoutMs: number): Promise<boolean> {
    const pending = (this.converter as unknown as {
      sendMessage(type: string): Promise<unknown>;
    }).sendMessage("worklazy-ping").then(() => true, () => false);
    let timer: number | undefined;
    const timeout = new Promise<boolean>(resolve => {
      timer = window.setTimeout(() => resolve(false), timeoutMs);
    });
    try { return await Promise.race([pending, timeout]); }
    finally { if (timer !== undefined) clearTimeout(timer); }
  }

  dispose() {
    this.controller.abort();
    // WorkerBrowserConverter.destroy() awaits a worker message and cannot be
    // used for a forced cancellation. Terminate its actual owned Worker.
    const runtime = this.converter as unknown as {
      worker?: Worker | null;
      pendingRequests?: Map<number, { reject: (error: Error) => void }>;
    } | undefined;
    if (runtime?.pendingRequests) {
      for (const pending of runtime.pendingRequests.values()) pending.reject(new DOMException("Cancelled", "AbortError"));
      runtime.pendingRequests.clear();
    }
    try { runtime?.worker?.terminate(); }
    catch { /* The Worker may already be gone after an initialization error. */ }
    this.converter = undefined;
    for (const url of this.urls) URL.revokeObjectURL(url);
    this.urls.clear();
  }

  private emit(value: number) {
    if (value > this.lastProgress) {
      this.lastProgress = value;
      this.report(value);
    }
  }

  private async objectUrl(name: string, mimeType: string) {
    const response = await fetch(new URL(name, this.assetBase), { signal: this.controller.signal });
    if (!response.ok) throw new Error("asset-download-failed");
    let blob = await response.blob();
    const head = new Uint8Array(await blob.slice(0, 2).arrayBuffer());
    if (head[0] === 0x1f && head[1] === 0x8b) {
      blob = await new Response(blob.stream().pipeThrough(new DecompressionStream("gzip"), { signal: this.controller.signal })).blob();
    }
    this.controller.signal.throwIfAborted();
    const url = URL.createObjectURL(new Blob([blob], { type: mimeType }));
    this.urls.add(url);
    return url;
  }
}
