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
async function mountPage(tool: string, overrides: Record<string, unknown> = {}, language = "en") {
  const dom = new JSDOM('<div id="root"></div>', { url: `http://localhost/${language}/tools/${tool}` });
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
    if (id === "react-i18next") return { useTranslation: () => ({ t, i18n: { language } }) };
    if (id.includes("useHandoffReceiver")) return { useHandoffReceiver: (_id: string, value: any) => { adapter = value; const [result, setResult] = React.useState<any>(); publish = setResult; return { result, notReceived: false, recoveryFiles: result?.rejected.map((item: any) => item.file) ?? [], dismiss() {} }; } };
    if (id.includes("toolState")) return { setUnsavedWork: (id: string, value: any) => guards.set(id, value.hasWork), useUnsavedWorkGuard: (id: string, work: boolean) => { guards.set(id, work); } };
    if (id.includes("fileAccepts")) return { acceptsFile: () => true };
    if (id === "./client") return { createDocumentGeneratorClient: () => client };
    if (id === "./errors") return { GeneratorError: Error, generatorMessage: () => "Could not open file" };
    if (id.includes("useOperationProgress")) return { useOperationProgress: () => ({ status: "idle", reset() {}, update() {} }) };
    if (id === "../../components/ui") return { ...fallback, FileDropZone: (props: any) => { zones.set(props.label, props); return React.createElement("div", null, props.files.map((file: File) => file.name).join(",")); }, PageHeader: shell, formatBytes: String };
    if (id in overrides) return overrides[id];
    return fallback;
  };
  const name = tool === "document-generator" ? "DocumentGeneratorPage" : tool === "excel-cleaner" ? "ExcelCleanerPage" : "ExcelMergerPage";
  const file = path.resolve(process.env.BACKLOG_SOURCE_ROOT ?? ".", `src/features/${tool}/${name}.tsx`);
  const code = ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { require, exports, console, crypto, setTimeout, clearTimeout, queueMicrotask, window: dom.window, URL, File, AbortController }, { filename: file });
  const root = createRoot(dom.window.document.getElementById("root")!);
  await React.act(async () => root.render(React.createElement(React.StrictMode, null, React.createElement(exports[name]))));
  return { zones, client, guards, text: () => dom.window.document.body.textContent!,
    adapter: () => adapter,
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
