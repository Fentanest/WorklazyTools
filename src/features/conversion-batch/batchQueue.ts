import { createUniqueSafeFileName, SafeFileNameRegistry, validateSafeFileName } from "../../utils/fileNameSafety.ts";
import type { PdfPageConversionResult } from "../pdf-editor/pdfConversionCore";

export const BATCH_LIMITS = { files: 20, fileBytes: 50 * 1024 ** 2, inputBytes: 200 * 1024 ** 2, resultBytes: 128 * 1024 ** 2, zipBytes: 64 * 1024 ** 2 };
export type BatchStatus = "pending" | "running" | "success" | "failed" | "cancelled" | "print-needed" | "print-reviewed";
export type BatchError = "unsupported" | "input-limit" | "output-limit" | "page-limit" | "range" | "encrypted" | "no-text" | "no-tables" | "ocr-required-for-tables" | "scan-table-unavailable" | "image-decode" | "unavailable" | "timeout" | "conversion";
export interface BatchOutput { blob: Blob; fileName: string; warningCount?: number; warnings?: string[]; warningLanguage?: "ko" | "en"; pageResults?: PdfPageConversionResult[] }
export interface BatchItem {
  id: number; file: File; status: BatchStatus; progress: number; error?: BatchError;
  output?: BatchOutput & { url: string }; saved: boolean;
}
export type BatchProcessor = (file: File, signal: AbortSignal, progress: (value: number) => void) => Promise<BatchOutput>;
export class BatchFailure extends Error {
  readonly code: BatchError;
  constructor(code: BatchError) { super(code); this.code = code; }
}
const batchErrors = new Set<BatchError>(["unsupported", "input-limit", "output-limit", "page-limit", "range", "encrypted", "no-text", "no-tables", "ocr-required-for-tables", "scan-table-unavailable", "image-decode", "unavailable", "timeout", "conversion"]);
function batchErrorCode(error: unknown): BatchError | undefined {
  const code = error && typeof error === "object" && "code" in error ? error.code : undefined;
  return typeof code === "string" && batchErrors.has(code as BatchError) ? code as BatchError : undefined;
}

/** Serial queue. Abort settles the processor before another file may start. */
export class BatchQueue {
  items: BatchItem[] = [];
  running = false;
  private active?: { id: number; controller: AbortController };
  private disposed = false;
  private sequence = 0;
  private listeners = new Set<() => void>();
  private readonly validate: (file: File) => BatchError | "print-needed" | undefined;
  constructor(validate: (file: File) => BatchError | "print-needed" | undefined) { this.validate = validate; }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private publish() { for (const listener of this.listeners) listener(); }
  add(files: File[]) {
    if (this.disposed) return false;
    // Reject the entire new selection if admission would exceed the queue cap.
    if (this.items.length + files.length > BATCH_LIMITS.files || [...this.items.map(item => item.file), ...files].reduce((sum, file) => sum + file.size, 0) > BATCH_LIMITS.inputBytes) return false;
    for (const file of files) {
      const issue = file.size > BATCH_LIMITS.fileBytes ? "input-limit" : this.validate(file);
      this.items.push({ id: ++this.sequence, file, status: issue === "print-needed" ? issue : issue ? "failed" : "pending", error: issue === "print-needed" ? undefined : issue, progress: 0, saved: false });
    }
    this.publish(); return true;
  }
  async run(process: BatchProcessor) {
    if (this.running || this.disposed) return;
    this.running = true; this.publish();
    try {
      while (!this.disposed) {
        const item = this.items.find(row => row.status === "pending");
        if (!item) break;
        const controller = new AbortController(); this.active = { id: item.id, controller };
        item.status = "running"; item.progress = 0; this.publish();
        try {
          const output = await process(item.file, controller.signal, value => {
            if (controller.signal.aborted || this.disposed) return;
            item.progress = Math.min(99, Math.max(0, Math.round(value))); this.publish();
          });
          if (controller.signal.aborted || this.disposed) continue;
          const retained = this.items.reduce((sum, row) => sum + (row.output?.blob.size ?? 0), 0);
          if (output.blob.size + retained > BATCH_LIMITS.resultBytes) throw new BatchFailure("output-limit");
          const names = new SafeFileNameRegistry();
          for (const row of this.items) if (row.output) names.add(validateSafeFileName(row.output.fileName));
          const fileName = createUniqueSafeFileName(output.fileName, names);
          item.output = { ...output, fileName, url: URL.createObjectURL(output.blob) };
          item.status = "success"; item.progress = 100;
        } catch (error) {
          if (!controller.signal.aborted && !this.disposed) {
            item.status = "failed"; item.error = batchErrorCode(error) ?? "conversion";
            if (item.error === "output-limit") break; // Keep remaining inputs pending until results are removed.
          }
        } finally { this.active = undefined; this.publish(); }
      }
    } finally { this.running = false; this.publish(); }
  }
  cancel(id: number) {
    const item = this.items.find(row => row.id === id);
    if (!item || !["pending", "running", "print-needed"].includes(item.status)) return;
    item.status = "cancelled";
    if (this.active?.id === id) this.active.controller.abort();
    this.publish();
  }
  cancelAll() { for (const item of this.items) this.cancel(item.id); }
  retry(id: number) {
    const item = this.items.find(row => row.id === id);
    if (!item || this.running || !["failed", "cancelled", "print-reviewed"].includes(item.status)) return;
    const issue = item.file.size > BATCH_LIMITS.fileBytes ? "input-limit" : this.validate(item.file);
    item.error = issue === "print-needed" ? undefined : issue;
    item.status = issue === "print-needed" ? issue : issue ? "failed" : "pending"; item.progress = 0; this.publish();
  }
  reviewed(id: number) {
    const item = this.items.find(row => row.id === id);
    if (item?.status === "print-needed") { item.status = "print-reviewed"; this.publish(); }
  }
  saved(id: number) { const item = this.items.find(row => row.id === id); if (item?.output) { item.saved = true; this.publish(); } }
  remove(id: number) {
    const item = this.items.find(row => row.id === id);
    if (!item || this.active?.id === id) return;
    if (item.output) URL.revokeObjectURL(item.output.url);
    this.items = this.items.filter(row => row.id !== id); this.publish();
  }
  dispose() {
    this.disposed = true; this.cancelAll();
    for (const item of this.items) if (item.output) URL.revokeObjectURL(item.output.url);
    this.items = []; this.listeners.clear();
  }
}
