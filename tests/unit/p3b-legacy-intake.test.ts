import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function fixture(outcome: "ready" | "empty" | "throw") {
  const file = `${process.env.P3B_SOURCE_ROOT ?? "."}/src/features/excel-merger/ExcelMergerPage.tsx`;
  const source = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const nodes: ts.Node[] = [];
  const visit = (node: ts.Node) => { nodes.push(node); ts.forEachChild(node, visit); }; visit(source);
  const handle = (nodes.find(node => ts.isVariableDeclaration(node) && node.name.getText(source) === "handleFiles") as ts.VariableDeclaration).initializer!.getText(source);
  const call = nodes.find(node => ts.isCallExpression(node) && node.expression.getText(source) === "useHandoffReceiver") as ts.CallExpression;
  const adapter = call.arguments[1] as ts.ObjectLiteralExpression;
  const invalidateNode = (adapter.properties.find(node => ts.isPropertyAssignment(node) && node.name.getText(source) === "invalidate") as ts.PropertyAssignment).initializer;
  const invalidate = ts.isIdentifier(invalidateNode)
    ? (nodes.find(node => ts.isVariableDeclaration(node) && node.name.getText(source) === invalidateNode.text) as ts.VariableDeclaration).initializer!.getText(source)
    : invalidateNode.getText(source);
  const input = new File(["xls"], "incoming.xls"), generation = { current: 0 }, rollback = { current: null as any };
  let entries: any[] = [], cleared = 0, error: string | null = "previous error", finish!: () => void;
  const pending = new Promise<void>(resolve => { finish = resolve; });
  const context: Record<string, any> = { intakeGeneration: generation, handoffRollback: rollback, entries, precisionPreparing: false,
    fileKey: (file: File) => file.name, SUPPORTED_EXTENSIONS: new Set(["xls"]), createFileId: () => "incoming", setFileNotice() {}, setError(value: string | null) { error = value; },
    precisionControllerRef: { current: undefined }, setPrecisionPreparing() {}, operation: { reset() {} },
    setEntries: (fn: Function) => { entries = fn(entries); }, clearResult: () => { cleared++; },
    preserveLegacyXls: true, getExtension: () => "xls", requiresLegacySpreadsheetConversion: async () => true,
    prepareLegacyInputs: async (additions: any[]) => { await pending; if (outcome === "throw") throw Error("fixture failure"); if (outcome === "empty") error = "legacy preparation failed"; return outcome === "ready" ? additions.map(entry => entry.file) : []; },
  };
  vm.runInNewContext(ts.transpileModule(`globalThis.api={receive:(${handle}),invalidate:(${invalidate})}`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText, context);
  return { input, generation, rollback, finish, receive: context.api.receive, invalidate: context.api.invalidate, entries: () => entries, cleared: () => cleared, error: () => error };
}
for (const outcome of ["ready", "empty", "throw"] as const) test(`P3b legacy ${outcome} completion releases only its rollback; late invalidate preserves inputs`, async () => {
  const f = fixture(outcome), abort = new AbortController();
  const pending = f.receive([f.input], { signal: abort.signal });
  const checked = outcome === "throw" ? assert.rejects(pending, /fixture failure/) : pending;
  await Promise.resolve(); await Promise.resolve();
  assert.ok(f.rollback.current); f.finish(); await checked;
  assert.equal(f.rollback.current, null); abort.abort(); f.invalidate();
  assert.equal(f.entries()[0].file, f.input); assert.equal(f.cleared(), outcome === "ready" ? 1 : 0);
  assert.equal(f.error(), outcome === "ready" ? null : outcome === "empty" ? "legacy preparation failed" : "previous error");
});
test("P3b pending legacy abort retains rollback until invalidate removes only its additions", async () => {
  const f = fixture("empty"), abort = new AbortController();
  const pending = f.receive([f.input], { signal: abort.signal }); await Promise.resolve(); await Promise.resolve();
  assert.ok(f.rollback.current); abort.abort(); f.invalidate(); f.finish(); await pending;
  assert.equal(f.entries().length, 0); assert.equal(f.rollback.current, null);
});
test("P3b stale legacy completion cannot clear a newer intake rollback", async () => {
  const f = fixture("ready"), abort = new AbortController();
  const pending = f.receive([f.input], { signal: abort.signal }); await Promise.resolve(); await Promise.resolve();
  const newer = { generation: ++f.generation.current, signal: new AbortController().signal, ids: new Set(["newer"]) };
  f.rollback.current = newer; f.finish(); await pending;
  assert.equal(f.rollback.current, newer); assert.equal(f.cleared(), 0);
});
