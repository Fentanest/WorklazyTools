import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";
import * as React from "react";
import { createRoot } from "react-dom/client";
import { JSDOM } from "jsdom";

const root = new URL("../../", import.meta.url);
const read = (file: string) => fs.readFileSync(new URL(file, root), "utf8");
const compile = (source: string) => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;

test("retry guard survives failure, is per target, clears only on explicit success, and declines inaccessible storage", () => {
  const entries = new Map<string, string>();
  let listener = (_: { payload: unknown }) => {};
  const handler = () => listener({ payload: new Error("Failed to fetch dynamically imported module: /test.js") });
  let reloads = 0;
  let isolated = false;
  let blocked = false;
  const location = { pathname: "/ko/tools/audio-studio/", search: "?sample=1", reload: () => reloads++ };
  const context = vm.createContext({ exports: {}, window: { location, addEventListener: (_: string, fn: typeof listener) => { listener = fn; } }, document: { querySelector: () => isolated }, sessionStorage: {
    getItem: (key: string) => { if (blocked) throw Error("private"); return entries.get(key); },
    setItem: (key: string, value: string) => { if (blocked) throw Error("private"); entries.set(key, value); },
    removeItem: (key: string) => { if (blocked) throw Error("private"); entries.delete(key); },
  } });
  vm.runInContext(compile(read("src/app/chunkRecovery.ts")), context);
  const api = context.exports;
  api.installChunkRecovery(); handler(); handler();
  assert.equal(reloads, 1); assert.equal(entries.size, 1);
  assert.equal([...entries.values()][0], "pending");
  location.pathname = "/ko/tools/image-studio/"; handler(); assert.equal(reloads, 2);
  api.confirmToolReady(); assert.equal(entries.size, 1);
  location.pathname = "/ko/tools/audio-studio"; handler(); assert.equal(reloads, 2, "slash redirect keeps guard");
  api.confirmToolReady(); handler(); assert.equal(reloads, 3);
  blocked = true; location.pathname = "/en/tools/text-tools"; handler(); assert.equal(reloads, 3);
  blocked = false; isolated = true; handler(); assert.equal(reloads, 3, "COI owns isolated-document reloads");
});

test("only the same rejection shares recovery; browser import errors work without a Vite event", () => {
  const entries = new Map<string, string>();
  let reloads = 0;
  const location = { pathname: "/ko/tools/pdf-editor/", search: "", reload: () => reloads++ };
  const context = vm.createContext({ exports: {}, window: { location }, document: { querySelector: () => null }, sessionStorage: {
    getItem: (key: string) => entries.get(key), setItem: (key: string, value: string) => entries.set(key, value), removeItem: (key: string) => entries.delete(key),
  } });
  vm.runInContext(compile(read("src/app/chunkRecovery.ts")), context);
  const api = context.exports;
  const first = new TypeError("Failed to fetch dynamically imported module: /tool.js");
  assert.equal(api.recoverChunkError(first, true), true);
  assert.equal(api.recoverChunkError(first), true, "Vite/React and StrictMode share one rejection");
  assert.equal(api.recoverChunkError(new TypeError(first.message)), false, "second failure in the same document is terminal");
  assert.equal(api.recoverChunkError(new Error("render failed")), false);
  assert.equal(reloads, 1);
  location.pathname = "/ko/tools/document-compare/";
  assert.equal(api.recoverChunkError(first), true, "another route has its own budget before the first is cleared");
  assert.equal(reloads, 2);
  api.confirmToolReady();
  assert.equal(entries.size, 1, "other route's success must not clear the first route");
  for (const message of ["Importing a module script failed.", "error loading dynamically imported module: /tool.js", "Unable to preload CSS for /tool.css"]) {
    assert.equal(api.recoverChunkError(new TypeError(message)), true);
    api.confirmToolReady();
  }
  for (const message of ["Failed to fetch", "Cannot read properties of undefined", "render failed"]) assert.equal(api.recoverChunkError(new Error(message)), false);
});

