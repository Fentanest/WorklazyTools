/// <reference lib="webworker" />
import { createWorker, type Worker as TesseractWorker } from "tesseract.js";

type Language = "kor" | "eng" | "kor+eng";
type Request = { id: number; type: "recognize"; image: Blob; language: Language; layout: "sparse" | "paragraphs"; searchablePdf: boolean } | { id: number; type: "dispose" };
const scope = self as DedicatedWorkerGlobalScope;
const ownedChildren = new Set<Worker>();
const nativeWorker = (scope as unknown as { Worker: typeof Worker }).Worker;
Object.defineProperty(scope, "Worker", { configurable: true, value: new Proxy(nativeWorker, {
  construct(target, argumentsList) {
    const child = Reflect.construct(target, argumentsList) as Worker;
    ownedChildren.add(child);
    return child;
  },
}) });
const base = new URL(`${import.meta.env.BASE_URL}vendor/tesseract/7.0.0/`, self.location.origin).href;
let runtime: TesseractWorker | undefined;
let loading: Promise<TesseractWorker> | undefined;
let loadedLanguage = "";
let activeId = 0;
let queue = Promise.resolve();

async function getRuntime(language: Language) {
  if (runtime && loadedLanguage === language) return runtime;
  if (runtime) { await runtime.terminate(); for (const child of ownedChildren) child.terminate(); ownedChildren.clear(); runtime = undefined; loading = undefined; }
  if (loading && loadedLanguage !== language) await loading.catch(() => undefined);
  loadedLanguage = language;
  loading ??= createWorker(language.split("+"), undefined, {
    workerPath: `${base}worker.min.js`, corePath: `${base}core/`, langPath: `${base}lang/`,
    logger: message => scope.postMessage({ id: activeId, type: "progress", status: message.status, value: message.progress }),
  }).then(created => { runtime = created; return created; }).catch(error => { loading = undefined; runtime = undefined; loadedLanguage = ""; throw error; });
  return loading;
}

scope.onmessage = (event: MessageEvent<Request>) => {
  const request = event.data;
  if (request.type === "dispose") {
    const active = runtime;
    const childCount = ownedChildren.size;
    runtime = undefined; loading = undefined; loadedLanguage = "";
    for (const child of ownedChildren) child.terminate();
    ownedChildren.clear();
    // Chromium may keep a terminated child alive briefly while its image
    // decode job unwinds. Let that termination settle before closing owner.
    const ack = () => setTimeout(() => scope.postMessage({ id: request.id, type: "disposed", childCount, hadRuntime: Boolean(active) }), 150);
    if (active) void active.terminate().then(ack, ack);
    else ack();
    return;
  }
  queue = queue.then(async () => {
    activeId = request.id;
    try {
      const worker = await getRuntime(request.language);
      await worker.setParameters({ tessedit_pageseg_mode: (request.layout === "sparse" ? "11" : "3") as import("tesseract.js").PSM });
      const recognized = await worker.recognize(request.image, { pdfTextOnly: false }, { text: true, blocks: true, hocr: true, pdf: request.searchablePdf });
      scope.postMessage({ id: request.id, type: "result", data: recognized.data });
    } catch (error) {
      scope.postMessage({ id: request.id, type: "error", code: error instanceof Error ? error.message : String(error) });
    }
  });
};
