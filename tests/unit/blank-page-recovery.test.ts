import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";
import ts from "typescript";

const root = new URL("../../", import.meta.url);
const read = (file: string) => fs.readFileSync(new URL(file, root), "utf8");
const compile = (source: string) => ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React } }).outputText;

test("retry guard survives failure, is per target, clears only on explicit success, and declines inaccessible storage", () => {
  const entries = new Map<string, string>();
  let handler = () => {};
  let reloads = 0;
  let isolated = false;
  let blocked = false;
  const location = { pathname: "/ko/tools/audio-studio/", search: "?sample=1", reload: () => reloads++ };
  const context = vm.createContext({ exports: {}, window: { location, addEventListener: (_: string, fn: () => void) => { handler = fn; } }, document: { querySelector: () => isolated }, sessionStorage: {
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

test("Office/XLS reloadOnce suppresses same path+search and tolerates all storage access failures", async () => {
  const source = read("src/features/office-editor/office_coi_serviceworker.js");
  const store = new Map();
  let reloads = 0;
  async function run({ search = "", isolated = false, sab = false, fail = "" } = {}) {
    const context = vm.createContext({ URL, console, document: { currentScript: { src: "https://test/ko/tools/office-editor/app/coi-serviceworker.js" } }, window: { location: { pathname: "/ko/tools/office-editor/app/", search, reload: () => reloads++ }, crossOriginIsolated: isolated, isSecureContext: true, coi: { quiet: true } }, navigator: { serviceWorker: { register: async () => ({ active: {} }) } }, SharedArrayBuffer: sab ? function () {} : undefined, sessionStorage: {
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
