import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadPyodide } from "pyodide";

import {
  compareDocumentModels,
  diffText,
} from "../src/features/document-compare/documentComparison.ts";

const testRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(testRoot, "..");
const fixtureRoot = path.join(testRoot, "fixtures/document-compare");
const contract = JSON.parse(fs.readFileSync(path.join(fixtureRoot, "equivalence-contract.json"), "utf8"));
const pairSpecs = [...contract.fixturePairs, contract.exactPackagePair];

assert.equal(contract.schemaVersion, 1);
assert.equal(contract.offsetUnit, "unicode-code-point");
assert.equal(contract.fixturePairs.length, 5);
assert.deepEqual(contract.exceptions.map((item) => item.reasonId), ["E1", "E2", "E3", "E4", "E5", "E6"]);
assert.equal(new Set(contract.exceptions.map((item) => item.fixtureId)).size, 6);
assert(contract.exceptions.every((item) => item.reason.length > 20));
assert(contract.exceptions.some((item) => item.reasonId === "E2" && item.fixtureId.includes("split")));
assert(contract.exceptions.some((item) => item.reasonId === "E6" && item.fixtureId.includes("joined-cell")));

let bridgeCalls = 0;
globalThis.worklazyDiffJson = (before, after) => {
  assert.equal(typeof before, "string");
  assert.equal(typeof after, "string");
  bridgeCalls += 1;
  return JSON.stringify(diffText(before, after));
};

const pyodide = await loadPyodide();
pyodide.FS.mkdirTree("/fixtures/oracle");
for (const pair of pairSpecs) {
  for (const relativePath of [pair.before, pair.after]) {
    pyodide.FS.writeFile(`/fixtures/${relativePath}`, fs.readFileSync(path.join(fixtureRoot, relativePath)));
  }
}
pyodide.globals.set("PAIR_SPECS_JSON", JSON.stringify(pairSpecs));
for (const relativePath of [
  "src/features/word-compare/alignment.py",
  "src/features/word-compare/compare.py",
  "src/features/word-compare/accept_revisions.py",
  "src/features/word-compare/tracked_docx.py",
  "tests/support/document-diff-equivalence.py",
]) {
  pyodide.runPython(fs.readFileSync(path.join(repositoryRoot, relativePath), "utf8"));
}

const result = JSON.parse(pyodide.runPython("json.dumps(result, ensure_ascii=False)"));
const reports = new Map(result.pairs.map((report) => [report.id, report]));
const models = new Map(result.models.map((row) => [row.id, row]));
const requiredKeyFields = ["pairId", "storyPart", "beforeIndexes", "afterIndexes", "beforePath", "afterPath"];
const allowedMismatches = [...contract.allowedSidecarMismatches].sort();
const observedMismatches = [];
let matchingSidecars = 0;

for (const pair of contract.fixturePairs) {
  const report = reports.get(pair.pairId);
  assert(report, `Missing sidecar report for ${pair.pairId}`);
  assert(report.revisionCount >= 0);
  assert(report.packageParts.includes("[Content_Types].xml"));
  assert(report.packageParts.includes("word/document.xml"));
  assert.equal(report.commentsPreserved, true, `${pair.pairId} comments.xml changed`);
  assert.equal(report.acceptedTextMatchesAcceptedAfter, true, `${pair.pairId} accepted text differs from accepted after`);
  assert.equal(report.acceptedMatchesAcceptedAfter, true, `${pair.pairId} accepted package model differs from accepted after`);
  assert(report.observations.length > 0, `${pair.pairId} produced no paragraph sidecars`);
  report.observations.forEach((observation, index) => {
    for (const field of requiredKeyFields) assert(Object.hasOwn(observation.key, field), `${pair.pairId} sidecar lacks ${field}`);
    assert.equal(observation.key.pairId, pair.pairId);
    assert.equal(typeof observation.key.storyPart, "string");
    assert(Array.isArray(observation.key.beforeIndexes));
    assert(Array.isArray(observation.key.afterIndexes));
    if (observation.key.sourceSlice) {
      assert.deepEqual(observation.key.sourceSlice, observation.key.sourceSlice.map((value) => Number(value)));
      assert.equal(observation.key.sourceSlice.length, 2);
    }
    const reconstructedBefore = observation.actual
      .filter((segment) => segment.type !== "added")
      .map((segment) => segment.text)
      .join("");
    const reconstructedAfter = observation.actual
      .filter((segment) => segment.type !== "deleted")
      .map((segment) => segment.text)
      .join("");
    assert.equal(reconstructedAfter, observation.after, `${pair.pairId} accept reconstruction failed`);
    if (observation.match) {
      matchingSidecars += 1;
      assert.equal(reconstructedBefore, observation.before, `${pair.pairId} reject reconstruction failed`);
    } else {
      observedMismatches.push(`${pair.pairId}:paragraph-call:${index}`);
      assert.equal(observation.preservedAfterRevision, true);
    }
  });
}
assert.deepEqual(observedMismatches.sort(), allowedMismatches);

