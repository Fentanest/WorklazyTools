import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createRequire } from "node:module";
import { performance } from "node:perf_hooks";
import { pathToFileURL } from "node:url";
import test from "node:test";

import { cancelPdfRender, waitForPdfRender } from "../../src/features/pdf-editor/pdfRenderLifecycle.ts";
import { throwIfAborted, yieldBeforeResultRegistration, yieldToEventLoop } from "../../src/utils/cooperativeCancel.ts";
import { runModuleWorker } from "../../src/utils/workerLifecycle.ts";

const repositoryRoot = path.resolve(import.meta.dirname, "../..");
const bundleDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "worklazy-pdf-lifecycle-unit-"));
const bundlePath = path.join(bundleDirectory, "pdf-worker-lifecycle.mjs");
const require = createRequire(import.meta.url);
const { buildSync } = require("esbuild") as typeof import("esbuild");
buildSync({
  stdin: {
    contents: [
      'export { runPdfWorker, pdfWorkerCanceledMessage } from "./src/features/pdf-editor/pdfWorkerLifecycle.ts";',
      'export { mergePdfPages } from "./src/features/pdf-editor/pdfWorkerClient.ts";',
      'export { featureMessage } from "./src/i18n/featureMessages.ts";',
      'export { workerMessage } from "./src/i18n/workerMessages.ts";',
    ].join("\n"),
    loader: "ts",
    resolveDir: repositoryRoot,
  },
  outfile: bundlePath,
  bundle: true,
  format: "esm",
  platform: "node",
  logLevel: "silent",
});
const { featureMessage, mergePdfPages, pdfWorkerCanceledMessage, runPdfWorker, workerMessage } = await import(pathToFileURL(bundlePath).href) as {
  featureMessage: (language: "ko" | "en", key: string) => string;
  pdfWorkerCanceledMessage: (language: "ko" | "en") => string;
  runPdfWorker: typeof import("../../src/features/pdf-editor/pdfWorkerLifecycle.ts").runPdfWorker;
  mergePdfPages: typeof import("../../src/features/pdf-editor/pdfWorkerClient.ts").mergePdfPages;
  workerMessage: (language: "ko" | "en", key: string) => string;
};
test.after(() => fs.rmSync(bundleDirectory, { recursive: true, force: true }));

type WorkerEvent =
  | { type: "progress"; progress?: number; message?: string }
  | { type: "result"; result: unknown }
  | { type: "error"; error?: { message?: string; code?: string } };

for (const language of ["ko", "en"] as const) {
  test(`PDF worker facade preserves ${language} result, warnings, progress, transfer identity, and one termination`, async () => {
    const warningToken = workerMessage(language, "pdf.messages.pdf.editingAPdfInvalidatesItsDigitalSignatures");
    const progressToken = workerMessage(language, "pdf.messages.pdf.readingSourcePdfs");
    const resultBuffer = new ArrayBuffer(3);
    const worker = fakeWorker([
      { type: "progress", progress: 18, message: progressToken },
      { type: "result", result: { buffer: resultBuffer, warnings: [warningToken], untouched: 7 } },
    ]);
    const request = { type: "merge", language };
    const transferredBuffer = new ArrayBuffer(4);
    const transfer = [transferredBuffer];
    const progress: Array<[number, string]> = [];

    const result = await runPdfWorker<
      typeof request,
      { buffer: ArrayBuffer; warnings: string[]; untouched: number }
    >(() => worker as unknown as Worker, request, transfer, (...args) => progress.push(args), language);

    assert.equal(result.buffer, resultBuffer);
    assert.equal(result.untouched, 7);
    assert.deepEqual(result.warnings, [featureMessage(language, "pdf.messages.pdf.editingAPdfInvalidatesItsDigitalSignatures")]);
    assert.deepEqual(progress, [[18, featureMessage(language, "pdf.messages.pdf.readingSourcePdfs")]]);
    assert.equal(worker.posted[0].message, request);
    assert.equal(worker.posted[0].transfer, transfer);
    assert.equal(worker.posted[0].transfer[0], transferredBuffer);
    assert.equal(worker.terminated, 1);
  });

  test(`PDF worker facade preserves ${language} nested error localization and code`, async () => {
    const message = workerMessage(language, "pdf.messages.pdf.unableToReadThePdfItMayBe");
    const worker = fakeWorker([{ type: "error", error: { message, code: "INVALID_PDF" } }]);

    await assert.rejects(
      runPdfWorker(() => worker as unknown as Worker, { type: "merge" }, [], undefined, language),
      (error: unknown) => error instanceof Error
        && error.message === featureMessage(language, "pdf.messages.pdf.unableToReadThePdfItMayBe")
        && (error as Error & { code?: string }).code === "INVALID_PDF",
    );
    assert.equal(worker.terminated, 1);
  });
}

