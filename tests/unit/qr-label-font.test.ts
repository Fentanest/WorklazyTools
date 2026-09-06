import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { gunzipSync } from "node:zlib";
import ts from "typescript";

import coverageInput from "../../scripts/assets/qr-label-font/noto-cjk-sans-2.004-ksx1001-v1/coverage.json" with { type: "json" };
import {
  createQrLabelFontLoader,
  qrCoverageSet,
  qrLabelFontAssets,
  selectQrLabelFont,
} from "../../src/features/qr-studio/qrLabelFont.ts";
import { createQrLabelPdf } from "../../src/features/qr-studio/qrLabelPdf.ts";
import { QrLabelFontInitError } from "../../src/features/qr-studio/qrLabelFont.ts";

const coverage = qrCoverageSet(coverageInput);
const qrBulkPanelSource = fs.readFileSync(new URL("../../src/features/qr-studio/QrBulkPanel.tsx", import.meta.url), "utf8");

test("QR font coverage schema is exact, sorted and includes the ellipsis", () => {
  assert.ok(coverage);
  assert.equal(coverage.size, 3_394);
  assert.ok(coverage.has(0x2026));
  const valid = structuredClone(coverageInput) as typeof coverageInput;
  const malformed: unknown[] = [
    null,
    [],
    { ...valid, extra: true },
    { ...valid, schema: 2 },
    { ...valid, snapshot: "other" },
    { ...valid, codepoints: valid.codepoints.slice(1) },
    { ...valid, codepoints: [...valid.codepoints.slice(0, -1), valid.codepoints.at(-2)] },
    { ...valid, codepoints: [...valid.codepoints.slice(0, 20), 0xd800, ...valid.codepoints.slice(21)] },
    { ...valid, codepoints: valid.codepoints.filter((value) => value !== 0x2026).concat(0x10ffff).sort((a, b) => a - b) },
  ];
  malformed.forEach((value) => assert.equal(qrCoverageSet(value), undefined));
});

test("QR labels require coverage for both original and NFC text", async () => {
  assert.equal(await selectQrLabelFont([], undefined, coverage), "subset");
  assert.equal(await selectQrLabelFont([{ title: "한글 라벨 … café", description: "₩12,000" }], undefined, coverage), "subset");
  assert.equal(await selectQrLabelFont([{ title: "똠", description: "" }], undefined, coverage), "full");
  assert.equal(await selectQrLabelFont([{ title: "똠", description: "" }], undefined, coverage), "full", "NFC must reject a composed syllable outside the subset");
  assert.equal(await selectQrLabelFont([{ title: "e\u0301", description: "" }], undefined, coverage), "full", "original combining marks must not be hidden by NFC");
  assert.equal(await selectQrLabelFont([{ title: "😀", description: "" }], undefined, coverage), "full");
  assert.equal(await selectQrLabelFont([{ title: "漢", description: "" }], undefined, coverage), "full");
});

test("all 11,172 modern Hangul syllables select subset exactly when their NFD and NFC forms are covered", async () => {
  assert.ok(coverage);
  let expectedSubset = 0;
  for (let codepoint = 0xac00; codepoint <= 0xd7a3; codepoint += 1) {
    const syllable = String.fromCodePoint(codepoint);
    const expected = coverage.has(codepoint) ? "subset" : "full";
    if (expected === "subset") expectedSubset += 1;
    assert.equal(
      await selectQrLabelFont([{ title: syllable.normalize("NFD"), description: "" }], undefined, coverage),
      expected,
      `U+${codepoint.toString(16).toUpperCase()}`,
    );
  }
  assert.equal(expectedSubset, 2_350);
});

test("coverage scanning yields at the 8,192-codepoint boundary and observes abort", async () => {
  const controller = new AbortController();
  const originalNow = performance.now;
  let clock = 0;
  Object.defineProperty(performance, "now", { configurable: true, value: () => (clock += 9) });
  const pending = selectQrLabelFont([{ title: "가".repeat(8_192), description: "" }], controller.signal, coverage);
  controller.abort();
  await assert.rejects(pending, (error) => error instanceof Error && error.name === "AbortError");
  Object.defineProperty(performance, "now", { configurable: true, value: originalNow });
});