const exactReport = reports.get(contract.exactPackagePair.pairId);
const exactModels = models.get(contract.exactPackagePair.pairId);
assert(exactReport && exactModels);
assert.equal(exactReport.observations.length, 4);
assert.equal(exactReport.packageRows.length, 4);
assert(exactReport.observations.every((observation) => observation.match));
for (const observation of exactReport.observations) {
  assert.deepEqual(Object.keys(observation.key).sort(), requiredKeyFields.slice().sort());
  assert.equal(observation.key.pairId, contract.exactPackagePair.pairId);
  assert.equal(observation.key.storyPart, "word/document.xml");
}

const webResult = compareDocumentModels(
  "exact-before.docx",
  "exact-after.docx",
  exactModels.before,
  exactModels.after,
  { formatting: true, tables: true, metadata: true },
  "ko",
);
const paragraphRows = webResult.views.document
  .filter((view) => view.blockType === "paragraph")
  .map((view) => withCodePointOffsets(view.segments));
const tableRows = webResult.changes
  .filter((change) => change.section === "table")
  .map((change) => withCodePointOffsets(change.segments));
const expectedPackageRows = [...paragraphRows, ...tableRows];
assert.equal(expectedPackageRows.length, 4);
assert.deepEqual(exactReport.packageRows, expectedPackageRows);

const shifted = structuredClone(exactReport.packageRows);
const shiftedSegment = shifted.flat().find((segment) => segment.type !== "equal");
assert(shiftedSegment);
shiftedSegment.beforeOffset += 1;
assert.notDeepEqual(shifted, expectedPackageRows, "Offset-shift negative control did not fail");

const edgeMatches = Object.fromEntries(result.edges.map((edge) => [edge.id, edge.match]));
assert.deepEqual(edgeMatches, {
  tab: true,
  br: true,
  cr: true,
  surrogate: true,
  combining: true,
  "empty-run": true,
  "empty-text": true,
  "existing-after": false,
});
assert(bridgeCalls > 0);

console.log(JSON.stringify({
  pyodide: pyodide.version,
  bridgeCalls,
  fixturePairs: contract.fixturePairs.length,
  sidecars: contract.fixturePairs.reduce((sum, pair) => sum + reports.get(pair.pairId).observations.length, 0),
  matchingSidecars,
  allowedSidecarMismatches: observedMismatches.length,
  exactPackageKeys: exactReport.packageRows.length,
  offsetNegativeControlRejected: true,
  edgeCases: result.edges.length,
  exceptionIds: contract.exceptions.map((item) => `${item.reasonId}:${item.fixtureId}`),
}, null, 2));

function withCodePointOffsets(segments) {
  let beforeOffset = 0;
  let afterOffset = 0;
  const result = [];
  for (const segment of segments) {
    if (!segment.text) continue;
    result.push({ ...segment, beforeOffset, afterOffset });
    const length = Array.from(segment.text).length;
    if (segment.type !== "added") beforeOffset += length;
    if (segment.type !== "deleted") afterOffset += length;
  }
  return result;
}
