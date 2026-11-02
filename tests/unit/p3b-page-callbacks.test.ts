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
  const context: Record<string, any> = { intakeGeneration: generation, mounted: { current: true },
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
    intakeGeneration: { current: 0 }, inspectDocumentInput: async () => true, crossOriginIsolated: isolated,
    setError: (message: string) => errors.push(message), L: (ko: string, en: string) => language === "ko" ? ko : en,
    choose: (files: File[]) => chosen.push(files), setUnsavedWork: noop,
  });
  const result = await adapter.receive([input], { signal: new AbortController().signal });
  assert.equal(result.status, isolated ? "accepted" : "rejected");
  assert.equal(chosen.length, isolated ? 1 : 0); assert.equal(errors.length, isolated ? 0 : 1);
  if (!isolated) { assert.match(errors[0], language === "ko" ? /브라우저.*준비.*완료하지 못/ : /browser could not prepare/); assert.equal(result.rejected[0].file, input); }
});