test("font loader validates size and SHA, caches at most the two named assets, and supports an omitted signal", async () => {
  await withAssetMocks(async ({ requests }) => {
    const loader = createQrLabelFontLoader("/base/", "https://example.test");
    const subset = await loader.load("subset");
    const full = await loader.load("full");
    assert.equal(subset.bytes.byteLength, qrLabelFontAssets.subset.size);
    assert.equal(full.bytes.byteLength, qrLabelFontAssets.full.size);
    assert.equal((await loader.load("subset")).bytes, subset.bytes);
    assert.equal((await loader.load("full")).bytes, full.bytes);
    assert.deepEqual(requests, [
      `https://example.test/base/${qrLabelFontAssets.subset.path}`,
      `https://example.test/base/${qrLabelFontAssets.full.path}`,
    ]);
  });
});

test("every subset asset failure falls back once to full and failed subset bytes are never cached", async () => {
  for (const failure of ["http", "network", "body", "empty", "truncated", "html", "sha"] as const) {
    await withAssetMocks(async ({ requests, setFailure }) => {
      setFailure("subset", failure);
      const loader = createQrLabelFontLoader("/", "https://example.test");
      assert.equal((await loader.acquire("subset")).kind, "full", failure);
      assert.equal((await loader.acquire("subset")).kind, "full", failure);
      assert.deepEqual(requests.map((url) => new URL(url).pathname), [
        `/${qrLabelFontAssets.subset.path}`,
        `/${qrLabelFontAssets.full.path}`,
        `/${qrLabelFontAssets.subset.path}`,
      ], failure);
    });
  }
});

test("full asset failure and failure of both assets do not retry", async () => {
  await withAssetMocks(async ({ requests, setFailure }) => {
    setFailure("full", "http");
    const loader = createQrLabelFontLoader("/", "https://example.test");
    await assert.rejects(loader.load("full"));
    assert.equal(requests.length, 1);
  });
  await withAssetMocks(async ({ requests, setFailure }) => {
    setFailure("subset", "sha");
    setFailure("full", "network");
    const loader = createQrLabelFontLoader("/", "https://example.test");
    await assert.rejects(loader.acquire("subset"));
    assert.equal(requests.length, 2);
  });
});

test("abort and dispose prevent stale fetch or digest completion from reviving cache", async () => {
  const controller = new AbortController();
  await withAssetMocks(async ({ requests, deferBody, releaseBody }) => {
    deferBody();
    const loader = createQrLabelFontLoader("/", "https://example.test");
    const pending = loader.load("subset", controller.signal);
    await new Promise((resolve) => setImmediate(resolve));
    controller.abort();
    releaseBody();
    await assert.rejects(pending, (error) => error instanceof Error && error.name === "AbortError");
    assert.equal(requests.length, 1);
  });

  await withAssetMocks(async ({ requests, deferDigest, releaseDigest }) => {
    deferDigest();
    const loader = createQrLabelFontLoader("/", "https://example.test");
    const pending = loader.load("subset");
    await new Promise((resolve) => setImmediate(resolve));
    loader.dispose();
    releaseDigest();
    await assert.rejects(pending, (error) => error instanceof Error && error.name === "AbortError");
    assert.equal(requests.length, 1);
  });
});

test("only font registration or embedding failures cross the typed font-init boundary", async () => {
  await assert.rejects(
    createQrLabelPdf([], "a4", new ArrayBuffer(0)),
    (error) => error instanceof QrLabelFontInitError,
  );
  const compressed = fs.readFileSync(new URL(
    "../../scripts/assets/qr-label-font/noto-cjk-sans-2.004-ksx1001-v1/NotoSansKR-Regular.ksx1001.otf.gz",
    import.meta.url,
  ));
  const font = gunzipSync(compressed);
  const exactFont = font.buffer.slice(font.byteOffset, font.byteOffset + font.byteLength);
  await assert.rejects(
    createQrLabelPdf([{ png: new Blob(["not a png"]), title: "한글", description: "" }], "a4", exactFont),
    (error) => !(error instanceof QrLabelFontInitError),
  );
});

