import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import ts from "typescript";
import { loadPyodide } from "pyodide";
import { documentCapabilities, documentProvenance } from "../../src/features/document-compare/documentCapabilities.ts";
import { compareDocumentModels, diffText } from "../../src/features/document-compare/documentComparison.ts";
import { serializeManifestForTracked } from "../../src/features/document-compare/manifestWire.ts";
import { sniffDocumentFormat } from "../../src/features/document-compare/documentFormat.ts";
import { restoreModelTransport } from "../../src/features/word-compare/modelTransport.ts";
import { isOutOfMemory, outOfMemoryMessage, trackedOutOfMemoryMessage } from "../../src/features/document-compare/memoryFailure.ts";
import { screenResult } from "../../src/features/document-compare/screenResult.ts";

// The Word worker itself (its source, run here with real Pyodide and the real comparison modules):
// a batch saves the tracked model fields per pair and restores them before generation, so no document
// is extracted again, and every screen result and tracked file equals the one the pair gets alone.
// Saving, reducing or restoring may fail or exceed the budget; the batch then still delivers every
// screen result and file, extracting again (Astra R44, R45, R47).
const WORD = "src/features/word-compare";
const script = (name: string) => fs.readFileSync(`${WORD}/${name}`, "utf8");
const names = ["documentCapabilities", "documentProvenance", "acceptRevisionsScript", "compareScript", "trackedDocxScript", "formattingPolicy", "pyodidePackage",
  "compareDocumentModels", "diffText", "serializeManifestForTracked", "sniffDocumentFormat", "extractLegacyDocModel", "restoreModelTransport",
  "isOutOfMemory", "outOfMemoryMessage", "trackedOutOfMemoryMessage", "screenResult", "self", "injectedPyodide"];

function workerSource(budget?: number) {
  let source = script("word.worker.ts").replace(/^import .*;\r?\n/gm, "").replace("export {};", "")
    .replace("import.meta.env.BASE_URL", '"/"').replace("await import(/* @vite-ignore */ PYODIDE_MODULE_URL)", "injectedPyodide");
  if (budget !== undefined) source = source.replace("const TRACKED_FACTS_BUDGET = 64 * 1024 * 1024;", `const TRACKED_FACTS_BUDGET = ${budget};`);
  assert.ok(!/^import /m.test(source) && source.includes("= injectedPyodide;") && (budget === undefined || source.includes(`TRACKED_FACTS_BUDGET = ${budget};`)), "the worker source shape this harness expects");
  return ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None } }).outputText;
}

// Fixed revision dates, a count of model extractions, and optional failures of the batch helpers.
const SETUP = String.raw`
import datetime as _real_datetime, types as _types
class _Fixed(_real_datetime.datetime):
    @classmethod
    def now(cls, tz=None): return cls(2026, 1, 1, tzinfo=_real_datetime.timezone.utc)
datetime = _types.ModuleType("datetime"); datetime.__dict__.update(_real_datetime.__dict__); datetime.datetime = _Fixed
_extractions = [0]
_extract_object = _extract_document_model_object
def _extract_document_model_object(*args, **kwargs):
    _extractions[0] += 1
    return _extract_object(*args, **kwargs)
`;

type Run = { messages: Array<{ type: string; index?: number; result?: unknown; trackedBuffer?: ArrayBuffer; warnings?: string[] }>; extractions: number };

async function runWorker(pairs: Array<[Uint8Array, Uint8Array, string]>, language: "ko" | "en", options: { fail?: string; budget?: number; accept?: boolean } = {}): Promise<Run> {
  const py = await loadPyodide();
  const runPython = py.runPython.bind(py);
  let scripts = 0;
  py.runPython = ((code: string, ...rest: unknown[]) => {
    const value = runPython(code, ...(rest as []));
    if (++scripts === 3) {
      runPython(SETUP);
      if (options.fail) runPython(`def ${options.fail}(*args, **kwargs):\n    raise MemoryError()`);
    }
    return value;
  }) as typeof py.runPython;
  const messages: Run["messages"] = [];
  const global = globalThis as unknown as Record<string, unknown>;
  global.location = { origin: "http://localhost" };
  global.postMessage = (message: Run["messages"][number]) => { messages.push(message); };
  try {
    const values = [documentCapabilities, documentProvenance, script("accept_revisions.py"), script("compare.py"), script("tracked_docx.py"),
      JSON.parse(script("formatting-policy.json")), { version: "test" }, compareDocumentModels, diffText, serializeManifestForTracked, sniffDocumentFormat,
      () => { throw new Error("no DOC input here"); }, restoreModelTransport, isOutOfMemory, outOfMemoryMessage, trackedOutOfMemoryMessage, screenResult,
      globalThis, { loadPyodide: async () => py }];
    new Function(...names, workerSource(options.budget))(...values);
    await (global.onmessage as (event: unknown) => Promise<void>)({ data: {
      pairs: pairs.map(([before, after, key]) => ({ beforeName: `${key}-before.docx`, afterName: `${key}-after.docx`, beforeBuffer: before.slice().buffer, afterBuffer: after.slice().buffer })),
      language,
      options: { trackedDocument: true, rewriteRevisionAuthor: options.accept ?? true, revisionAuthor: "WorkLazy", formatting: true, tables: true, metadata: true },
    } });
    return { messages: messages.filter((message) => message.type !== "progress"), extractions: Number(runPython("_extractions[0]")) };
  } finally {
    delete global.onmessage; delete global.postMessage; delete global.location;
  }
}

