import assert from "node:assert/strict";
import fs from "node:fs";
import { before, test } from "node:test";
import { loadPyodide } from "pyodide";
import { compareDocumentModels, diffText } from "../../src/features/document-compare/documentComparison.ts";
import { serializeManifestForTracked } from "../../src/features/document-compare/manifestWire.ts";

let py: Awaited<ReturnType<typeof loadPyodide>>;
before(async () => {
  Object.assign(globalThis, {
    worklazyDiffJson: (a: string, b: string) => JSON.stringify(diffText(a, b)),
    worklazyComparisonManifestJson: (a: string, b: string, formatting: boolean, tables: boolean, metadata: boolean) =>
      JSON.stringify(compareDocumentModels("before", "after", JSON.parse(a), JSON.parse(b), { formatting, tables, metadata }, "en").manifest),
    worklazyWireManifestJson: (a: string, b: string, formatting: boolean) => serializeManifestForTracked(
      compareDocumentModels("before", "after", JSON.parse(a), JSON.parse(b), { formatting, tables: true, metadata: true }, "en").manifest),
  });
  py = await loadPyodide();
  py.globals.set("WORKLAZY_FORMATTING_POLICY_JSON", fs.readFileSync("src/features/word-compare/formatting-policy.json", "utf8"));
  for (const name of ["compare", "accept_revisions", "tracked_docx"]) py.runPython(fs.readFileSync(`src/features/word-compare/${name}.py`, "utf8"));
  py.globals.set("tracked_source", fs.readFileSync("src/features/word-compare/tracked_docx.py", "utf8"));
  const reference = fs.readFileSync("tests/support/word-blank-lcs-reference.py", "utf8");
  py.globals.set("reference_source", reference);
  py.runPython(reference);
  const events = fs.readFileSync("tests/word-package-events.mjs", "utf8");
  py.runPython(events.slice(events.indexOf("def reject(node):"), events.indexOf("def view(")).replaceAll("'events'", "'D02'"));
  py.runPython(fs.readFileSync("tests/support/word-blank-lcs-regression.py", "utf8"));
});

function check(expression: string) {
  return JSON.parse(py.runPython(`json.dumps(${expression})`) as string);
}

test("blank LCS preserves asymmetric ties and long offsets", () => {
  assert.deepEqual(check("_blank_lcs_pairs([0, 0], [0])"), [[0, 0]]);
  assert.deepEqual(check("_blank_lcs_pairs([0, 0], [1, 0])"), [[1, 1]]);
  assert.deepEqual(check("_blank_lcs_pairs([0] * 1000 + [1], [1])"), [[1000, 0]]);
});

test("blank LCS matches frozen DP: exhaustive, random, boundaries and full groups", { timeout: 180_000 }, () => {
  const result = check("check_index_and_groups()");
  assert.deepEqual(result.counts, { exhaustive_pairs: 16129, random_pairs: 12000, boundaries: 8, full_balance: 3000 });
  assert.equal(result.mismatches, 0);
  assert.equal(result.results_sha256, "675071c313f15698692cdf6bae07767a121fa0bd22c7cef0cf46b846c3006c73");
});

test("blank balance matches frozen DP for real XML signatures and section ownership", () => {
  const result = check("check_xml()");
  assert.equal(result.cases, 3000);
  assert.equal(Object.keys(result.xml_kind_counts).length, 15);
  assert.equal(result.mismatches, 0);
  assert.equal(result.results_sha256, "de614f826ba2c51d45cd37b5ff6aa188bd470dc8d269630f31a1fb2aa6a17e7c");
});

test("blank balance preserves every DOCX, Accept All and Reject All part", { timeout: 120_000 }, () => {
  const result = check("check_docx()");
  assert.equal(result.cases, 240);
  assert.equal(result.exports, 480);
  assert.equal(result.formatting_on, 120);
  assert.equal(result.formatting_off, 120);
  assert.equal(result.mismatches, 0);
  assert.equal(result.results_sha256, "4c603af557ce329ae76b6654da3623dec1bdc0f3723d418d549a980f2e92853a");
});