test("PDF worker facade rejects a pre-aborted request, removes the listener, and terminates once", async () => {
  const controller = countedAbortController();
  controller.abort();
  const worker = fakeWorker([]);
  await assert.rejects(
    runPdfWorker(() => worker as unknown as Worker, {}, [], undefined, "ko", controller.signal),
    (error: unknown) => error instanceof DOMException
      && error.name === "AbortError"
      && error.message === pdfWorkerCanceledMessage("ko"),
  );
  assert.equal(worker.terminated, 1);
  assert.equal(controller.listenerCount(), 0);
});

test("PDF worker facade discards a late result after cancellation", async () => {
  const controller = countedAbortController();
  const worker = fakeWorker([]);
  const pending = runPdfWorker(() => worker as unknown as Worker, {}, [], undefined, "en", controller.signal);
  controller.abort();
  worker.emit({ type: "result", result: 9 });
  await assert.rejects(pending, (error: unknown) => error instanceof DOMException && error.name === "AbortError");
  assert.equal(worker.terminated, 1);
  assert.equal(controller.listenerCount(), 0);
});

test("PDF worker facade keeps the abort error when a late worker error arrives in the same turn", async () => {
  const { error, worker, controller } = await runTerminalRace("abort");
  assert.equal(error.name, "AbortError");
  assert.equal(error.message, pdfWorkerCanceledMessage("en"));
  assert.equal(error.code, new DOMException("", "AbortError").code);
  assert.equal(worker.terminated, 1);
  assert.equal(controller.listenerCount(), 0);
});

test("PDF worker facade keeps the first worker error when a late worker error arrives in the same turn", async () => {
  const { error, worker, controller } = await runTerminalRace("error");
  assert.equal(error.name, "Error");
  assert.equal(error.message, "FIRST");
  assert.equal(error.code, "FIRST_CODE");
  assert.equal(worker.terminated, 1);
  assert.equal(controller.listenerCount(), 0);
});

test("PDF worker facade keeps the start error after an error event and a late worker error", async () => {
  const { error, worker, controller } = await runTerminalRace("error-event");
  assert.equal(error.name, "Error");
  assert.equal(error.message, featureMessage("en", "pdf.messages.pdfWorkerClient.unableToStartThePdfOperation"));
  assert.equal(error.code, undefined);
  assert.equal(worker.terminated, 1);
  assert.equal(controller.listenerCount(), 0);
});

test("PDF worker facade keeps the start error after postMessage throws and a late worker error", async () => {
  const { error, worker, controller } = await runTerminalRace("post-throw");
  assert.equal(error.name, "Error");
  assert.equal(error.message, featureMessage("en", "pdf.messages.pdfWorkerClient.unableToStartThePdfOperation"));
  assert.equal(error.code, undefined);
  assert.equal(worker.terminated, 1);
  assert.equal(controller.listenerCount(), 0);
});

test("PDF worker facade keeps the abort error when a worker error arrives in the next task", async () => {
  const controller = countedAbortController();
  const worker = fakeWorker([]);
  const pendingError = rejectedError(runPdfWorker(() => worker as unknown as Worker, {}, [], undefined, "en", controller.signal));
  controller.abort();
  await new Promise<void>((resolve) => setTimeout(resolve, 0));
  worker.emit({ type: "error", error: { message: "LATE", code: "LATE_CODE" } });
  const error = await pendingError;
  assert.equal(error.name, "AbortError");
  assert.equal(error.message, pdfWorkerCanceledMessage("en"));
  assert.equal(error.code, new DOMException("", "AbortError").code);
  assert.equal(worker.terminated, 1);
  assert.equal(controller.listenerCount(), 0);
});

test("shared lifecycle timeout terminates a stalled worker once", async () => {
  const worker = fakeWorker([]);
  await assert.rejects(
    runModuleWorker(() => worker as unknown as Worker, {}, {
      inactivityTimeoutMs: 10,
      timeoutMessage: "timed out",
      canceledMessage: "canceled",
      startErrorMessage: "start",
      resultErrorMessage: "result",
    }),
    (error: unknown) => error instanceof Error && (error as Error & { code?: string }).code === "WORKER_TIMEOUT",
  );
  assert.equal(worker.terminated, 1);
});

test("PDF worker facade maps a postMessage exception to the localized start error", async () => {
  const worker = fakeWorker([], { throwPost: true });
  await assert.rejects(
    runPdfWorker(() => worker as unknown as Worker, {}, [], undefined, "en"),
    new Error(featureMessage("en", "pdf.messages.pdfWorkerClient.unableToStartThePdfOperation")),
  );
  assert.equal(worker.terminated, 1);
});