test("Office/XLS reloadOnce suppresses same path+search and tolerates all storage access failures", async () => {
  const source = read("src/features/office-editor/office_coi_serviceworker.js");
  const store = new Map();
  let reloads = 0;
  async function run({ search = "", isolated = false, sab = false, fail = "" } = {}) {
    const context = vm.createContext({ URL, console, document: { currentScript: { src: "https://test/ko/tools/office-editor/app/coi-serviceworker.js" } }, window: { location: { pathname: "/ko/tools/office-editor/app/", search, reload: () => reloads++ }, crossOriginIsolated: isolated, isSecureContext: true, coi: { quiet: true } }, navigator: { serviceWorker: { register: async () => ({ active: { state: "activated" } }) } }, SharedArrayBuffer: sab ? function () {} : undefined, sessionStorage: {
      getItem: (key: string) => { if (fail === "get") throw Error("private"); return store.get(key); },
      setItem: (key: string, value: string) => { if (fail === "set") throw Error("quota"); store.set(key, value); },
      removeItem: (key: string) => { if (fail === "remove") throw Error("private"); store.delete(key); },
    } });
    vm.runInContext(source, context);
    await new Promise((resolve) => setImmediate(resolve));
  }
  await run(); await run(); assert.equal(reloads, 1); assert.equal(store.size, 1);
  await run({ isolated: true }); assert.equal(store.size, 1, "SAB is also required");
  await run({ search: "?next=1" }); assert.equal(reloads, 2);
  await run({ isolated: true, sab: true }); assert.equal(store.size, 0);
  for (const fail of ["get", "set"]) await run({ fail });
  await run({ isolated: true, sab: true, fail: "remove" }); assert.equal(reloads, 2);
});

test("Office/XLS chunk recovery joins its owner, survives isolation success, and clears on tool success", async () => {
  const store = new Map<string, string>();
  let reloads = 0;
  async function documentOwner(isolated: boolean, registration = Promise.resolve({ active: { state: "activated" } })) {
    const window = { location: { pathname: "/en/tools/office-editor/app/", search: "", reload: () => reloads++ }, crossOriginIsolated: isolated, isSecureContext: true, coi: { quiet: true }, worklazyDocumentRecovery: undefined as any };
    const context = vm.createContext({ URL, console, window, document: { currentScript: { src: "https://test/en/tools/office-editor/app/coi-serviceworker.js" } }, navigator: { serviceWorker: { register: () => registration } }, SharedArrayBuffer: isolated ? function () {} : undefined, sessionStorage: {
      getItem: (key: string) => store.get(key), setItem: (key: string, value: string) => store.set(key, value), removeItem: (key: string) => store.delete(key),
    } });
    vm.runInContext(read("src/features/office-editor/office_coi_serviceworker.js"), context);
    await new Promise((resolve) => setImmediate(resolve));
    return window.worklazyDocumentRecovery;
  }
  let activate!: (value: { active: { state: string } }) => void;
  const waiting = await documentOwner(false, new Promise((resolve) => { activate = resolve; }));
  const waitingResult = waiting.reloadForChunk();
  assert.equal(reloads, 0, "a chunk failure must wait for the preparation worker to activate");
  activate({ active: { state: "activated" } });
  assert.equal(await waitingResult, true); assert.equal(reloads, 1);
  const afterWaiting = await documentOwner(true);
  assert.equal(await afterWaiting.reloadForChunk(), false);
  afterWaiting.confirmToolReady(); reloads = 0;
  const preparing = await documentOwner(false);
  assert.equal(reloads, 1);
  assert.equal(await preparing.reloadForChunk(), true);
  assert.equal(reloads, 1, "a pending preparation reload is not duplicated");
  preparing.confirmToolReady(); assert.equal(store.size, 1);
  const retry = await documentOwner(true);
  assert.equal(await retry.reloadForChunk(), false, "isolation success cannot clear a chunk failure budget");
  assert.equal(reloads, 1);
  retry.confirmToolReady(); assert.equal(store.size, 0);
  assert.equal(await retry.reloadForChunk(), true, "a ready isolated document can recover one later chunk failure");
  assert.equal(reloads, 2);
  const failedAgain = await documentOwner(true);
  assert.equal(await failedAgain.reloadForChunk(), false); assert.equal(reloads, 2);
  const unavailable = await documentOwner(false, Promise.reject(new Error("registration failed")));
  assert.equal(await unavailable.reloadForChunk(), false); assert.equal(reloads, 2);
});

