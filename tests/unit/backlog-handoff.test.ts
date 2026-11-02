import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import * as React from "react";
import * as jsx from "react/jsx-runtime";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";

// Execute the actual page and React effects. Only the parser boundary and UI
// shells are fixtures; intake, state writes, adapter and notice are production.
async function mountPage(tool: string, overrides: Record<string, unknown> = {}, language = "en", persistent = false) {
  const dom = new JSDOM('<div id="root"></div>', { url: `http://localhost/${language}/tools/${tool}${persistent ? "/xls-preserve" : ""}` });
  const originals = ["window", "document", "navigator", "IS_REACT_ACT_ENVIRONMENT"].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)] as const);
  for (const key of ["window", "document", "navigator"]) Object.defineProperty(globalThis, key, { configurable: true, value: dom.window[key as "window"] });
  Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
  const zones = new Map<string, any>();
  let adapter: any, publish: any;
  const guards = new Map<string, boolean>();
  const resources = JSON.parse(fs.readFileSync(`src/locales/${language}/features.json`, "utf8"));
  const t = (key: string) => key.replace(/^features:/, "").split(".").reduce((value, part) => value?.[part], resources) ?? key;
  const shell = ({ children }: any) => React.createElement("div", null, children);
  const snapshot = { state: "idle", results: [], version: 0 };
  const client = { snapshot: () => snapshot, subscribe: () => () => {}, dispose: async () => {}, acknowledgeResults: async () => {}, cancel: () => {}, reset: async () => {}, inspectTemplate: async () => ({ variables: ["name"] }), loadSources: async () => { throw new Error("bad data"); }, ...overrides.client as object };
  const exports: any = {};
  const fallback = new Proxy({}, { get: (_target, key) => key === "__esModule" ? true : shell });
  const require = (id: string): any => {
    if (id === "react") return React;
    if (id === "react/jsx-runtime") return jsx;
    if (id === "react-i18next") return { useTranslation: () => ({ t, i18n: { language, resolvedLanguage: language } }) };
    if (id.includes("useHandoffReceiver")) return { useHandoffReceiver: (_id: string, value: any) => { adapter = value; const [result, setResult] = React.useState<any>(); publish = setResult; return { result, notReceived: false, recoveryFiles: result?.rejected.map((item: any) => item.file) ?? [], dismiss() {} }; }, usePersistentHandoffReceiver: (_id: string, value: any) => { if (persistent) adapter = { ...value, receive: (entry: any, context: any) => value.receive(entry.files, context) }; return { pending: false, notReceived: false, result: undefined, recoveryFiles: [], dismiss() {} }; } };
    if (id.includes("toolState")) return { setUnsavedWork: (id: string, value: any) => guards.set(id, value.hasWork), useUnsavedWorkGuard: (id: string, work: boolean) => { guards.set(id, work); } };
    if (id.includes("fileAccepts")) return { acceptsFile: () => true };
    if (id === "./client") return { createDocumentGeneratorClient: () => typeof overrides.clientFactory === "function" ? (overrides.clientFactory as Function)() : client };
    if (id === "./errors") return { GeneratorError: Error, generatorMessage: () => "Could not open file" };
    if (id === "react-router-dom") return { useLocation: () => ({ pathname: dom.window.location.pathname, search: "" }) };
    if (id.includes("i18n/languages")) return { stripLanguagePrefix: (value: string) => value.replace(/^\/(en|ko)/, "") };
    if (id.includes("i18n/routing")) return { useLocalizedPath: (value: string) => value };
    if (id.includes("AppShell")) return { useMemoryHandoff: () => ({ send() {} }) };
    if (id === "./recipeStore.ts") return { readRecipes: () => ({ recipes: [] }) };
    if (id === "./types.ts") return { EXCEL_CLEANER_RULE_TYPES: [] };
    if (id === "./schema.ts") return { validateExcelCleanerPipeline: () => ({ version: 1, rules: [] }) };
    if (id.includes("useOperationProgress")) return { useOperationProgress: () => ({ status: "idle", reset() {}, update() {} }) };
    if (id === "../../components/ui") return { ...fallback, FileDropZone: (props: any) => { zones.set(props.label, props); return React.createElement("div", null, props.files.map((file: File) => file.name).join(",")); }, PageHeader: shell, PrimaryButton: shell, ResultCard: shell, SegmentedControl: shell, ToggleRow: shell, formatBytes: String };
    if (id in overrides) return overrides[id];
    return fallback;
  };
  const name = tool === "document-generator" ? "DocumentGeneratorPage" : tool === "excel-cleaner" ? "ExcelCleanerPage" : "ExcelMergerPage";
  const file = path.resolve(process.env.BACKLOG_SOURCE_ROOT ?? ".", `src/features/${tool}/${name}.tsx`);
  const code = ts.transpileModule(fs.readFileSync(file, "utf8").replaceAll("import.meta.env", "({ DEV: true })"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { require, exports, console, crypto, setTimeout, clearTimeout, queueMicrotask, window: dom.window, URL, URLSearchParams, File, AbortController }, { filename: file });
  const root = createRoot(dom.window.document.getElementById("root")!);
  await React.act(async () => root.render(React.createElement(React.StrictMode, null, React.createElement(exports[name]))));
  return { zones, client, guards, text: () => dom.window.document.body.textContent!,
    adapter: () => adapter,
    start: async (files: File[], roles?: string[]) => {
      const controller = new AbortController(); let promise: Promise<any>;
      await React.act(async () => { promise = adapter.receive({ files, roles }, { signal: controller.signal }); });
      return { promise: promise!, abort: async () => { await React.act(async () => { controller.abort(); adapter.invalidate(); }); } };
    },
    receive: async (files: File[], roles?: string[]) => { let result: any; await React.act(async () => { result = await adapter.receive({ files, roles }, { signal: new AbortController().signal }); publish({ ...result, accepted: [] }); }); return result; },
    close: async () => { await React.act(async () => root.unmount()); dom.window.close(); for (const [key, original] of originals) { if (original) Object.defineProperty(globalThis, key, original); else Reflect.deleteProperty(globalThis, key); } },
  };
}

