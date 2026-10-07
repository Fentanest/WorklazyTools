import { runModuleWorker, type ModuleWorkerProgress } from "../../utils/workerLifecycle";

export const MARKDOWN_EXTENSIONS = new Set(["docx", "xlsx", "xls", "pptx", "pdf"]);
export const MARKDOWN_MAX_BYTES = 50 * 1024 * 1024;
export const MARKDOWN_ACCEPT = ".docx,.xlsx,.xls,.pptx,.pdf";

export async function convertToMarkdown(
  file: File,
  signal: AbortSignal,
  onProgress: (progress: ModuleWorkerProgress) => void,
) {
  const extension = file.name.split(".").at(-1)?.toLowerCase() ?? "";
  if (!MARKDOWN_EXTENSIONS.has(extension)) throw new Error("UNSUPPORTED_FORMAT");
  if (file.size > MARKDOWN_MAX_BYTES) throw new Error("FILE_TOO_LARGE");
  const buffer = await file.arrayBuffer();
  const header = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, 4));
  if (["docx", "xlsx", "pptx"].includes(extension) && header[0] === 0xd0 && header[1] === 0xcf && header[2] === 0x11 && header[3] === 0xe0) throw new Error("ENCRYPTED");
  if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
  return runModuleWorker<{ buffer: ArrayBuffer; extension: string }, string>(
    () => {
      const worker = new Worker(new URL("./markdown.worker.ts", import.meta.url), { type: "module" });
      return worker;
    },
    { buffer, extension },
    { transfer: [buffer], signal, onProgress, canceledMessage: "Cancelled",
      startErrorMessage: "RUNTIME_UNAVAILABLE", resultErrorMessage: "CONVERSION_FAILED",
      inactivityTimeoutMs: 180_000, timeoutMessage: "CONVERSION_TIMEOUT" },
  );
}
