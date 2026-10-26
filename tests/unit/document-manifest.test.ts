import test from "node:test";
import assert from "node:assert/strict";
import { compareDocumentModels, diffText, type ComparisonModel } from "../../src/features/document-compare/documentComparison.ts";

const model = (version: string): ComparisonModel => ({
  blocks: [{ type: "paragraph", text: `Body ${version}`, format: "", location: "Body" }],
  headerFooter: [{ text: `Header ${version}`, format: "", location: "Header" }],
  notes: [{ text: `Note ${version}`, format: "", location: "Note" }],
  comments: [{ text: `Comment ${version}`, format: "", location: "Comment" }],
  warnings: [],
});

test("DOC and HWP source-less paragraphs retain their own section text decisions", () => {
  const result = compareDocumentModels("before", "after", model("original"), model("revised"), { formatting: true, tables: true, metadata: true }, "en");
  const sections = [result.views.document, result.views.headerFooter, result.views.note];
  for (const [index, prefix] of ["Body", "Header", "Note"].entries()) {
    assert.deepEqual(sections[index][0].segments, diffText(`${prefix} original`, `${prefix} revised`));
    assert.equal(sections[index][0].segments.filter((part) => part.type !== "added").map((part) => part.text).join(""), `${prefix} original`);
    assert.equal(sections[index][0].segments.filter((part) => part.type !== "deleted").map((part) => part.text).join(""), `${prefix} revised`);
  }
  const ids = result.manifest.decisions.map((decision) => decision.id);
  assert.equal(new Set(ids).size, ids.length);
});


test("worker output controls do not change the comparison scope schema", () => {
  const options = { formatting: true, tables: false, metadata: true, trackedDocument: true, revisionAuthor: "Reviewer", rewriteRevisionAuthor: false };
  const result = compareDocumentModels("before", "after", model("original"), model("revised"), options, "en");
  assert.deepEqual(result.manifest.options, { formatting: true, tables: false, metadata: true });
});