test("QR panel product handlers keep an old ZIP finally from releasing a newer PDF lease", async () => {
  await assertQrExportOwnership(qrBulkPanelSource);
});

test("QR export lease regression detects removal of the product ownership guard", async () => {
  const guard = "    if (!owned) return;";
  assert.equal(qrBulkPanelSource.split(guard).length - 1, 1);
  const mutant = qrBulkPanelSource.replace(guard, "    // Mutation control: ownership guard removed");
  await assert.rejects(
    assertQrExportOwnership(mutant),
    (error) => error instanceof assert.AssertionError && error.actual === "" && error.expected === "pdf",
  );
});

test("QR panel cancel executes product invalidation and prevents a stale PDF download", async () => {
  const save = deferred<Blob>();
  const { panel, deps, stats } = createQrPanelHarness(qrBulkPanelSource);
  deps.pdfModule = async () => ({
    createQrLabelPdf: async () => {
      stats.pdfCalls += 1;
      return save.promise;
    },
  });
  const pending = panel.downloadPdf();
  await waitForCondition(() => stats.pdfCalls === 1);
  assert.equal(panel.state().exporting, "pdf");

  panel.cancel();
  assert.equal(panel.state().exporting, "");
  assert.equal(panel.state().active, undefined);
  assert.equal(stats.disposals, 1);
  save.resolve(new Blob(["late pdf"]));
  await pending;
  assert.deepEqual(panel.events.filter(([type]) => type === "download" || type === "message"), []);
});

test("QR panel final task yield lets queued cancellation block a completed PDF Blob", async () => {
  const cancellation = deferred<void>();
  const { panel, deps, stats } = createQrPanelHarness(qrBulkPanelSource);
  deps.pdfModule = async () => ({
    createQrLabelPdf: async () => {
      stats.pdfCalls += 1;
      setTimeout(() => {
        panel.cancel();
        cancellation.resolve();
      }, 0);
      return new Blob(["completed pdf"]);
    },
  });

  const pending = panel.downloadPdf();
  await Promise.all([pending, cancellation.promise]);

  assert.equal(stats.pdfCalls, 1);
  assert.equal(panel.events.filter(([type]) => type === "download").length, 0);
  assert.equal(panel.events.filter(([type]) => type === "message").length, 0);
  assert.equal(panel.state().exporting, "");
  assert.equal(panel.state().active, undefined);
  assert.equal(stats.disposals, 1);
});

test("QR panel cleanup detaches old storage before awaiting clear and preserves replacement storage", async () => {
  const save = deferred<Blob>();
  const clear = deferred<void>();
  const { panel, deps, stats } = createQrPanelHarness(qrBulkPanelSource);
  const oldStorage = { read: async () => new Blob(["png"]), clear: () => clear.promise };
  const replacementStorage = { read: async () => new Blob(["new png"]), clear: async () => undefined };
  panel.setData(sampleQrResults(), oldStorage);
  deps.pdfModule = async () => ({
    createQrLabelPdf: async () => {
      stats.pdfCalls += 1;
      return save.promise;
    },
  });
  const pendingExport = panel.downloadPdf();
  await waitForCondition(() => stats.pdfCalls === 1);

  const pendingCleanup = panel.cleanupResults();
  assert.equal(panel.state().storage, undefined);
  assert.equal(panel.state().active, undefined);
  assert.equal(panel.state().exporting, "");
  panel.setData(sampleQrResults("replacement"), replacementStorage);
  clear.resolve();
  await pendingCleanup;
  assert.equal(panel.state().storage, replacementStorage);

  save.resolve(new Blob(["late pdf"]));
  await pendingExport;
  assert.deepEqual(panel.events.filter(([type]) => type === "download" || type === "message"), []);
});

