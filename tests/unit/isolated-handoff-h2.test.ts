import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFileSync } from "node:fs";
import ts from "typescript";
import { isolatedFileAccepts } from "../../src/app/fileAccepts.ts";
import { inspectDocumentInput } from "../../src/features/pdf-converter/inspectDocumentInput.ts";

function sender(stage: (input: any) => Promise<void>, assign: (path: string) => void, cancel: (receiverId: string) => Promise<void> = async () => {}) {
  const exports: any = {};
  vm.runInNewContext(ts.transpileModule(readFileSync("src/app/openInIsolatedTool.ts", "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText,
    { exports, window: { location: { assign } }, require: (id: string) => id === "./fileAccepts" ? { isolatedFileAccepts } : {
      stagePendingPersistentHandoff: stage, cancelPendingPersistentHandoff: cancel, PersistentHandoffError: class extends Error { code: string; constructor(code: string) { super(code); this.code = code; } },
    } });
  return exports;
}
test("isolated sender awaits storage before whole-document navigation, preserving a plain URL", async () => {
  let release!: () => void; const events: string[] = [];
  const s = sender(async input => { assert.equal(input.entryPath, "/tools/document-redactor"); assert.equal(input.files.length, 1); events.push("stage"); await new Promise<void>(resolve => { release = resolve; }); }, path => { assert.equal(path, "/en/tools/document-redactor"); events.push("assign"); });
  const sent = s.openInIsolatedTool("document-redactor", [new File(["x"],"x.pdf")], "/en/tools/document-redactor");
  await new Promise<void>(resolve => setImmediate(resolve)); assert.deepEqual(events,["stage"]); release(); await sent; assert.deepEqual(events,["stage","assign"]);
});
test("storage failure, overlap and invalid formats never navigate", async () => {
  let release!: () => void, calls = 0;
  const s = sender(async () => { calls++; await new Promise<void>(resolve => { release = resolve; }); }, () => {});
  const sent=s.openInIsolatedTool("xls-preserve",[new File(["x"],"x.xls")],"/target");
  await assert.rejects(s.openInIsolatedTool("xls-preserve",[new File(["x"],"y.xls")],"/target"),{code:"invalid"});
  await new Promise<void>(resolve => setImmediate(resolve)); assert.equal(calls,1);release();await sent;
  const bad = sender(async()=>{throw Error("quota")},()=>assert.fail("must stay on source"));
  await assert.rejects(bad.openInIsolatedTool("document-to-pdf",[new File(["x"],"x.docx")],"/target"),/quota/);
  await assert.rejects(bad.openInIsolatedTool("document-redactor",[new File(["x"],"x.zip")],"/target"),{code:"invalid"});
});
for (const ext of ["docx","xlsx","pptx","doc","xls","ppt"]) test(`document intake inspects actual ${ext} without starting conversion`, async () => {
  const file=new File([readFileSync(`tests/fixtures/document-converters/sample.${ext}`)],`sample.${ext}`);
  assert.equal(await inspectDocumentInput(file,new AbortController().signal),true);
});
test("document intake rejects wrong, encrypted, oversized, empty and cancelled inputs",async()=>{
  for(const file of [new File(["broken"],"x.docx"),new File([],"x.docx"),new File(["PK"],"x.odt"),new File([readFileSync("tests/fixtures/document-converters/encrypted.docx")],"x.docx")]) {
    assert.equal(await inspectDocumentInput(file,new AbortController().signal).catch(()=>false),false);
  }
  const huge=new File([],"x.docx");Object.defineProperty(huge,"size",{value:50*1024*1024+1});
  assert.equal(await inspectDocumentInput(huge,new AbortController().signal),false);
  const controller=new AbortController();controller.abort();
  await assert.rejects(inspectDocumentInput(new File(["nonempty"],"x.xls"),controller.signal),{name:"AbortError"});
});


test("P3 H2 retry cancels its receiver's previous record before stage and navigation", async () => {
  let release!: () => void; const events: string[] = []; let occupied = true;
  const s = sender(async () => { assert.equal(occupied, false, "old record would block quota"); events.push("stage"); }, () => events.push("assign"), async id => {
    assert.equal(id, "document-redactor"); events.push("cancel"); await new Promise<void>(resolve => { release = resolve; }); occupied = false;
  });
  const sent = s.openInIsolatedTool("document-redactor", [new File(["new"], "new.pdf")], "/en/tools/document-redactor");
  void sent.catch(() => undefined);
  assert.deepEqual(events, ["cancel"]); release(); await sent; assert.deepEqual(events, ["cancel", "stage", "assign"]);
});
test("P3 old-record cancellation failure keeps H2 on source and permits retry", async () => {
  let failing = true, stages = 0, moves = 0;
  const s = sender(async () => { stages++; }, () => { moves++; }, async () => { if (failing) throw new Error("blocked"); });
  const files = [new File(["new"], "new.xls")];
  await assert.rejects(s.openInIsolatedTool("xls-preserve", files, "/target"), /blocked/);
  assert.equal(stages, 0); assert.equal(moves, 0);
  failing = false; await s.openInIsolatedTool("xls-preserve", files, "/target"); assert.equal(stages, 1); assert.equal(moves, 1);
});