test("StrictMode lazy rejection shows only recovery, and a late owner result cannot fail another route", async () => {
  const dom = new JSDOM('<div id="root"></div>', { url: "https://test/en/tools/audio-studio/" });
  const globals = globalThis as any;
  const previous = { window: globals.window, document: globals.document, act: globals.IS_REACT_ACT_ENVIRONMENT };
  globals.window = dom.window; globals.document = dom.window.document; globals.IS_REACT_ACT_ENVIRONMENT = true;
  const navigations: string[] = []; let reloads = 0; const entries = new Map();
  const location = { pathname: "/en/tools/audio-studio/", search: "", reload: () => reloads++, assign: (path: string) => navigations.push(path) };
  const window = { location, worklazyDocumentRecovery: undefined as any };
  const storage = { getItem: (key: string) => entries.get(key), setItem: (key: string, value: string) => entries.set(key, value), removeItem: (key: string) => entries.delete(key) };
  const recovery = vm.createContext({ exports: {}, window, document: dom.window.document, sessionStorage: storage });
  vm.runInContext(compile(read("src/app/chunkRecovery.ts")), recovery);
  const adStates: boolean[] = [];
  const boundary = vm.createContext({ exports: {}, React, window, document: dom.window.document, require: (name: string) => {
    if (name === "react") return React;
    if (name === "react-i18next") return { useTranslation: () => ({ t: (key: string) => key }) };
    if (name === "react-router-dom") return { useLocation: () => location };
    if (name.includes("chunkRecovery")) return recovery.exports;
    if (name.includes("adEligibility")) return { setAdIneligible: (_: string, value: boolean) => adStates.push(value) };
    if (name.includes("siteBasePath")) return { withSiteBasePath: (path: string) => path };
    return { Button: "button" };
  } });
  vm.runInContext(compile(read("src/components/RouteErrorBoundary.tsx").replaceAll("import.meta.env.BASE_URL", '"/"')), boundary);
  const root = createRoot(dom.window.document.getElementById("root")!, { onCaughtError: () => {} });
  const render = (child: React.ReactNode) => root.render(React.createElement(React.StrictMode, null,
    React.createElement(boundary.exports.RouteErrorBoundary, null, React.createElement(React.Suspense, { fallback: "loading" }, child))));
  let errorSeen = false;
  const observer = new dom.window.MutationObserver(() => { errorSeen ||= !!dom.window.document.querySelector("[data-route-error]"); });
  observer.observe(dom.window.document, { subtree: true, childList: true, attributes: true });
  try {
    const lazy = React.lazy(() => Promise.reject(new TypeError("Failed to fetch dynamically imported module: /tool.js")));
    await React.act(async () => { render(React.createElement(lazy)); });
    assert.equal(reloads, 1); assert.equal(errorSeen, false); assert.equal(navigations.length, 0);
    assert.equal(dom.window.document.querySelector("[data-route-recovering]")?.getAttribute("role"), "status");
    assert.ok(adStates.includes(true));
    const homeButton = dom.window.document.querySelector<HTMLButtonElement>("[data-route-recovering] button");
    assert.ok(homeButton, "a reload that does not navigate must leave a manual exit");
    await React.act(async () => { homeButton.click(); });
    assert.deepEqual(navigations.splice(0), ["/en/"]); assert.equal(reloads, 1);
    let finish!: (value: boolean) => void;
    window.worklazyDocumentRecovery = { reloadForChunk: () => new Promise<boolean>((resolve) => { finish = resolve; }) };
    dom.window.document.head.innerHTML = '<meta name="worklazy-office-isolation">';
    location.pathname = "/en/tools/office-editor/app/";
    const isolatedLazy = React.lazy(() => Promise.reject(new TypeError("Importing a module script failed.")));
    await React.act(async () => { render(React.createElement(isolatedLazy)); });
    const pendingHome = dom.window.document.querySelector<HTMLButtonElement>("[data-route-recovering] button");
    assert.ok(pendingHome, "an unresolved Office owner must not withhold the manual exit");
    await React.act(async () => { pendingHome.click(); });
    assert.deepEqual(navigations.splice(0), ["/en/"]); assert.equal(reloads, 1); assert.equal(errorSeen, false);
    location.pathname = "/en/tools/text-tools/";
    await React.act(async () => { render("ready"); finish(false); });
    assert.equal(navigations.length, 0); assert.equal(dom.window.document.getElementById("root")!.textContent, "ready");
    const Broken = () => { throw new Error("unrelated render failure"); };
    await React.act(async () => { render(React.createElement(Broken)); });
    assert.deepEqual(navigations, ["/en/error/"]); assert.equal(reloads, 1);
    location.pathname = "/en/error/";
    await React.act(async () => { render(React.createElement(Broken)); });
    assert.equal(navigations.length, 1, "D4 does not navigate again from the error route");
  } finally {
    await React.act(async () => root.unmount()); observer.disconnect(); dom.window.close();
    globals.window = previous.window; globals.document = previous.document; globals.IS_REACT_ACT_ENVIRONMENT = previous.act;
  }
});

