import type { AppLanguage } from "../../i18n/languages";
import { ensurePdfExtension } from "./pdfShared";
import type { PageData } from "./stirlingLayout";
import type { WorkerProgress } from "./types";

export interface StirlingOutput { blob: Blob; fileName: string; mimeType: string; warnings: string[];
  imagePreservedSourceIndexes?: number[] }
export interface StirlingImagePage { sourceIndex: number; blob: Blob; width: number; height: number }
let nextRequestId = 0;
let sessionWorker: Worker | undefined;
let idleTimer: ReturnType<typeof setTimeout> | undefined;
let queue: Promise<void> = Promise.resolve();
const MIME = { pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation", hwpx: "application/hwp+zip" };

/** Shared single/batch entrypoint. Each writer has its own terminable Worker;
 * stale responses are gated by request ID and worker identity. */
export async function convertStirlingEditableDocument(file: File, sourcePageIndexes: readonly number[], format: "pptx" | "hwpx",
  name: string, language: AppLanguage, progress?: WorkerProgress, signal?: AbortSignal): Promise<StirlingOutput> {
  if (!sourcePageIndexes.length) throw new Error("No PDF pages selected");
  const output = await writeStirlingDocument({ pages: [], source: file, sourcePageIndexes: [...sourcePageIndexes], format, name, language, progress, signal });
  const warnings = [language === "ko"
    ? "글자와 그림을 편집 가능한 개체로 배치했습니다. PDF의 벡터 도형·표 셀·원본 글꼴이 완전히 복원되지는 않을 수 있습니다."
    : "Text and pictures are placed as editable objects. Vector shapes, table cells, and original fonts may not be fully restored."];
  if (output.hasAnnotations) warnings.push(language === "ko" ? "일부 주석은 편집 가능한 개체로 옮겨지지 않을 수 있습니다." : "Some annotations may not transfer as editable objects.");
  if (output.imagePreservedSourceIndexes.length) warnings.push(language === "ko"
    ? "글자가 없는 페이지는 그림으로 보존했습니다. 해당 그림 속 글자는 편집할 수 없습니다."
    : "Pages without text are preserved as pictures. Text in those pictures is not editable.");
  return { ...output, warnings };
}

export async function convertStirlingImagePages(pages: StirlingImagePage[], format: "pptx" | "hwpx", name: string,
  language: AppLanguage, progress?: WorkerProgress, signal?: AbortSignal): Promise<StirlingOutput> {
  if (!pages.length) throw new Error("No PDF pages selected");
  const output = await writeStirlingDocument({ pages: [], imagePages: pages, format, name, language, progress, signal });
  return { ...output, warnings: [language === "ko"
    ? "페이지 이미지를 원본 비율로 보존했습니다. 이미지 속 글자는 편집할 수 없습니다."
    : "Pages are preserved as proportionally fitted images. Text inside the images is not editable."] };
}

async function writeStirlingDocument(input: { pages: PageData[]; imagePages?: StirlingImagePage[]; format: "pptx" | "hwpx";
  source?: File; sourcePageIndexes?: number[]; name: string; language: AppLanguage; progress?: WorkerProgress; signal?: AbortSignal }): Promise<StirlingOutput & { hasAnnotations: boolean; imagePreservedSourceIndexes: number[] }> {
  if (input.signal?.aborted) throw aborted();
  const previous = queue;
  let release!: () => void;
  queue = new Promise<void>(resolve => { release = resolve; });
  try {
    await waitTurn(previous, input.signal);
    if (input.signal?.aborted) throw aborted();
    return await runWorker(input);
  } finally { void previous.then(release); }
}

function waitTurn(previous: Promise<void>, signal?: AbortSignal) {
  if (!signal) return previous;
  return new Promise<void>((resolve, reject) => {
    const abort = () => { signal.removeEventListener("abort", abort); reject(aborted()); };
    signal.addEventListener("abort", abort, { once: true });
    void previous.then(() => { signal.removeEventListener("abort", abort); resolve(); });
  });
}

function dropWorker(worker: Worker) {
  if (sessionWorker !== worker) return;
  worker.terminate();
  sessionWorker = undefined;
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = undefined;
}

function runWorker(input: { pages: PageData[]; imagePages?: StirlingImagePage[]; format: "pptx" | "hwpx";
  source?: File; sourcePageIndexes?: number[]; name: string; language: AppLanguage; progress?: WorkerProgress; signal?: AbortSignal }): Promise<StirlingOutput & { hasAnnotations: boolean; imagePreservedSourceIndexes: number[] }> {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = undefined;
  const worker = sessionWorker ??= new Worker(new URL("./stirlingDocument.worker.ts", import.meta.url), { type: "module" });
  const id = ++nextRequestId;
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (action: () => void, discard = false) => {
      if (settled) return;
      settled = true;
      input.signal?.removeEventListener("abort", abort);
      worker.onmessage = null;
      worker.onerror = null;
      if (discard) dropWorker(worker);
      else idleTimer = setTimeout(() => dropWorker(worker), 60_000);
      action();
    };
    const abort = () => finish(() => reject(aborted()), true);
    input.signal?.addEventListener("abort", abort, { once: true });
    worker.onerror = event => finish(() => reject(new Error(event.message || "Document writer failed")), true);
    worker.onmessage = (event: MessageEvent<{ id: number; type: "result" | "progress" | "error"; buffer?: ArrayBuffer; value?: number; message?: string;
      hasAnnotations?: boolean; imagePreservedSourceIndexes?: number[] }>) => {
      const data = event.data;
      if (settled || data.id !== id) return;
      if (data.type === "progress") { input.progress?.(data.value ?? 0, (data.value ?? 0) < 50
        ? input.language === "ko" ? "PDF 배치를 분석하는 중" : "Analyzing PDF layout"
        : input.language === "ko" ? "문서를 작성하는 중" : "Writing document"); return; }
      if (data.type === "error") { finish(() => reject(new Error(data.message || "Document writer failed")), true); return; }
      if (data.buffer) finish(() => resolve({ blob: new Blob([data.buffer!], { type: MIME[input.format] }),
        fileName: ensurePdfExtension(input.name, input.format), mimeType: MIME[input.format], warnings: [],
        hasAnnotations: Boolean(data.hasAnnotations), imagePreservedSourceIndexes: data.imagePreservedSourceIndexes ?? [] }));
    };
    worker.postMessage({ id, format: input.format, name: input.name, language: input.language, pages: input.pages,
      imagePages: input.imagePages, source: input.source, sourcePageIndexes: input.sourcePageIndexes });
  });
}

function aborted() { return new DOMException("Conversion cancelled", "AbortError"); }