test("QR run abort and error product branches detach storage before clear and invalidate export", async () => {
  for (const branch of ["abort", "error"] as const) {
    const clear = deferred<void>();
    const storage = { clear: () => clear.promise };
    const replacementStorage = { clear: async () => undefined };
    const run = createQrRunDiscardHarness(qrBulkPanelSource, branch, storage);
    const pending = run.execute();
    assert.equal(run.state().storage, undefined, branch);
    assert.equal(run.state().active, undefined, branch);
    assert.equal(run.state().exporting, "", branch);
    assert.equal(run.state().controllerAborted, true, branch);
    assert.equal(run.state().disposals, 1, branch);
    run.setStorage(replacementStorage);
    clear.resolve();
    await pending;
    assert.equal(run.state().storage, replacementStorage, branch);
    assert.deepEqual(run.state().results, [], branch);
  }
});

test("QR PDF button product expression disables export while generation is busy", () => {
  const match = qrBulkPanelSource.match(/disabled=\{([^}]+)\} onClick=\{\(\) => void downloadPdf\(\)\}/);
  assert.ok(match);
  const evaluate = new Function("busy", "results", "exporting", "QR_BULK_LIMITS", `return ${match[1]}`);
  assert.equal(Boolean(evaluate(true, [{}], "", { pdfRows: 2_400 })), true);
  assert.equal(Boolean(evaluate(false, [{}], "", { pdfRows: 2_400 })), false);
});

type PanelEvent = [type: string, value: string];

function sampleQrResults(storageKey = "stored") {
  return [{ title: "한글", description: "", storageKey, zipPath: `${storageKey}.png` }];
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function waitForCondition(condition: () => boolean) {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (condition()) return;
    await new Promise<void>((resolve) => setImmediate(resolve));
  }
  throw new Error("Timed out waiting for QR handler checkpoint.");
}

async function assertQrExportOwnership(source: string) {
  const oldZip = deferred<void>();
  const pdfSave = deferred<Blob>();
  const { panel, deps, stats } = createQrPanelHarness(source);
  deps.zipModule = async () => {
    await oldZip.promise;
    throw new Error("delayed old ZIP failure");
  };
  deps.pdfModule = async () => ({
    createQrLabelPdf: async () => {
      stats.pdfCalls += 1;
      return pdfSave.promise;
    },
  });

  const oldExport = panel.downloadZip();
  await panel.cleanupResults();
  panel.setData(sampleQrResults("new"), { read: async () => new Blob(["png"]), clear: async () => undefined });
  const newExport = panel.downloadPdf();
  await waitForCondition(() => stats.pdfCalls === 1);
  oldZip.resolve();
  await oldExport;

  const duringPdf = panel.state();
  pdfSave.resolve(new Blob(["pdf"]));
  await newExport;
  assert.equal(duringPdf.exporting, "pdf");
  assert.equal(duringPdf.active?.kind, "pdf");
  assert.deepEqual(panel.events.filter(([type]) => type === "message"), []);
  assert.deepEqual(panel.events.filter(([type]) => type === "download"), [["download", "worklazy-qr-labels-a4.pdf"]]);
}