test("PDF worker facade accepts only the first terminal message", async () => {
  const worker = fakeWorker([
    { type: "result", result: 7 },
    { type: "error", error: { message: "late", code: "LATE" } },
  ]);
  assert.equal(await runPdfWorker(() => worker as unknown as Worker, {}, []), 7);
  assert.equal(worker.terminated, 1);
});

test("PDF worker facade handles an error event without exposing its raw message", async () => {
  const worker = fakeWorker([]);
  const pending = runPdfWorker(() => worker as unknown as Worker, {}, [], undefined, "ko");
  const event = worker.emitError("raw worker exception");
  await assert.rejects(
    pending,
    new Error(featureMessage("ko", "pdf.messages.pdfWorkerClient.unableToStartThePdfOperation")),
  );
  assert.equal(event.defaultPrevented, true);
  assert.equal(worker.terminated, 1);
});

test("PDF worker facade maps a constructor exception to the localized start error", async () => {
  await assert.rejects(
    runPdfWorker(() => { throw new Error("raw constructor exception"); }, {}, [], undefined, "en"),
    new Error(featureMessage("en", "pdf.messages.pdfWorkerClient.unableToStartThePdfOperation")),
  );
});

test("PDF worker client checks cancellation before and after each file read without starting a worker", async () => {
  const originalWorker = globalThis.Worker;
  let workerConstructions = 0;
  globalThis.Worker = class {
    constructor() { workerConstructions += 1; }
  } as unknown as typeof Worker;
  try {
    let preReadCalls = 0;
    const preAborted = new AbortController();
    preAborted.abort();
    await assert.rejects(
      mergePdfPages(
        [{ id: "first", file: { name: "first.pdf", type: "application/pdf", arrayBuffer: async () => { preReadCalls += 1; return new ArrayBuffer(1); } } as File }],
        [{ sourceId: "first", pageIndex: 0, rotation: 0 }],
        "out.pdf",
        undefined,
        "ko",
        {},
        preAborted.signal,
      ),
      (error: unknown) => error instanceof DOMException && error.name === "AbortError" && error.message === pdfWorkerCanceledMessage("ko"),
    );
    assert.equal(preReadCalls, 0);

    const midRead = new AbortController();
    const readCalls: string[] = [];
    await assert.rejects(
      mergePdfPages(
        [
          { id: "first", file: { name: "first.pdf", type: "application/pdf", arrayBuffer: async () => { readCalls.push("first"); midRead.abort(); return new ArrayBuffer(1); } } as File },
          { id: "second", file: { name: "second.pdf", type: "application/pdf", arrayBuffer: async () => { readCalls.push("second"); return new ArrayBuffer(1); } } as File },
        ],
        [
          { sourceId: "first", pageIndex: 0, rotation: 0 },
          { sourceId: "second", pageIndex: 0, rotation: 0 },
        ],
        "out.pdf",
        undefined,
        "en",
        {},
        midRead.signal,
      ),
      (error: unknown) => error instanceof DOMException && error.name === "AbortError" && error.message === pdfWorkerCanceledMessage("en"),
    );
    assert.deepEqual(readCalls, ["first"]);
    assert.equal(workerConstructions, 0);
  } finally {
    globalThis.Worker = originalWorker;
  }
});

test("task yielding lets a timer cancellation stop the 12-step counterexample after one step", async () => {
  async function run(yieldStep: () => Promise<void>) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 0);
    let completed = 0;
    try {
      for (; completed < 12; completed += 1) {
        if (controller.signal.aborted) break;
        const busyUntil = performance.now() + 3;
        while (performance.now() < busyUntil) { /* deterministic task pressure */ }
        await yieldStep();
      }
      return { completed, aborted: controller.signal.aborted };
    } finally {
      clearTimeout(timer);
    }
  }

  assert.deepEqual(await run(() => Promise.resolve()), { completed: 12, aborted: false });
  assert.deepEqual(await run(yieldToEventLoop), { completed: 1, aborted: true });
});

test("result registration yields and checks cancellation again", async () => {
  const controller = new AbortController();
  const retained = ["previous"];
  setTimeout(() => controller.abort(), 0);
  await assert.rejects(yieldBeforeResultRegistration(controller.signal), (error: unknown) => error instanceof DOMException && error.name === "AbortError");
  if (!controller.signal.aborted) retained.push("current");
  assert.deepEqual(retained, ["previous"]);
  assert.throws(() => throwIfAborted(controller.signal), (error: unknown) => error instanceof DOMException && error.name === "AbortError");
});

test("PDF render cancellation settles before cleanup and destroys an owned document last", async () => {
  const log: string[] = [];
  const renderTask = cancelingRenderTask(log);
  await cancelPdfRender(
    renderTask,
    { cleanup: () => { log.push("cleanup"); return true; } },
    { ownsDocument: true, loadingTask: { destroy: async () => { log.push("destroy"); } } },
  );
  assert.deepEqual(log, ["cancel", "settled", "cleanup", "destroy"]);
});

