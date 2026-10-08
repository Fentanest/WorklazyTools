import { WorkerBrowserConverter, type InputFormat } from "@matbee/libreoffice-converter/browser";

// Adapted from BentoPDF src/js/utils/libreoffice-loader.ts at
// 3a5f146d1b89d54dc7ca576aa6797c8bd3e42b97. The package is pinned to
// @matbee/libreoffice-converter 2.6.0 and all runtime assets come from that
// package. This variant owns its Blob URLs and supports aborting initialization.
export class BentoOfficeLoader {
  private converter: WorkerBrowserConverter | undefined;
  private initializing: Promise<void> | undefined;
  private readonly urls = new Set<string>();
  private readonly controller = new AbortController();
  private lastProgress = 0;
  private warmingUp = false;

  constructor(
    private readonly assetBase: string,
    private readonly fontUrl: string,
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
    const font = fetch(this.fontUrl, { signal: this.controller.signal }).then(async response => {
      if (!response.ok) throw new Error("asset-download-failed");
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength !== 2054744) throw new Error("asset-download-failed");
      return bytes;
    });
    let wasmUrl: string;
    let dataUrl: string;
    let fontBytes: Uint8Array;
    try {
      [wasmUrl, dataUrl, fontBytes] = await Promise.all([wasm, data, font]);
    } catch (error) {
      this.controller.abort();
      await Promise.allSettled([wasm, data, font]);
      throw error;
    }
    this.controller.signal.throwIfAborted();
    this.emit(60);
    const base = new URL(this.assetBase);
    const converter = new WorkerBrowserConverter({
      sofficeJs: new URL("soffice.js", base).href,
      sofficeWasm: wasmUrl,
      sofficeData: dataUrl,
      sofficeWorkerJs: new URL("soffice.worker.js", base).href,
      browserWorkerJs: new URL("browser.worker.global.js", base).href,
      fonts: [{ filename: "NanumGothic-Regular.ttf", data: fontBytes }],
      onProgress: info => this.emit(info.phase === "converting" && this.converter?.isReady() && !this.warmingUp
        ? Math.min(99, 91 + Math.round(info.percent * .08))
        : Math.min(89, 60 + Math.round(info.percent * .29))),
    });
    this.converter = converter;
    await converter.initialize();
    this.controller.signal.throwIfAborted();
    // The first Writer export initializes its font/layout services. A rich
    // DOCX as that first export intermittently stalled inside documentSaveAs;
    // a fixed local DOCX export makes the user's document the second export.
    // This output is discarded and its virtual files are cleaned by the
    // package worker's handleConvert finally block.
    this.warmingUp = true;
    const warmup = await fetch(new URL("warmup.docx", this.assetBase), { signal: this.controller.signal });
    if (!warmup.ok) throw new Error("asset-download-failed");
    const warmupResult = await converter.convert(new Uint8Array(await warmup.arrayBuffer()), { outputFormat: "pdf", inputFormat: "docx" }, "warmup.docx");
    if (new TextDecoder().decode(warmupResult.data.subarray(0, 5)) !== "%PDF-") throw new Error("office-warmup-failed");
    this.controller.signal.throwIfAborted();
    this.warmingUp = false;
    this.emit(90);
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
    return result.data;
  }

  dispose() {
    this.controller.abort();
    // WorkerBrowserConverter.destroy() awaits a worker message and cannot be
    // used for a forced cancellation. The owning iframe terminates its Worker.
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
      blob = await new Response(blob.stream().pipeThrough(new DecompressionStream("gzip"))).blob();
    }
    this.controller.signal.throwIfAborted();
    const url = URL.createObjectURL(new Blob([blob], { type: mimeType }));
    this.urls.add(url);
    return url;
  }
}