for (const language of ["ko", "en"]) test(`template-only partial explains that data must be selected again (${language})`, async () => {
  const page = await mountPage("document-generator", {}, language);
  try {
    const template = new File(["synthetic"], "template.docx"), data = new File(["bad"], "bad.csv");
    const result = await page.receive([template, data], ["template", "data"]);
    assert.equal(result.status, "partial");
    assert.equal(result.accepted.length, 1);
    assert.equal(result.accepted[0], template);
    assert.equal(page.guards.get("document-generator"), true);
    assert.match(page.text(), language === "ko" ? /데이터 파일을 다시 선택해 주세요/ : /Select the data files again/);
    assert.match(page.text(), /template.docx/);
  } finally { await page.close(); }
});

const source = (file: File) => ({ id: file.name, fileName: file.name, book: { sheets: [{ name: "Sheet1", rowCount: 2, columnCount: 1, cells: [{ row: 1, column: 1, value: "name" }] }] } });
test("document adoption ignores retired client disposal and enables file selection", async () => {
  const page = await mountPage("document-generator", { clientFactory: () => {
    const listeners = new Set<(value: any) => void>();
    return {
      snapshot: () => ({ state: "idle", results: [], version: 0 }),
      subscribe: (listener: (value: any) => void) => { listeners.add(listener); return () => listeners.delete(listener); },
      inspectTemplate: async () => ({ variables: ["name"] }),
      loadSources: async ([file]: File[]) => [source(file)],
      // Production dispose can emit before React replaces the subscription.
      dispose: async () => { for (const listener of listeners) listener({ state: "disposed", results: [], version: 0 }); },
    };
  } });
  try {
    const result = await page.receive([new File(["t"], "template.docx"), new File(["d"], "data.csv")], ["template", "data"]);
    assert.equal(result.status, "accepted");
    assert.equal([...page.zones.values()].every(zone => !zone.disabled), true);
  } finally { await page.close(); }
});

