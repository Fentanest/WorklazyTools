import assert from "node:assert/strict";
import { createHash } from "node:crypto";
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
const sidecarContract = JSON.parse(fs.readFileSync(path.join(fixtureRoot, "equivalence-sidecars.json"), "utf8"));
const mutation = process.env.DOCUMENT_DIFF_MUTATION ?? "";
const activeExceptionFixturePairs = mutation === "remove-e6-fixture" ? [] : contract.exceptionFixturePairs;
const pairSpecs = [...contract.fixturePairs, contract.exactPackagePair, ...activeExceptionFixturePairs];

assert.equal(contract.schemaVersion, 1);
assert.equal(contract.offsetUnit, "unicode-code-point");
assert.equal(contract.fixturePairs.length, 5);
assert.equal(contract.exceptionFixturePairs.length, 1);
assert.deepEqual(contract.packageReject.fixturePairIds, contract.fixturePairs.map((pair) => pair.pairId));
assert.equal(sidecarContract.schemaVersion, 1);
assert.deepEqual(sidecarContract.fields, [
  "pairId",
  "storyPart",
  "beforeIndexes",
  "afterIndexes",
  "beforePath",
  "afterPath",
  "sourceSlice",
  "expectedResult",
]);
assert.equal(sidecarContract.resultSha256ByExpectation.length, sidecarContract.expectations.length);
assert.deepEqual(contract.exceptions.map((item) => item.reasonId), ["E1", "E2", "E3", "E4", "E5", "E6"]);
assert.equal(new Set(contract.exceptions.map((item) => item.fixtureId)).size, 6);
assert(contract.exceptions.every((item) => item.reason.length > 20));
assert(contract.exceptions.some((item) => item.reasonId === "E2" && item.fixtureId.includes("split")));
assert(contract.exceptions.some((item) => item.reasonId === "E6" && item.fixtureId.includes("joined-cell")));
const declaredPairIds = new Set(pairSpecs.map((pair) => pair.pairId));
assert(declaredPairIds.has(contract.multiParagraphCellFixture.pairId),
  `${contract.multiParagraphCellFixture.fixtureId} pair is not registered`);
for (const exception of contract.exceptions) {
  assert(declaredPairIds.has(exception.fixtureId.split(":", 1)[0]), `${exception.reasonId} references an unregistered pair`);
}
assert.equal(contract.commentFixture.fixtureId, contract.exceptions.find((item) => item.reasonId === "E4")?.fixtureId);
assert.equal(contract.multiParagraphCellFixture.fixtureId, contract.exceptions.find((item) => item.reasonId === "E6")?.fixtureId);

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
    const fixture = fs.readFileSync(path.join(fixtureRoot, relativePath));
    pyodide.FS.writeFile(`/fixtures/${relativePath}`, relativePath.endsWith(".b64")
      ? Buffer.from(fixture.toString("utf8").replace(/\s/g, ""), "base64")
      : fixture);
  }
}
pyodide.globals.set("PAIR_SPECS_JSON", JSON.stringify(pairSpecs));
pyodide.globals.set("ORACLE_MUTATION", mutation);
pyodide.globals.set("PACKAGE_REJECT_AUTHOR", contract.packageReject.targetAuthor);
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
if (mutation === "structure-key") {
  const observation = result.pairs.find((report) => report.id === "base")?.observations[0];
  assert(observation, "Structure-key negative control has no target observation");
  observation.key = {
    ...observation.key,
    pairId: "wrong-pair",
    storyPart: "wrong/story.xml",
    beforeIndexes: [-999],
    afterIndexes: [-999],
    beforePath: "WRONG/PATH",
    afterPath: "WRONG/PATH",
    sourceSlice: [-999, -998],
  };
}
const reports = new Map(result.pairs.map((report) => [report.id, report]));
const models = new Map(result.models.map((row) => [row.id, row]));
const requiredKeyFields = ["pairId", "storyPart", "beforeIndexes", "afterIndexes", "beforePath", "afterPath"];
const exceptionReasons = new Map(contract.exceptions.map((item) => [item.reasonId, item.reason]));
const expectedSidecars = new Map();
for (const [index, row] of sidecarContract.expectations.entries()) {
  assert.equal(row.length, sidecarContract.fields.length);
  const entry = Object.fromEntries(sidecarContract.fields.map((field, index) => [field, row[index]]));
  const key = sidecarKey(entry);
  assert(!expectedSidecars.has(key), `Duplicate expected sidecar key: ${key}`);
  assert(entry.expectedResult === "match" || exceptionReasons.has(entry.expectedResult));
  expectedSidecars.set(key, { ...entry, resultSha256: sidecarContract.resultSha256ByExpectation[index] });
}
const observedSidecars = new Set();
let matchingSidecars = 0;
let allowedSidecarMismatches = 0;