for (const file of ["video-probe.worker.ts", "video.worker.ts"]) {
  test(`${file}: FFmpeg constructor throw reports a safe terminal message and closes`, async () => {
    const messages: any[] = [];
    let closed = false;
    const worker = { location: { pathname: "/tools/video-studio/workers/test.js", origin: "https://test" }, postMessage: (message: any) => messages.push(message), close: () => { closed = true; } };
    const source = read(`src/features/video-studio/${file}`).replaceAll("import.meta.env.BASE_URL", JSON.stringify("/"));
    const context = vm.createContext({ exports: {}, URL, self: worker, performance, require: (name: string) => {
      if (name === "@ffmpeg/ffmpeg") return { FFmpeg: class { constructor() { throw new Error("RAW_CONSTRUCTOR_SECRET"); } } };
      if (name.includes("workerMessages")) return { workerMessage: (_: string, key: string) => `localized:${key}`, FEATURE_MESSAGE_TOKEN_PREFIX: "localized:" };
      if (name.includes("videoProcessingShared")) {
        // Execute the actual normalizer too; its other imports are unused in this failure.
        const nested = vm.createContext({ exports: {}, require: () => ({ VideoResultQuotaError: class extends Error {}, classifyVideoProcessingFailure: () => "VIDEO_PROCESSING_ERROR" }) });
        vm.runInContext(compile(read("src/features/video-studio/videoProcessingShared.ts")), nested);
        return nested.exports;
      }
      return {};
    } });
    vm.runInContext(compile(source), context);
    await (worker as any).onmessage({ data: file.startsWith("video-probe") ? { language: "en" } : { type: "start", request: { language: "en", fileLabels: {} } } });
    await new Promise((resolve) => setImmediate(resolve));
    assert.ok(closed); assert.equal(messages.filter((item) => item.type === "error").length, 1);
    assert.doesNotMatch(JSON.stringify(messages), /RAW_CONSTRUCTOR_SECRET/);
  });
}

test("recovery copy is bilingual with matching keys and no internal exception labels", () => {
  const ko = JSON.parse(read("src/locales/ko/common.json")).recovery;
  const en = JSON.parse(read("src/locales/en/common.json")).recovery;
  assert.deepEqual(Object.keys(ko), Object.keys(en));
  for (const value of [...Object.values(ko), ...Object.values(en)]) assert.doesNotMatch(String(value), /worker|chunk|청크|런타임|runtime|Error:|TypeError|stack/i);
});