test("a Word batch restores saved model fields instead of extracting again, with the outputs a pair gets alone", { timeout: 600_000 }, async () => {
  const fixtures = await loadPyodide();
  const docx = (text: string) => fixtures.runPython(String.raw`
import io, zipfile
def make(text):
    W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
    body = "".join('<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>' + word + '</w:t></w:r><w:r><w:t xml:space="preserve"> ' + word + ' tail</w:t></w:r></w:p>' for word in text.split())
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("[Content_Types].xml", '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
        archive.writestr("_rels/.rels", '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
        archive.writestr("word/document.xml", '<w:document xmlns:w="' + W + '"><w:body>' + body + '<w:sectPr/></w:body></w:document>')
    return buffer.getvalue()
make(${JSON.stringify(text)})`).toJs() as Uint8Array;
  const [a, b, c, d] = [docx("alpha beta gamma"), docx("alpha delta gamma epsilon"), docx("one two three"), docx("one three four")];
  const parts = (buffer: ArrayBuffer | undefined) => {
    assert.ok(buffer, "a tracked file");
    const zip = fixtures.runPython(`import io, zipfile, json\ndef parts(data):\n    with zipfile.ZipFile(io.BytesIO(bytes(data))) as z: return json.dumps([[n, z.read(n).hex()] for n in z.namelist()])\nparts`) as (data: Uint8Array) => string;
    return zip(new Uint8Array(buffer));
  };
  const outputs = (run: Run) => {
    const order = run.messages.map((message) => `${message.type}${message.index ?? ""}`);
    const screens = run.messages.filter((message) => message.type === "screen").map((message) => JSON.stringify(message.result));
    const files = run.messages.filter((message) => message.type === "tracked").map((message) => ({ file: parts(message.trackedBuffer), warnings: message.warnings }));
    return { order, screens, files };
  };
  const alone = new Map<string, { screen: string; file: unknown }>();
  const single = async (before: Uint8Array, after: Uint8Array, language: "ko" | "en", key: string) => {
    if (!alone.has(key)) {
      const run = outputs(await runWorker([[before, after, key]], language));
      assert.deepEqual(run.order, ["screen0", "tracked0", "done"]);
      alone.set(key, { screen: run.screens[0], file: run.files[0] });
    }
    return alone.get(key)!;
  };
  const scenarios: Array<{ name: string; pairs: Array<[Uint8Array, Uint8Array, string]>; language: "ko" | "en"; fail?: string; budget?: number; extractions: number }> = [
    { name: "different pairs", pairs: [[a, b, "ab"], [c, d, "cd"], [b, a, "ba"]], language: "ko", extractions: 6 },
    // Screen pass: a, b; b is still cached, d; a, b again (the cache holds two models). Nothing after.
    { name: "shared document and a repeated pair", pairs: [[a, b, "ab"], [b, d, "bd"], [a, b, "ab"]], language: "ko", extractions: 5 },
    { name: "English", pairs: [[a, b, "ab-en"], [c, d, "cd-en"]], language: "en", extractions: 4 },
    { name: "saving fails", pairs: [[a, b, "ab"], [c, d, "cd"]], language: "ko", fail: "tracked_source_facts", extractions: 8 },
    { name: "reducing fails", pairs: [[a, b, "ab"], [c, d, "cd"]], language: "ko", fail: "keep_tracked_source_facts", extractions: 4 },
    { name: "restoring fails", pairs: [[a, b, "ab"], [c, d, "cd"]], language: "ko", fail: "restore_tracked_source_facts", extractions: 8 },
    { name: "over the budget", pairs: [[a, b, "ab"], [c, d, "cd"]], language: "ko", budget: 1, extractions: 8 },
  ];
  for (const scenario of scenarios) {
    const run = await runWorker(scenario.pairs, scenario.language, { fail: scenario.fail, budget: scenario.budget });
    const batch = outputs(run);
    const count = scenario.pairs.length;
    assert.deepEqual(batch.order, [...Array.from({ length: count }, (_, i) => `screen${i}`), ...Array.from({ length: count }, (_, i) => `tracked${i}`), "done"], scenario.name);
    assert.equal(run.extractions, scenario.extractions, `${scenario.name}: model extractions`);
    for (const [index, [before, after, key]] of scenario.pairs.entries()) {
      const expected = await single(before, after, scenario.language, key);
      assert.equal(batch.screens[index], expected.screen, `${scenario.name}: screen result ${index}`);
      assert.deepEqual(batch.files[index], expected.file, `${scenario.name}: tracked file ${index}`);
    }
  }
});
