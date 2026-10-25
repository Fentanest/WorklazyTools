import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { loadPyodide } from "pyodide";

// A batch keeps the model fields the tracked generator reads and puts them back once the two-model
// extraction cache has moved on; the restored entry must equal the extraction (shared facts shared
// again), serve only the generator, and never stand in for other bytes (plan step F/E).
test("saved tracked fields restore the generator's view of a model and nothing else", { timeout: 120_000 }, async () => {
  Object.assign(globalThis, { worklazyDiffJson: () => "[]", worklazyComparisonManifestJson: () => "{}" });
  const py = await loadPyodide();
  py.globals.set("WORKLAZY_FORMATTING_POLICY_JSON", fs.readFileSync("src/features/word-compare/formatting-policy.json", "utf8"));
  for (const name of ["compare", "accept_revisions", "tracked_docx"]) py.runPython(fs.readFileSync(`src/features/word-compare/${name}.py`, "utf8"));
  const result = py.runPython(String.raw`
import io, json, zipfile
def docx(text):
    body = "".join('<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>' + word + '</w:t></w:r><w:r><w:t> ' + word + '</w:t></w:r></w:p>' for word in text.split())
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("[Content_Types].xml", '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
        archive.writestr("word/document.xml", '<w:document xmlns:w="' + WORD_NS + '"><w:body>' + body + '</w:body></w:document>')
    return buffer.getvalue()
first, second = docx("alpha beta gamma beta"), docx("one two")
for name, data in (("/tmp/first.docx", first), ("/tmp/second.docx", second)):
    open(name, "wb").write(data)
extract_document_model_compact(first, True, True, "ko")
original = extract_document_model_parsed(first, True, True, "ko")
expected = json.dumps({key: original[key] for key in TRACKED_MODEL_FIELDS if key in original}, sort_keys=True)
packed = tracked_source_facts(first, True, True, "ko")
def shared(model):
    facts = [fact for ref in model["sourceInventory"] for fact in (ref.get("normalizedProperties") or {}).values()]
    return len(facts), len({id(fact) for fact in facts})
original_sharing = shared(original)
_EXTRACT_CACHE.clear()
other = restore_tracked_source_facts("/tmp/second.docx", True, True, "ko", packed)
options = restore_tracked_source_facts("/tmp/first.docx", False, True, "ko", packed)
restored = restore_tracked_source_facts("/tmp/first.docx", True, True, "ko", packed)
again = restore_tracked_source_facts("/tmp/first.docx", True, True, "ko", packed)
model = extract_document_model_parsed(first, True, True, "ko")
equal = json.dumps(model, sort_keys=True) == expected
kinds = [entry[3] for entry in _EXTRACT_CACHE]
# A full extraction request does not take the generator-only entry.
full = json.loads(extract_document_model(first, True, True, "ko"))
full_has_blocks = "blocks" in full and len(_EXTRACT_CACHE) == 2
# Keeping the tracked fields leaves the same inventory objects.
extract_document_model_compact(second, True, True, "ko")
inventory = extract_document_model_parsed(second, True, True, "ko")["sourceInventory"]
keep_tracked_source_facts()
kept = extract_document_model_parsed(second, True, True, "ko")
json.dumps({"other": other, "options": options, "restored": restored, "again": again, "equal": equal, "sharing": [original_sharing, shared(model)],
            "kinds": kinds, "fullHasBlocks": full_has_blocks, "keptSame": kept["sourceInventory"] is inventory, "keptKeys": sorted(kept), "allKept": [entry[3] for entry in _EXTRACT_CACHE]})
`) as string;
  const outcome = JSON.parse(result);
  assert.equal(outcome.other, false, "fields saved for other bytes are not restored");
  assert.equal(outcome.options, false, "fields saved for other options are not restored");
  assert.equal(outcome.restored, true);
  assert.equal(outcome.again, false, "an entry already cached is not replaced");
  assert.equal(outcome.equal, true, "the restored fields equal the extraction");
  assert.deepEqual(outcome.sharing[1], outcome.sharing[0], "shared property facts are shared again");
  assert.ok(outcome.sharing[0][0] > outcome.sharing[0][1], "the sample shares facts");
  assert.deepEqual(outcome.kinds, ["tracked"]);
  assert.equal(outcome.fullHasBlocks, true, "a full request extracts again beside the generator-only entry");
  assert.equal(outcome.keptSame, true);
  const trackedFields = ["fields", "noteFacts", "sourceInventory", "sourceRevision", "storyFacts"];
  assert.ok(outcome.keptKeys.every((key: string) => trackedFields.includes(key)), `only tracked fields are kept: ${outcome.keptKeys}`);
  assert.ok(["sourceInventory", "sourceRevision", "storyFacts"].every((key) => outcome.keptKeys.includes(key)), `the tracked fields stay: ${outcome.keptKeys}`);
  assert.deepEqual(outcome.allKept, ["tracked", "tracked"]);
});
