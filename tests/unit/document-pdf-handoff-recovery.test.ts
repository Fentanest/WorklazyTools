import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import ts from "typescript";

// Exercise the real panel adapter with controlled React state and conversion.
// Native/UI deadline behavior is covered separately by recovery-smoke.
function panel(inspect: () => Promise<boolean> = async () => true) {
  const values: any[] = []; let cursor = 0, adapter: any, inspections = 0, conversions = 0, guards = 0;
  const state = (initial: any) => {
    const index = cursor++;
    if (!(index in values)) values[index] = typeof initial === "function" ? initial() : initial;
    return [values[index], (next: any) => { values[index] = next; }];
  };
  const ref = (initial: any) => state({ current: initial })[0];
  const operation = { reset() {}, start() {}, fail() {}, succeed() {}, updateCurrent() {} };
  const exports: any = {};
  const component = (name: string) => name;
  const require = (id: string): any => {
    if (id === "react") return { useState: state, useRef: ref, useEffect() {} };
    if (id === "react/jsx-runtime") return { jsx: (type: any, props: any) => ({ type, props }), jsxs: (type: any, props: any) => ({ type, props }) };
    if (id.endsWith("/useHandoffReceiver")) return { usePersistentHandoffReceiver: (_id: string, next: any) => { adapter = next; return {}; } };
    if (id === "./inspectDocumentInput") return { inspectDocumentInput: async () => { inspections++; return inspect(); } };
    if (id === "./officePdfClient") return { convertOfficePdf: async () => { conversions++; throw Error("office-operation-timeout"); } };
    if (id.endsWith("/toolState")) return { useUnsavedWorkGuard() {}, setUnsavedWork() { guards++; } };
    if (id.endsWith("/routing")) return { useAppLanguage: () => "en" };
    if (id.endsWith("/useOperationProgress")) return { useOperationProgress: () => operation };
    if (id.endsWith("/featureMessages")) return { featureMessage: (_language: string, key: string) => key };
    return new Proxy({}, { get: (_target, key) => component(String(key)) });
  };
  const environment = { exports, require, AbortController, crossOriginIsolated: true };
  vm.runInNewContext(ts.transpileModule(readFileSync("src/features/pdf-converter/DocumentPdfPanel.tsx", "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, environment);
  function render() { cursor = 0; return exports.DocumentPdfPanel(); }
  function find(tree: any, type: string): any {
    if (!tree || typeof tree !== "object") return undefined;
    if (tree.type === type) return tree.props;
    const children = tree.props?.children;
    return (Array.isArray(children) ? children.flat(Infinity) : [children]).map(child => find(child, type)).find(Boolean);
  }
  return { render, find, setIsolated(value: boolean) { environment.crossOriginIsolated = value; }, adapter: () => adapter, counts: () => ({ inspections, conversions, guards }),
    remount() { values.length = 0; return render(); } };
}
const input = () => new File(["synthetic"], "original.docx");
const context = () => ({ signal: new AbortController().signal });

for (const isolated of [false, true]) for (const duringInspection of [false, true]) test(`document PDF refuses handoff (isolated=${isolated}) ${duringInspection ? "when timeout occurs during inspection" : "after timeout and remount"}`, async () => {
  let release!: (value: boolean) => void;
  const p = panel(duringInspection ? () => new Promise(resolve => { release = resolve; }) : undefined);
  const original = input(), incoming = input();
  p.find(p.render(), "FileDropZone").onFiles([original]);
  let tree = p.render();
  const pending = duringInspection ? p.adapter().receive([incoming], context()) : undefined;
  p.find(tree, "PrimaryButton").onClick();
  await new Promise<void>(resolve => setImmediate(resolve));
  tree = p.render();
  assert.equal(p.find(tree, "FileDropZone").disabled, true);
  assert.equal(p.find(tree, "PersistentHandoffNotice").disabled, true);
  assert.equal(p.find(tree, "PrimaryButton").children, "documentPdf.reload");
  p.setIsolated(isolated);
  if (duringInspection) release(true);
  const result = await (pending ?? p.adapter().receive([incoming], context()));
  assert.equal(result.status, "rejected"); assert.equal(result.accepted.length, 0);
  assert.equal(result.rejected[0].file, incoming); assert.equal(result.rejected[0].reasonCode, "reload-required");
  assert.deepEqual(p.counts(), { inspections: duringInspection ? 1 : 0, conversions: 1, guards: 0 });
  // Timeout invalidation must preserve the selected original and reload state.
  p.adapter().invalidate();
  tree = p.render(); assert.equal(p.find(tree, "FileDropZone").files[0], original);
  // File selection cannot switch to a single or batch input after failure.
  const choose = p.find(tree, "FileDropZone").onFiles;
  choose([incoming]); choose([incoming, input()]);
  tree = p.render(); assert.equal(p.find(tree, "FileDropZone").files[0], original);
  choose([]); tree = p.render(); assert.equal(p.find(tree, "FileDropZone").files.length, 0);
  assert.equal(p.find(tree, "PrimaryButton").children, "documentPdf.reload");
  tree = p.remount(); assert.equal(p.find(tree, "FileDropZone").disabled, true);
  const remounted = await p.adapter().receive([incoming], context()); assert.equal(remounted.status, "rejected");
  assert.equal(remounted.rejected[0].reasonCode, "reload-required");
  assert.equal(tree.props.children.flat(Infinity).find((child: any) => child?.props?.role === "alert").props.children, "documentPdf.timeout");
});

test("healthy document PDF handoff still accepts input and installs protection", async () => {
  const p = panel(); p.render(); const original = input();
  const result = await p.adapter().receive([original], context());
  assert.equal(result.status, "accepted"); assert.equal(result.accepted[0], original);
  assert.equal(p.find(p.render(), "FileDropZone").files[0], original);
  assert.deepEqual(p.counts(), { inspections: 1, conversions: 0, guards: 1 });
});
