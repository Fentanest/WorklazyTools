import { runModuleWorker, type ModuleWorkerProgress } from "../../utils/workerLifecycle.ts";
import { INPUT_ERROR_CODES, INPUT_LIMITS, ProductBannerInputError, type BatchInputResult, type FileInputResult, type InputErrorCode, type SheetSelection, type SheetSummary } from "./inputTypes.ts";

export type InputWorkerRequest = { type: "inspect" | "extract"; buffer: ArrayBuffer; fileIndex: number; fileName: string; selections?: SheetSelection[] };
export type InputClientOptions = { signal?: AbortSignal; onProgress?: (progress: ModuleWorkerProgress) => void; selections?: SheetSelection[]; createWorker?: () => Worker; inactivityTimeoutMs?: number };
const createInputWorker = () => new Worker(new URL("./input.worker.ts", import.meta.url), { type: "module" });
function canceled(signal?: AbortSignal) { if (signal?.aborted) throw new ProductBannerInputError("CANCELED"); }
export function clientErrorCode(error: unknown): InputErrorCode {
  if (error instanceof ProductBannerInputError) return error.code;
  if (error instanceof DOMException && error.name === "AbortError") return "CANCELED";
  const candidate = (error as { code?: string })?.code ?? (error instanceof Error ? error.message : "");
  return INPUT_ERROR_CODES.includes(candidate as InputErrorCode) ? candidate as InputErrorCode : "WORKER_FAILED";
}
async function processFile<T>(file: File, fileIndex: number, type: InputWorkerRequest["type"], options: InputClientOptions): Promise<T> {
  canceled(options.signal);
  if (!file.size) throw new ProductBannerInputError("EMPTY_FILE");
  if (file.size > INPUT_LIMITS.fileBytes) throw new ProductBannerInputError("FILE_TOO_LARGE");
  try {
    const buffer = await file.arrayBuffer();
    canceled(options.signal);
    return await runModuleWorker<InputWorkerRequest, T>(options.createWorker ?? createInputWorker,
      { type, buffer, fileIndex, fileName: file.name, selections: options.selections }, {
        transfer: [buffer], signal: options.signal, onProgress: options.onProgress,
        inactivityTimeoutMs: options.inactivityTimeoutMs ?? 60_000, timeoutMessage: "WORKER_TIMEOUT",
        canceledMessage: "CANCELED", startErrorMessage: "WORKER_START_FAILED", resultErrorMessage: "WORKER_FAILED",
      });
  } catch (error) { throw new ProductBannerInputError(clientErrorCode(error)); }
}
export function inspectProductFile(file: File, options: InputClientOptions = {}): Promise<SheetSummary[]> { return processFile(file, 0, "inspect", options); }
export function extractProductFile(file: File, fileIndex = 0, options: InputClientOptions = {}): Promise<FileInputResult> { return processFile(file, fileIndex, "extract", options); }

/** Results are assembled by original index even if a supplied reader finishes out of order. */
export async function combineProductFiles(files: readonly File[], reader: (file: File, fileIndex: number) => Promise<FileInputResult>, signal?: AbortSignal): Promise<BatchInputResult> {
  const result: BatchInputResult = { files: [], failures: [], products: [] };
  const pending = await Promise.all(files.map(async (file, fileIndex) => {
    try { canceled(signal); return { value: await reader(file, fileIndex) }; }
    catch (error) { return { failure: { fileIndex, fileName: file.name, code: clientErrorCode(error) } }; }
  }));
  for (const item of pending) {
    if (item.failure) result.failures.push(item.failure);
    else if (item.value) {
      if (result.products.length + item.value.products.length > INPUT_LIMITS.products) {
        result.failures.push({ fileIndex: item.value.fileIndex, fileName: item.value.fileName, code: "PRODUCT_LIMIT" });
      } else { result.files.push(item.value); result.products.push(...item.value.products); }
    }
  }
  return result;
}
export async function readProductFiles(files: readonly File[], options: Omit<InputClientOptions, "selections"> & { selectionsByFile?: Record<number, SheetSelection[]> } = {}): Promise<BatchInputResult> {
  // Serial production reads bound concurrent parser memory to one file/Worker.
  const result: BatchInputResult = { files: [], failures: [], products: [] };
  for (let i = 0; i < files.length; i++) {
    const next = await combineProductFiles([files[i]], (file) => extractProductFile(file, i, { ...options, selections: options.selectionsByFile?.[i] }), options.signal);
    for (const failure of next.failures) result.failures.push({ ...failure, fileIndex: i });
    if (next.products.length + result.products.length > INPUT_LIMITS.products) result.failures.push({ fileIndex: i, fileName: files[i].name, code: "PRODUCT_LIMIT" });
    else { result.files.push(...next.files); result.products.push(...next.products); }
  }
  return result;
}