for (const report of result.pairs) {
  assert(report.observations.length > 0, `${report.id} produced no paragraph sidecars`);
  for (const observation of report.observations) {
    const actualKey = sidecarKey(observation.key);
    assert(!observedSidecars.has(actualKey), `Duplicate observed sidecar key: ${actualKey}`);
    observedSidecars.add(actualKey);
    const expected = expectedSidecars.get(actualKey);
    assert(expected, `Unexpected sidecar key: ${actualKey}`);
    const expectedKey = Object.fromEntries(requiredKeyFields.map((field) => [field, expected[field]]));
    if (expected.sourceSlice !== null) expectedKey.sourceSlice = expected.sourceSlice;
    assert.deepEqual(observation.key, expectedKey, `Sidecar key shape differs: ${actualKey}`);
    const resultSha256 = createHash("sha256").update(JSON.stringify([
      observation.before,
      observation.after,
      observation.actual,
      observation.match,
      observation.preservedAfterRevision,
    ])).digest("hex");
    assert.equal(resultSha256, expected.resultSha256, `Sidecar result differs for structural key: ${actualKey}`);

    const reconstructedBefore = observation.actual
      .filter((segment) => segment.type !== "added")
      .map((segment) => segment.text)
      .join("");
    const reconstructedAfter = observation.actual
      .filter((segment) => segment.type !== "deleted")
      .map((segment) => segment.text)
      .join("");
    assert.equal(reconstructedAfter, observation.after, `${actualKey} accept reconstruction failed`);
    if (expected.expectedResult === "match") {
      assert.equal(observation.match, true, `${actualKey} unexpectedly differs`);
      assert.equal(reconstructedBefore, observation.before, `${actualKey} reject reconstruction failed`);
      matchingSidecars += 1;
    } else {
      assert.equal(expected.expectedResult, "E1", `${actualKey} uses a non-E1 sidecar mismatch`);
      assert(exceptionReasons.get(expected.expectedResult)?.length > 20, `${actualKey} has no exception reason`);
      assert.equal(observation.match, false, `${actualKey} no longer exercises ${expected.expectedResult}`);
      assert.equal(observation.preservedAfterRevision, true, `${actualKey} does not preserve an after revision`);
      allowedSidecarMismatches += 1;
    }
  }
}
assert.equal(observedSidecars.size, expectedSidecars.size, "Expected sidecar key is missing");

for (const pair of contract.fixturePairs) {
  const report = reports.get(pair.pairId);
  assert(report, `Missing sidecar report for ${pair.pairId}`);
  assert(report.revisionCount >= 0);
  assert(report.packageParts.includes("[Content_Types].xml"));
  assert(report.packageParts.includes("word/document.xml"));
  assert.equal(report.commentsPreserved, true, `${pair.pairId} comments.xml changed`);
  assert.equal(report.acceptedTextMatchesAcceptedAfter, true, `${pair.pairId} accepted text differs from accepted after`);
  assert.equal(report.acceptedMatchesAcceptedAfter, true, `${pair.pairId} accepted package model differs from accepted after`);
  assert.equal(report.packageRejectRows.every((row) => row.match), true,
    `${pair.pairId} rejected package text differs: ${JSON.stringify(report.packageRejectRows.filter((row) => !row.match))}`);
  assert(report.packageRejectRows.length > 0, `${pair.pairId} has no final-package reject coverage`);
  for (const exception of pair.rejectTextExceptions ?? []) {
    assert.equal(exception.reasonId, "E1", `${pair.pairId} has an undeclared reject exception`);
    assert(exceptionReasons.get(exception.reasonId)?.length > 20, `${pair.pairId} reject exception has no reason`);
    assert(report.packageRejectRows.some((row) => row.storyPart === exception.storyPart
      && row.exceptionReasonId === exception.reasonId), `${pair.pairId} reject exception was not exercised`);
  }
}
const packageRejectStoryParts = contract.fixturePairs.reduce((sum, pair) => sum + reports.get(pair.pairId).packageRejectRows.length, 0);
const packageRejectStructuralRevisions = contract.fixturePairs.reduce((sum, pair) => sum
  + reports.get(pair.pairId).packageRejectRows.reduce((partSum, row) => partSum + row.targetStructuralRevisions, 0), 0);
assert.equal(packageRejectStoryParts, contract.packageReject.expectedStoryParts);
assert.equal(packageRejectStructuralRevisions, contract.packageReject.expectedStructuralRevisions);

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

