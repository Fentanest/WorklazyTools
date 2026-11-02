import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
// Run actual intake/invalidate function bodies. Only parser IO and state/UI
// boundaries are fixtures, including the real AbortController cancellation.
function fixture(tool: "organize" | "finish", lateFailure = false) {
  const root = process.env.PDF_ROLLBACK_SOURCE_ROOT ?? ".";
  const file = path.resolve(root, `src/features/pdf-editor/Pdf${tool === "organize" ? "Organize" : "Finish"}Panel.tsx`);
  const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const nodes: ts.Node[] = []; const visit = (node: ts.Node) => { nodes.push(node); ts.forEachChild(node, visit); }; visit(source);
  const body = (name: string) => (nodes.find(node => ts.isVariableDeclaration(node) && node.name.getText(source) === name) as ts.VariableDeclaration).initializer!.getText(source);
  const call = nodes.find(node => ts.isCallExpression(node) && node.expression.getText(source) === "useHandoffReceiver" && ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === `pdf-${tool}`) as ts.CallExpression;
  const adapter = call.arguments[1] as ts.ObjectLiteralExpression;
  const invalidate = (adapter.properties.find(p => ts.isPropertyAssignment(p) && p.name.getText(source) === "invalidate") as ts.PropertyAssignment).initializer.getText(source);
  const existing = new File(["existing"], "existing.pdf"), incoming = new File(["incoming"], "incoming.pdf"), newer = new File(["newer"], "newer.pdf"), queued = new File(["queued"], "queued.pdf");
  const legacySource = { id: "old", key: "old", file: existing, pageCount: 1 };
  const state: Record<string, any> = { sources: [legacySource], pages: [{ id: "old-page", sourceId: "old", rotation: 90 }], file: existing, fileKey: "old", pageCount: 1, rangeText: "1", parity: "odd", selectedPageIds: new Set(["old-page"]), movePageIds: new Set(["old-page"]), splitAfterPageIds: new Set(["old-page"]), selectionRange: "1", selectionError: "old-note", inspecting: false, error: "", previewing: false, riskAccepted: true, preflight: { status: "ready" } };
  const refs: Record<string, { current: any }> = { handoffRollback: { current: null }, resumeGeneration: { current: 0 }, activeController: { current: undefined }, pendingInputs: { current: [queued] }, sourcesRef: { current: [legacySource] }, focusAfterLoad: { current: undefined }, fileRequestRef: { current: 0 }, pendingIntakeRequestRef: { current: null }, executionOwnerRef: { current: 0 }, fileLifecycleControllerRef: { current: undefined }, controllerRef: { current: undefined }, previewOwnerRef: { current: undefined }, fileRef: { current: existing } };
  const output = { name: "old-output" }; let outputs: any[] = [output], invalidations = 0, finish!: () => void;
  const delayed = new Promise<void>(resolve => { finish = resolve; }); const released: File[] = [];
  let seq = 0;
  const context: any = { ...refs, AbortController, Set, Map, Error, console,
    language: "en", copy: { invalidFile: "Invalid PDF" }, direct: { acceptedPreset: undefined }, handoff: { notReceived: false }, PDF_ORGANIZE_SAFE_PATHS: [], PDF_FINISH_SAFE_PATHS: [],
    featureMessage: (_lang: string, key: string) => key, inspectionErrorMessage: () => "Inspection failed", isWorkerSetupFailure: () => false,
    createLocalId: () => `new-${++seq}`, acceptsFile: (_id: string, value: File) => value.name.endsWith(".pdf"), setUnsavedWork() {},
    inspectPdf: async (value: File) => { if (value === incoming) { await delayed; if (lateFailure) throw new Error("delayed fixture failure"); } return { pageCount: 1 }; },
    releasePdf: async (value: File) => { released.push(value); },
    operation: { start() {}, update() {}, succeed() {}, reset() {}, fail() {} },
    download: { clearResult() { outputs = []; }, clearResults() { outputs = []; } },
    invalidateResult: () => { outputs = []; invalidations++; },
  };
  for (const key of Object.keys(state)) {
    Object.defineProperty(context, key, { get: () => state[key] });
    context[`set${key[0].toUpperCase()}${key.slice(1)}`] = (value: any) => { state[key] = typeof value === "function" ? value(state[key]) : value; if (key === "sources") refs.sourcesRef.current = state[key]; };
  }
  const receive = tool === "organize" ? body("acquireInput") : body("replaceFile");
  const declaration = tool === "organize" ? `const acquireInput=(${receive});` : `const replaceFile=(${receive}); const removeFile=(${body("removeFile")});`;
  const code = `${declaration} globalThis.api={receive:${tool === "organize" ? "acquireInput" : "replaceFile"},invalidate:(${invalidate})};`;
  vm.runInNewContext(ts.transpileModule(code, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, context);
  const run = (files: File[], controller?: AbortController) => tool === "organize" ? context.api.receive(files, controller && { signal: controller.signal }) : context.api.receive(files, undefined, controller && { signal: controller.signal });
  return { state, refs, existing, incoming, newer, queued, released, run, invalidate: context.api.invalidate, finish, output: () => outputs, invalidations: () => invalidations };
}
for (const tool of ["organize", "finish"] as const) for (const lateFailure of [false, true]) {
  test(`${tool}: handoff abort preserves prior inputs, selection and output; ignores late ${lateFailure ? "failure" : "success"}`, async () => {
    const f = fixture(tool, lateFailure), controller = new AbortController();
    const job = f.run([f.incoming], controller); await Promise.resolve();
    controller.abort(); f.invalidate(); f.invalidate();
    assert.equal(f.state.sources[0].file, f.existing); assert.equal(f.output().length, 1);
    assert.equal(f.released.includes(f.existing), false);
    if (tool === "organize") { assert.deepEqual([...f.state.selectedPageIds], ["old-page"]); assert.equal(f.state.pages[0].rotation, 90); assert.equal(f.refs.pendingInputs.current[0], f.queued); }
    else { assert.equal(f.refs.fileRef.current, f.existing); assert.equal(f.state.rangeText, "1"); assert.equal(f.state.parity, "odd"); assert.equal(f.state.riskAccepted, true); }
    f.finish(); await job;
    assert.equal(f.state.sources[0].file, f.existing); assert.equal(f.state.sources.length, 1); assert.equal(f.output().length, 1);
  });
  test(`${tool}: stale handoff abort cannot reset a newer manual input (${lateFailure ? "failure" : "success"})`, async () => {
    const f = fixture(tool, lateFailure), controller = new AbortController();
    const job = f.run([f.incoming], controller); await Promise.resolve(); await f.run([f.newer]);
    controller.abort(); f.invalidate(); f.finish(); await job;
    assert.ok(f.state.sources.some((source: any) => source.file === f.newer)); assert.equal(f.state.sources.some((source: any) => source.file === f.incoming), false);
    if (tool === "organize") assert.equal(f.state.sources[0].file, f.existing); else assert.equal(f.refs.fileRef.current, f.newer);
  });
}
for (const tool of ["organize", "finish"] as const) test(`${tool}: completed intake and unrelated invalidate are not rolled back`, async () => {
  const f = fixture(tool), controller = new AbortController();
  await f.run([f.newer], controller); controller.abort(); f.invalidate();
  assert.ok(f.state.sources.some((source: any) => source.file === f.newer));
  assert.equal(f.output().length, 0);
});
test("finish: timeout of mixed retained/new files never releases retained input", async () => {
  const f = fixture("finish"), controller = new AbortController(); const job = f.run([f.existing, f.incoming], controller);
  await Promise.resolve(); controller.abort(); f.invalidate(); f.finish(); await job;
  assert.equal(f.state.sources[0].file, f.existing); assert.equal(f.released.includes(f.existing), false); assert.equal(f.output().length, 1);
});