test("PDF render cancellation never destroys a shared preview document without ownership", async () => {
  const log: string[] = [];
  const renderTask = cancelingRenderTask(log);
  await cancelPdfRender(
    renderTask,
    { cleanup: () => { log.push("cleanup"); return true; } },
    { ownsDocument: false, loadingTask: { destroy: async () => { log.push("destroy"); } } },
  );
  assert.deepEqual(log, ["cancel", "settled", "cleanup"]);
});

test("PDF render cancellation preserves cleanup order while swallowing every cancellation cleanup exception", async () => {
  const log: string[] = [];
  await assert.doesNotReject(cancelPdfRender(
    {
      cancel: () => { log.push("cancel"); throw new Error("already settled"); },
      promise: Promise.reject(Object.assign(new Error("cancelled"), { name: "RenderingCancelledException" })).finally(() => { log.push("settled"); }),
    },
    { cleanup: () => { log.push("cleanup"); throw new Error("cleanup failed"); } },
    { ownsDocument: true, loadingTask: { destroy: async () => { log.push("destroy"); throw new Error("destroy failed"); } } },
  ));
  assert.deepEqual(log, ["cancel", "settled", "cleanup", "destroy"]);
});

test("AbortSignal drives PDF render cancellation through settle and cleanup", async () => {
  const log: string[] = [];
  const renderTask = cancelingRenderTask(log);
  const controller = new AbortController();
  const pending = waitForPdfRender(renderTask, { cleanup: () => { log.push("cleanup"); return true; } }, { signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, (error: unknown) => error instanceof DOMException && error.name === "AbortError");
  assert.deepEqual(log, ["cancel", "settled", "cleanup"]);
});

function fakeWorker(events: WorkerEvent[], options: { throwPost?: boolean } = {}) {
  const worker = {
    onmessage: null as ((event: MessageEvent) => void) | null,
    onerror: null as ((event: ErrorEvent) => void) | null,
    terminated: 0,
    posted: [] as Array<{ message: unknown; transfer: Transferable[] }>,
    postMessage(message: unknown, transfer: Transferable[] = []) {
      worker.posted.push({ message, transfer });
      if (options.throwPost) throw new Error("post failure");
      queueMicrotask(() => events.forEach((event) => worker.emit(event)));
    },
    terminate() {
      worker.terminated += 1;
    },
    emit(data: WorkerEvent) {
      worker.onmessage?.({ data } as MessageEvent);
    },
    emitError(message: string) {
      const event = {
        message,
        defaultPrevented: false,
        preventDefault() { event.defaultPrevented = true; },
      };
      worker.onerror?.(event as unknown as ErrorEvent);
      return event;
    },
  };
  return worker;
}

function countedAbortController() {
  const controller = new AbortController();
  let listeners = 0;
  const add = controller.signal.addEventListener.bind(controller.signal);
  const remove = controller.signal.removeEventListener.bind(controller.signal);
  controller.signal.addEventListener = ((...args: Parameters<AbortSignal["addEventListener"]>) => {
    listeners += 1;
    return add(...args);
  }) as AbortSignal["addEventListener"];
  controller.signal.removeEventListener = ((...args: Parameters<AbortSignal["removeEventListener"]>) => {
    listeners -= 1;
    return remove(...args);
  }) as AbortSignal["removeEventListener"];
  return Object.assign(controller, { listenerCount: () => listeners });
}

async function runTerminalRace(first: "abort" | "error" | "error-event" | "post-throw") {
  const controller = countedAbortController();
  const worker = fakeWorker([], { throwPost: first === "post-throw" });
  const pending = runPdfWorker(() => worker as unknown as Worker, {}, [], undefined, "en", controller.signal);
  if (first === "abort") controller.abort();
  if (first === "error") worker.emit({ type: "error", error: { message: "FIRST", code: "FIRST_CODE" } });
  if (first === "error-event") assert.equal(worker.emitError("raw worker exception").defaultPrevented, true);
  worker.emit({ type: "error", error: { message: "LATE", code: "LATE_CODE" } });
  return { error: await rejectedError(pending), worker, controller };
}

async function rejectedError(promise: Promise<unknown>) {
  let rejection: unknown;
  try {
    await promise;
  } catch (error) {
    rejection = error;
  }
  assert.ok(rejection instanceof Error);
  return rejection as Error & { code?: string | number };
}

function cancelingRenderTask(log: string[]) {
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((_resolve, rejectPromise) => { reject = rejectPromise; });
  return {
    promise,
    cancel() {
      log.push("cancel");
      queueMicrotask(() => {
        log.push("settled");
        const error = new Error("render canceled");
        error.name = "RenderingCancelledException";
        reject(error);
      });
    },
  };
}