const commentSpec = contract.commentFixture;
const multiparaSpec = contract.multiParagraphCellFixture;
const multiparaReport = reports.get(multiparaSpec.pairId);
const multiparaModels = models.get(multiparaSpec.pairId);
assert(multiparaReport && multiparaModels, `${multiparaSpec.fixtureId} was not executed`);
assert.equal(multiparaReport.commentsPreserved, true, `${commentSpec.preservedPackagePart} was not preserved from ${commentSpec.preservedFrom}`);
assert.deepEqual(multiparaReport.inputCellParagraphs, {
  before: [multiparaSpec.beforeParagraphs],
  after: [multiparaSpec.afterParagraphs],
});
assert.equal(multiparaReport.inputCellParagraphs.before.filter((paragraphs) => paragraphs.length > 1).length, 1);
assert.equal(multiparaReport.inputCellParagraphs.after.filter((paragraphs) => paragraphs.length > 1).length, 1);

const beforeAnchorComment = multiparaModels.before.blocks.flatMap((block) => block.comments ?? [])[0];
const afterAnchorComment = multiparaModels.after.blocks.flatMap((block) => block.comments ?? [])[0];
assert.deepEqual(
  { author: beforeAnchorComment?.author, text: beforeAnchorComment?.text },
  commentSpec.before,
  `${commentSpec.fixtureId} before comment fixture differs`,
);
assert.deepEqual(
  { author: afterAnchorComment?.author, text: afterAnchorComment?.text },
  commentSpec.after,
  `${commentSpec.fixtureId} after comment fixture differs`,
);

const beforeCellText = multiparaModels.before.blocks.find((block) => block.type === "table")?.table?.grid?.[0]?.[0]?.text;
const afterCellText = multiparaModels.after.blocks.find((block) => block.type === "table")?.table?.grid?.[0]?.[0]?.text;
assert.deepEqual({ before: beforeCellText, after: afterCellText }, multiparaSpec.webInput);
const multiparaWebResult = compareDocumentModels(
  "comments-multipara-before.docx",
  "comments-multipara-after.docx",
  multiparaModels.before,
  multiparaModels.after,
  { formatting: true, tables: true, metadata: true },
  "en",
);
const multiparaWebChanges = multiparaWebResult.changes
  .filter((change) => change.section === "table")
  .flatMap((change) => withCodePointOffsets(change.segments).filter((segment) => segment.type !== "equal"));
assert.deepEqual(multiparaWebChanges, multiparaSpec.webChanges, `${multiparaSpec.fixtureId} web exception changed`);

const generatorObservations = multiparaSpec.generatorInputs.map((expectedInput) => {
  const observation = multiparaReport.observations.find((item) => item.key.beforePath === expectedInput.beforePath
    && item.key.afterPath === expectedInput.afterPath);
  assert(observation, `${multiparaSpec.fixtureId} generator input is missing: ${expectedInput.beforePath}`);
  assert.deepEqual(
    { beforePath: observation.key.beforePath, afterPath: observation.key.afterPath, before: observation.before, after: observation.after },
    expectedInput,
  );
  return observation;
});
const generatorChanges = generatorObservations.flatMap((observation) => observation.actual.filter((segment) => segment.type !== "equal"));
assert.deepEqual(generatorChanges, multiparaSpec.generatorChanges, `${multiparaSpec.fixtureId} generator exception changed`);

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
  coreFixtureSidecars: contract.fixturePairs.reduce((sum, pair) => sum + reports.get(pair.pairId).observations.length, 0),
  sidecars: observedSidecars.size,
  matchingSidecars,
  expectedSidecarKeys: expectedSidecars.size,
  expectedSidecarResults: sidecarContract.resultSha256ByExpectation.length,
  allowedSidecarMismatches,
  packageRejectPairs: contract.fixturePairs.length,
  packageRejectStoryParts,
  packageRejectStructuralRevisions,
  exactPackageKeys: exactReport.packageRows.length,
  multiParagraphCellFixtures: multiparaReport.inputCellParagraphs.before.filter((paragraphs) => paragraphs.length > 1).length,
  commentFixturePreservedFrom: commentSpec.preservedFrom,
  offsetNegativeControlRejected: true,
  edgeCases: result.edges.length,
  exceptionIds: contract.exceptions.map((item) => `${item.reasonId}:${item.fixtureId}`),
}, null, 2));

function sidecarKey(value) {
  return JSON.stringify(requiredKeyFields.map((field) => value[field]).concat([value.sourceSlice ?? null]));
}

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