for (const tool of ["excel-cleaner", "excel-merger", "document-generator"]) {
  for (const lateFailure of [false, true]) test(`${tool}: abort preserves existing input and ignores late ${lateFailure ? "failure" : "success"}`, async () => {
    let finish!: () => void;
    const delayed = new Promise<void>(resolve => { finish = resolve; });
    const inspect = async (file: File) => {
      if (file.name === "incoming.csv") { await delayed; if (lateFailure) throw new Error("delayed failure"); }
      return { format: "csv", sheets: [{ name: "Sheet1", headerRows: [], rowCount: 2, columnCount: 1 }], hardLimitExceeded: false };
    };
    const overrides = {
      "./excelCleanerClient.ts": { inspectExcelCleanerFile: inspect },
      "./excelWorkerClient": { inspectExcelFiles: async (files: any[]) => { await inspect(files[0].file); return files.map(item => ({ id: item.id, sheetNames: ["Sheet1"], encrypted: false })); } },
      client: { loadSources: async ([file]: File[]) => { await inspect(file); return [source(file)]; } },
    };
    const page = await mountPage(tool, overrides);
    try {
      const existing = new File(["old"], "existing.csv"), incoming = new File(["new"], "incoming.csv");
      const template = new File(["template"], "existing.docx");
      if (tool === "document-generator") {
        await React.act(async () => { await [...page.zones.values()][0].onFiles([template]); });
        await React.act(async () => { await [...page.zones.values()][1].onFiles([existing]); });
      } else await React.act(async () => { await [...page.zones.values()][0].onFiles([existing]); });
      assert.match(page.text(), /existing.csv/);
      const job = await page.start(tool === "document-generator" ? [new File(["new"], "incoming.docx"), incoming] : [incoming], tool === "document-generator" ? ["template", "data"] : undefined);
      await job.abort();
      assert.match(page.text(), /existing.csv/);
      assert.doesNotMatch(page.text(), /incoming.csv/);
      if (tool === "document-generator") assert.match(page.text(), /existing.docx/);
      await React.act(async () => { finish(); await job.promise; });
      assert.match(page.text(), /existing.csv/);
      assert.doesNotMatch(page.text(), /incoming.csv/);
      assert.equal(page.guards.get(tool), true);
    } finally { finish(); await page.close(); }
  });
}

for (const lateFailure of [false, true]) test(`persistent XLS abort preserves manual input and ignores late ${lateFailure ? "failure" : "success"}`, async () => {
  let finish!: () => void;
  const delayed = new Promise<void>(resolve => { finish = resolve; });
  const page = await mountPage("excel-merger", {
    "./excelWorkerClient": { inspectExcelFiles: async (files: any[]) => {
      if (files[0].file.name === "incoming.xlsx") { await delayed; if (lateFailure) throw new Error("late parser failure"); }
      return files.map(item => ({ id: item.id, sheetNames: ["Sheet1"], encrypted: false }));
    } },
  }, "en", true);
  try {
    await React.act(async () => { await [...page.zones.values()][0].onFiles([new File(["old"], "manual.xlsx")]); });
    const job = await page.start([new File(["new"], "incoming.xlsx")]);
    await job.abort();
    assert.match(page.text(), /manual.xlsx/);
    assert.doesNotMatch(page.text(), /incoming.xlsx/);
    await React.act(async () => { finish(); await job.promise; });
    assert.match(page.text(), /manual.xlsx/);
    assert.doesNotMatch(page.text(), /incoming.xlsx/);
    assert.equal(page.guards.get("excel-merger"), true);
  } finally { finish(); await page.close(); }
});