function createQrPanelHarness(source: string) {
  const handlerStart = source.indexOf("  const downloadZip = async");
  const handlerEnd = source.indexOf('\n  return <div data-testid="qr-bulk-page"');
  const cancelStart = source.indexOf("  const cancel = () =>");
  const cancelEnd = source.indexOf("  const downloadResult = async");
  const cleanupStart = source.indexOf("  async function cleanupResults()");
  const cleanupEnd = source.indexOf("\n}\n\nfunction PayloadFields");
  assert.ok([handlerStart, handlerEnd, cancelStart, cancelEnd, cleanupStart, cleanupEnd].every((index) => index >= 0));
  let handlers = source.slice(handlerStart, handlerEnd)
    + source.slice(cancelStart, cancelEnd)
    + source.slice(cleanupStart, cleanupEnd);
  handlers = handlers
    .replaceAll('import("./qrLabelFont.ts")', "deps.fontModule()")
    .replaceAll('import("./qrLabelPdf.ts")', "deps.pdfModule()")
    .replaceAll('import("@zip.js/zip.js")', "deps.zipModule()")
    .replaceAll('import("../../utils/zipArchive.ts")', "deps.writerModule()")
    .replaceAll("import.meta.env.BASE_URL", '"/"')
    .replaceAll("window.location.origin", '"https://example.test"');
  const setup = `
    const mountedRef = { current: true };
    const exportSequenceRef = { current: 0 };
    const activeExportRef = { current: undefined };
    const fontLoaderRef = { current: undefined };
    const canceledRef = { current: false };
    const rasterRef = { current: undefined };
    const storageRef = { current: undefined };
    const QR_BULK_LIMITS = { pdfRows: 2400 };
    const operation = { reset() {} };
    const events = [];
    let results = [];
    let pdfPreset = "a4";
    let exporting = "";
    const t = (key) => key;
    const setExporting = (value) => { exporting = value; events.push(["exporting", value]); };
    const setMessage = (value) => events.push(["message", value]);
    const downloadBlob = (_blob, name) => events.push(["download", name]);
    const setResults = (value) => { results = value; };
    const setFailures = () => {};
    const setManifest = () => {};
    const setResultPage = () => {};
  `;
  const returned = `
    return {
      downloadZip, downloadPdf, cleanupResults, cancel, events, activeExportRef,
      setData(nextResults, storage) { results = nextResults; storageRef.current = storage; },
      state() { return { active: activeExportRef.current, exporting, storage: storageRef.current }; },
    };
  `;
  const compiled = ts.transpileModule(setup + handlers + returned, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  const stats = { pdfCalls: 0, disposals: 0, evictions: 0, fontLoads: [] as string[] };
  const loader = {
    async acquire(kind: string) {
      stats.fontLoads.push(kind);
      return { kind, bytes: new ArrayBuffer(1) };
    },
    async load(kind: string) {
      stats.fontLoads.push(kind);
      return { kind, bytes: new ArrayBuffer(1) };
    },
    evict() { stats.evictions += 1; },
    dispose() { stats.disposals += 1; },
  };
  const deps = {
    fontModule: async () => ({ selectQrLabelFont, QrLabelFontInitError, createQrLabelFontLoader: () => loader }),
    pdfModule: async () => ({
      createQrLabelPdf: async () => {
        stats.pdfCalls += 1;
        return new Blob(["pdf"]);
      },
    }),
    zipModule: async () => ({
      BlobWriter: class {
        async getData() { return new Blob(["zip"]); }
      },
    }),
    writerModule: async () => ({
      createIncrementalZipArchiveWriter: () => ({
        add: async () => undefined,
        close: async () => undefined,
        discard: async () => undefined,
      }),
    }),
  };
  const panel = new Function("deps", compiled)(deps) as {
    downloadZip: () => Promise<void>;
    downloadPdf: () => Promise<void>;
    cleanupResults: () => Promise<void>;
    cancel: () => void;
    events: PanelEvent[];
    setData: (results: ReturnType<typeof sampleQrResults>, storage: { read: () => Promise<Blob>; clear: () => Promise<void> }) => void;
    state: () => { active?: { kind: "zip" | "pdf" }; exporting: string; storage?: unknown };
  };
  panel.setData(sampleQrResults(), { read: async () => new Blob(["png"]), clear: async () => undefined });
  return { panel, deps, stats };
}

function createQrRunDiscardHarness(
  source: string,
  branch: "abort" | "error",
  storage: { clear: () => Promise<void> },
) {
  const runStart = source.indexOf("  const run = async");
  const runEnd = source.indexOf("  const cancel = () =>");
  const runSource = source.slice(runStart, runEnd);
  const branchMatch = runSource.match(/if \(error instanceof DOMException && error\.name === "AbortError"\) \{\n([\s\S]*?)\n      \} else \{\n([\s\S]*?)\n      \}\n    \} finally/);
  assert.ok(branchMatch);
  const invalidateStart = source.indexOf("  function invalidateExport()");
  const invalidateEnd = source.indexOf('\n\n  return <div data-testid="qr-bulk-page"');
  assert.ok(invalidateStart >= 0 && invalidateEnd > invalidateStart);
  const invalidate = source.slice(invalidateStart, invalidateEnd);
  const body = branch === "abort" ? branchMatch[1] : branchMatch[2];
  const factorySource = `
    const controller = new AbortController();
    const activeExportRef = { current: { token: 1, controller, kind: "pdf" } };
    const exportSequenceRef = { current: 1 };
    const fontLoaderRef = { current: { dispose() { disposals += 1; } } };
    const storageRef = { current: storage };
    let exporting = "pdf", disposals = 0, results = [{}];
    const setExporting = (value) => { exporting = value; };
    const setResults = (value) => { results = value; };
    const setFailures = () => {};
    const setManifest = () => {};
    const operation = { fail() {} };
    const t = (key) => key;
    const rasterError = () => "raster-error";
    const translate = (key) => key;
    ${invalidate}
    async function execute() { const error = new DOMException("Aborted", "AbortError"); ${body} }
    return {
      execute,
      setStorage(value) { storageRef.current = value; },
      state() { return { storage: storageRef.current, active: activeExportRef.current, exporting, disposals, results, controllerAborted: controller.signal.aborted }; },
    };
  `;
  const compiled = ts.transpileModule(factorySource, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText;
  return new Function("storage", compiled)(storage) as {
    execute: () => Promise<void>;
    setStorage: (value: unknown) => void;
    state: () => { storage?: unknown; active?: unknown; exporting: string; disposals: number; results: unknown[]; controllerAborted: boolean };
  };
}

type Failure = "http" | "network" | "body" | "empty" | "truncated" | "html" | "sha";

async function withAssetMocks(
  run: (control: {
    requests: string[];
    setFailure: (kind: "subset" | "full", failure: Failure) => void;
    deferBody: () => void;
    releaseBody: () => void;
    deferDigest: () => void;
    releaseDigest: () => void;
  }) => Promise<void>,
) {
  const fetchDescriptor = Object.getOwnPropertyDescriptor(globalThis, "fetch");
  const cryptoDescriptor = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  const requests: string[] = [];
  const failures = new Map<"subset" | "full", Failure>();
  let bodyDeferred: Promise<void> | undefined;
  let releaseBody = () => {};
  let digestDeferred: Promise<void> | undefined;
  let releaseDigest = () => {};
  const bytesByKind = {
    subset: new ArrayBuffer(qrLabelFontAssets.subset.size),
    full: new ArrayBuffer(qrLabelFontAssets.full.size),
  };

  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    value: async (input: URL | RequestInfo) => {
      const url = String(input);
      requests.push(url);
      const kind = url.endsWith(qrLabelFontAssets.subset.path) ? "subset" : "full";
      const failure = failures.get(kind);
      if (failure === "network") throw new TypeError("network");
      return {
        ok: failure !== "http",
        async arrayBuffer() {
          if (bodyDeferred) await bodyDeferred;
          if (failure === "body") throw new TypeError("body");
          if (failure === "empty") return new ArrayBuffer(0);
          if (failure === "truncated" || failure === "html") return new ArrayBuffer(13);
          return bytesByKind[kind];
        },
      };
    },
  });
  Object.defineProperty(globalThis, "crypto", {
    configurable: true,
    value: {
      subtle: {
        async digest(_algorithm: string, data: BufferSource) {
          if (digestDeferred) await digestDeferred;
          const kind = data.byteLength === qrLabelFontAssets.subset.size ? "subset" : "full";
          const hash = failures.get(kind) === "sha" ? "00".repeat(32) : qrLabelFontAssets[kind].sha256;
          return Uint8Array.from(hash.match(/../g)!, (byte) => Number.parseInt(byte, 16)).buffer;
        },
      },
    },
  });

  try {
    await run({
      requests,
      setFailure(kind, failure) {
        failures.set(kind, failure);
      },
      deferBody() {
        bodyDeferred = new Promise<void>((resolve) => {
          releaseBody = resolve;
        });
      },
      releaseBody() {
        releaseBody();
      },
      deferDigest() {
        digestDeferred = new Promise<void>((resolve) => {
          releaseDigest = resolve;
        });
      },
      releaseDigest() {
        releaseDigest();
      },
    });
  } finally {
    if (fetchDescriptor) Object.defineProperty(globalThis, "fetch", fetchDescriptor);
    else Reflect.deleteProperty(globalThis, "fetch");
    if (cryptoDescriptor) Object.defineProperty(globalThis, "crypto", cryptoDescriptor);
    else Reflect.deleteProperty(globalThis, "crypto");
  }
}
