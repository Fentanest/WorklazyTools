import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { loadPyodide } from "pyodide";

// Accepting existing revisions skips only parts that are certainly UTF-8 without revision markup;
// any other encoding or name form goes through the full accept path (Astra R31).
test("accept fast path keeps unmarked UTF-8 parts and still accepts UTF-16 and non-ASCII prefixes", { timeout: 120_000 }, async () => {
  // compare.py imports these bridge functions; accepting does not call them.
  Object.assign(globalThis, { worklazyDiffJson: () => "[]", worklazyComparisonManifestJson: () => "{}" });
  const py = await loadPyodide();
  py.globals.set("WORKLAZY_FORMATTING_POLICY_JSON", fs.readFileSync("src/features/word-compare/formatting-policy.json", "utf8"));
  for (const name of ["compare", "accept_revisions", "tracked_docx"]) py.runPython(fs.readFileSync(`src/features/word-compare/${name}.py`, "utf8"));
  const result = py.runPython(String.raw`
import io, json, zipfile
NS = WORD_NS
def package(document_bytes):
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("[Content_Types].xml", '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>')
        archive.writestr("word/document.xml", document_bytes)
    return buffer.getvalue()
def run(document_bytes):
    with open("/tmp/in.docx", "wb") as handle:
        handle.write(package(document_bytes))
    accept_tracked_document("/tmp/in.docx", "/tmp/out.docx")
    with zipfile.ZipFile("/tmp/out.docx") as archive:
        return archive.read("word/document.xml")
plain = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="' + NS + '"><w:body><w:p><w:r><w:t>Same</w:t></w:r></w:p></w:body></w:document>').encode("utf-8")
inserted = '<w:document xmlns:w="' + NS + '"><w:body><w:p><w:ins w:id="1" w:author="A"><w:r><w:t>New</w:t></w:r></w:ins></w:p></w:body></w:document>'
korean = '<문:document xmlns:문="' + NS + '"><문:body><문:p><문:ins 문:id="1" 문:author="A"><문:r><문:t>New</문:t></문:r></문:ins></문:p></문:body></문:document>'
utf16 = ('<?xml version="1.0" encoding="UTF-16"?>' + inserted).encode("utf-16")
def remaining(document_bytes):
    root = ET.fromstring(document_bytes)
    return [len(root.findall(".//" + W + "ins")), "".join(root.itertext())]
json.dumps({
    "plainKept": run(plain) == plain,
    "ascii": remaining(run(inserted.encode("utf-8"))),
    "korean": remaining(run(korean.encode("utf-8"))),
    "utf16": remaining(run(utf16)),
    "fullPathUtf16": remaining(_accept_xml(utf16)),
})
`) as string;
  const outcome = JSON.parse(result);
  assert.equal(outcome.plainKept, true, "an unmarked UTF-8 part is kept byte for byte");
  for (const key of ["ascii", "korean", "utf16", "fullPathUtf16"]) assert.deepEqual(outcome[key], [0, "New"], key);
});

// Astra R34/R35: other declared encodings, DOCTYPE entities and undecodable bytes never skip accepting.
test("accept fast path decides only for certain UTF-8 without declarations that could hide revisions", { timeout: 120_000 }, async () => {
  Object.assign(globalThis, { worklazyDiffJson: () => "[]", worklazyComparisonManifestJson: () => "{}" });
  const py = await loadPyodide();
  py.globals.set("WORKLAZY_FORMATTING_POLICY_JSON", fs.readFileSync("src/features/word-compare/formatting-policy.json", "utf8"));
  for (const name of ["compare", "accept_revisions", "tracked_docx"]) py.runPython(fs.readFileSync(`src/features/word-compare/${name}.py`, "utf8"));
  const result = py.runPython(String.raw`
import io, json, zipfile
NS = WORD_NS
plain_body = '<w:document xmlns:w="' + NS + '"><w:body><w:p><w:r><w:t>Same</w:t></w:r></w:p></w:body></w:document>'
def declared(encoding):
    return ('<?xml version="1.0" encoding="' + encoding + '" standalone="yes"?>' + plain_body).encode("ascii")
entity = ('<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE w:document [<!ENTITY rev "&#60;w:ins w:id=\'1\' w:author=\'A\'>&#60;w:r>&#60;w:t>New&#60;/w:t>&#60;/w:r>&#60;/w:ins>">]>'
          + '<w:document xmlns:w="' + NS + '"><w:body><w:p>&rev;</w:p></w:body></w:document>').encode("utf-8")
text_markup = ('<w:document xmlns:w="' + NS + '"><w:body><w:p><w:r><w:t>&lt;w:ins&gt; is text</w:t></w:r></w:p></w:body></w:document>').encode("utf-8")
decisions = {
    "iso-8859-1": _without_revision_markup(declared("ISO-8859-1")),
    "windows-1252": _without_revision_markup(declared("windows-1252")),
    "utf-8 declared": _without_revision_markup(declared("UTF-8")),
    "utf-8 bom": _without_revision_markup(b"\xef\xbb\xbf" + plain_body.encode("utf-8")),
    "nul": _without_revision_markup(plain_body.encode("utf-8") + b"\x00"),
    "invalid utf-8": _without_revision_markup(plain_body.encode("utf-8").replace(b"Same", b"S\xffme")),
    "doctype": _without_revision_markup(entity),
    "escaped text": _without_revision_markup(text_markup),
}
def package(document_bytes):
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("[Content_Types].xml", '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>')
        archive.writestr("word/document.xml", document_bytes)
    return buffer.getvalue()
with open("/tmp/entity.docx", "wb") as handle:
    handle.write(package(entity))
accept_tracked_document("/tmp/entity.docx", "/tmp/entity-out.docx")
with zipfile.ZipFile("/tmp/entity-out.docx") as archive:
    accepted = ET.fromstring(archive.read("word/document.xml"))
json.dumps({"decisions": decisions, "entity": [len(accepted.findall(".//" + W + "ins")), "".join(accepted.itertext())]})
`) as string;
  const outcome = JSON.parse(result);
  assert.deepEqual(outcome.decisions, { "iso-8859-1": false, "windows-1252": false, "utf-8 declared": true, "utf-8 bom": true, nul: false, "invalid utf-8": false, doctype: false, "escaped text": true });
  assert.deepEqual(outcome.entity, [0, "New"], "revisions expanded from an entity are accepted");
});
