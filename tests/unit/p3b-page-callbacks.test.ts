import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// Execute the production callbacks; state setters and parser IO are fixtures.
function page(file: string) {
  const path = `${process.env.P3B_SOURCE_ROOT ?? "."}/src/features/${file}.tsx`;
  const source = ts.createSourceFile(path, fs.readFileSync(path, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const nodes: ts.Node[] = [];
  const visit = (node: ts.Node) => { nodes.push(node); ts.forEachChild(node, visit); }; visit(source);
  return {
    variable(name: string) {
      const node = nodes.find(node => ts.isVariableDeclaration(node) && node.name.getText(source) === name) as ts.VariableDeclaration;
      const value = node.initializer!;
      return ts.isCallExpression(value) && value.expression.getText(source) === "useCallback" ? value.arguments[0].getText(source) : value.getText(source);
    },
    adapter() {
      const call = nodes.find(node => ts.isCallExpression(node) && node.expression.getText(source) === "usePersistentHandoffReceiver") as ts.CallExpression;
      return call.arguments[1].getText(source);
    },
  };
}
function execute(code: string, context: Record<string, any>) {
  vm.runInNewContext(ts.transpileModule(code, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return context.api;
}
const noop = () => {};
const deferred = () => { let resolve!: (value: any) => void; return { promise: new Promise<any>(done => { resolve = done; }), resolve: (value: any) => resolve(value) }; };
for (const busy of ["selecting", "running"]) test(`P3b redactor rejected ${busy} intake cannot clear or invalidate the owning selection`, async () => {
  const parsed = page("document-redactor/DocumentRedactorPage"), pending = deferred();
  const generation = { current: 0 }, states: boolean[] = [];
  let selecting = false, running = false, calls = 0;
  const context: Record<string, any> = { intakeGeneration: generation, activeSelections: { current: 0 }, mounted: { current: true },
    preparingTask: { current: undefined }, client: { current: { setInputs: async () => { calls++; return pending.promise; } } },
    setSelecting: (value: boolean) => { selecting = value; states.push(value); },
    setNotice: noop, setJobFailures: noop, releaseAllResults: noop, setFiles: noop, setInputs: noop, setFailures: noop,
    setHistories: noop, setFileId: noop, setPageIndex: noop, setSelectedMask: noop, setConfirmed: noop, setResultMode: noop,
    c: { errors: {} }, fileId: "", safeError: () => ({ code: "unknown" }),
  };
  Object.defineProperties(context, { selecting: { get: () => selecting }, running: { get: () => running } });
  const receive = execute(`globalThis.api=(${parsed.variable("replaceInputs")});`, context);
  const first = receive([new File(["one"], "one.pdf")]);
  assert.equal(selecting, true); if (busy === "running") { selecting = false; running = true; }
  const owner = generation.current;
  assert.equal((await receive([new File(["two"], "two.pdf")])).length, 0);
  assert.equal(generation.current, owner); assert.deepEqual(states, [true]); assert.equal(calls, 1);
  pending.resolve({ inputs: [], failures: [] }); await first;
  assert.deepEqual(states, [true, false]);
});
test("P3b redactor unavailable client never releases a selection it did not acquire", async () => {
  const parsed = page("document-redactor/DocumentRedactorPage"), states: boolean[] = [];
  const receive = execute(`globalThis.api=(${parsed.variable("replaceInputs")});`, {
    intakeGeneration: { current: 0 }, mounted: { current: true }, client: { current: undefined },
    selecting: false, running: false, setSelecting: (value: boolean) => states.push(value),
  });
  assert.equal((await receive([])).length, 0); assert.deepEqual(states, []);
});
for (const isolated of [false, true]) for (const language of ["ko", "en"]) test(`P3b document PDF isolation refusal explains safe retry (${language}, isolated=${isolated})`, async () => {
  const parsed = page("pdf-converter/DocumentPdfPanel"), input = new File(["doc"], "input.docx");
  const errors: string[] = [], chosen: File[][] = [];
  const adapter = execute(`globalThis.api=(${parsed.adapter()});`, {
    intakeGeneration: { current: 0 }, officeSessionNeedsReload: false, inspectDocumentInput: async () => true, crossOriginIsolated: isolated,
    setError: (message: string) => errors.push(message), L: (ko: string, en: string) => language === "ko" ? ko : en,
    choose: (files: File[]) => chosen.push(files), setUnsavedWork: noop,
  });
  const result = await adapter.receive([input], { signal: new AbortController().signal });
  assert.equal(result.status, isolated ? "accepted" : "rejected");
  assert.equal(chosen.length, isolated ? 1 : 0); assert.equal(errors.length, isolated ? 0 : 1);
  if (!isolated) { assert.match(errors[0], language === "ko" ? /브라우저.*준비.*완료하지 못/ : /browser could not prepare/); assert.equal(result.rejected[0].file, input); }
});

// Both calls can originate from one render before selecting=true is committed.
function concurrentSelections() {
  const parsed = page("document-redactor/DocumentRedactorPage"), preparing = deferred();
  const first = deferred(), second = deferred(), states: boolean[] = [], applied: File[][] = [];
  let calls = 0;
  const client = { setInputs: () => (++calls === 1 ? first.promise : second.promise) };
  const context = {
    intakeGeneration: { current: 0 }, activeSelections: { current: 0 }, mounted: { current: true },
    preparingTask: { current: preparing.promise }, client: { current: client }, selecting: false, running: false,
    setSelecting: (value: boolean) => states.push(value), setFiles: (files: File[]) => applied.push(files),
    setNotice: noop, setJobFailures: noop, releaseAllResults: noop, setInputs: noop, setFailures: noop,
    setHistories: noop, setFileId: noop, setPageIndex: noop, setSelectedMask: noop, setConfirmed: noop, setResultMode: noop,
    c: { errors: { unknown: "fixture failure" } }, fileId: "", safeError: () => ({ code: "unknown" }),
  };
  const receive = execute(`globalThis.api=(${parsed.variable("replaceInputs")});`, context);
  return { context, client, preparing, first, second, states, applied, receive, calls: () => calls };
}
const emptySelection = { inputs: [], failures: [] };
test("P3d cancelled newer preparation cannot strand the active selection", async () => {
  const f = concurrentSelections(), abort = new AbortController();
  const first = f.receive([new File(["one"], "one.pdf")]);
  const newer = f.receive([new File(["two"], "two.pdf")], { signal: abort.signal });
  assert.equal(f.context.intakeGeneration.current, 2);
  abort.abort(); f.preparing.resolve(f.client); await newer;
  assert.equal(f.calls(), 1); assert.deepEqual(f.states, [true]);
  f.first.resolve(emptySelection); await first;
  assert.deepEqual(f.states, [true, false]); assert.equal(f.applied.length, 0);
  assert.equal(f.context.activeSelections.current, 0);
});
for (const order of ["older-first", "newer-first"] as const) test(`P3d only the last active selection releases busy state (${order})`, async () => {
  const f = concurrentSelections();
  const first = f.receive([new File(["one"], "one.pdf")]);
  const newer = f.receive([new File(["two"], "two.pdf")], { signal: new AbortController().signal });
  f.preparing.resolve(f.client); await new Promise<void>(resolve => setImmediate(resolve));
  assert.equal(f.calls(), 2);
  const early = order === "older-first" ? f.first : f.second, late = order === "older-first" ? f.second : f.first;
  early.resolve(emptySelection); await (order === "older-first" ? first : newer);
  assert.deepEqual(f.states, [true, true]);
  late.resolve(emptySelection); await (order === "older-first" ? newer : first);
  assert.deepEqual(f.states, [true, true, false]); assert.equal(f.applied.length, 1);
  assert.equal(f.context.activeSelections.current, 0);
});
for (const finish of ["aborted", "unmounted", "error"] as const) test(`P3d ${finish} selection releases ownership without applying stale inputs`, async () => {
  const f = concurrentSelections(), abort = new AbortController();
  f.preparing.resolve(f.client);
  const pending = f.receive([new File(["one"], "one.pdf")], { signal: abort.signal });
  await new Promise<void>(resolve => setImmediate(resolve)); assert.deepEqual(f.states, [true]);
  if (finish === "aborted") abort.abort();
  if (finish === "unmounted") f.context.mounted.current = false;
  if (finish === "error") {
    // A rejected setInputs result follows the production catch/finally path.
    f.first.resolve(Promise.reject(new Error("fixture failure")));
  } else f.first.resolve(emptySelection);
  await pending;
  assert.deepEqual(f.states, finish === "unmounted" ? [true] : [true, false]);
  assert.equal(f.context.activeSelections.current, 0); assert.equal(f.applied.length, 0);
});
