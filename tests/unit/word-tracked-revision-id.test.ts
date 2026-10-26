import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { loadPyodide } from "pyodide";

// _next_revision_id skips parts that certainly hold no revision element; every part form below must
// give the id the full parse gives (Astra R40: no false negatives, false positives only parse).
test("revision id scan skips only parts without revision markup", { timeout: 120_000 }, async () => {
  Object.assign(globalThis, { worklazyDiffJson: () => "[]", worklazyComparisonManifestJson: () => "{}" });
  const py = await loadPyodide();
  py.globals.set("WORKLAZY_FORMATTING_POLICY_JSON", fs.readFileSync("src/features/word-compare/formatting-policy.json", "utf8"));
  for (const name of ["compare", "accept_revisions", "tracked_docx"]) py.runPython(fs.readFileSync(`src/features/word-compare/${name}.py`, "utf8"));
  const result = py.runPython(String.raw`
import io, json, zipfile
NS = WORD_NS
def full_parse(*archives):
    maximum = 0
    for archive in archives:
        for name in archive.namelist():
            if not name.startswith("word/") or not name.endswith(".xml"):
                continue
            try:
                root = ET.fromstring(archive.read(name))
            except ET.ParseError:
                continue
            for element in root.iter():
                if element.tag not in TRACK_CHANGE_TAGS:
                    continue
                try:
                    maximum = max(maximum, int(element.get(W + "id", "0")))
                except ValueError:
                    continue
    return maximum + 1
def archive_of(part):
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w") as archive:
        archive.writestr("word/document.xml", part)
    return zipfile.ZipFile(io.BytesIO(buffer.getvalue()))
def body(inner, prefix="w"):
    colon = prefix + ":" if prefix else ""
    declaration = ' xmlns:' + prefix + '="' + NS + '"' if prefix else ' xmlns="' + NS + '"'
    return "<" + colon + "document" + declaration + "><" + colon + "body>" + inner + "</" + colon + "body></" + colon + "document>"
parts = {
    "plain": body('<w:p><w:r><w:t>text</w:t></w:r></w:p>').encode("utf-8"),
    "w prefix": body('<w:p><w:ins w:id="7" w:author="A"/></w:p>').encode("utf-8"),
    "default namespace": body('<p><del w:id="9" xmlns:w="' + NS + '"/></p>', prefix="").encode("utf-8"),
    "other prefix": body('<x:p><x:ins x:id="11"/></x:p>', prefix="x").encode("utf-8"),
    "non-ASCII prefix": body('<문:p><문:moveTo 문:id="13"/></문:p>', prefix="문").encode("utf-8"),
    "newline after name": body('<w:p><w:rPrChange\n w:id="15"/></w:p>').encode("utf-8"),
    "entity element": ('<!DOCTYPE d [<!ENTITY e "<w:ins xmlns:w=\'' + NS + '\' w:id=\'17\'/>">]>' + body('<w:p>&e;</w:p>')).encode("utf-8"),
    "comment and CDATA only": body('<w:p><!-- <w:ins w:id="99"/> --><w:r><w:t><![CDATA[<w:del w:id="98"/>]]></w:t></w:r></w:p>').encode("utf-8"),
    "UTF-16": ('<?xml version="1.0" encoding="UTF-16"?>' + body('<w:p><w:ins w:id="19"/></w:p>')).encode("utf-16"),
    "latin-1 declared": ('<?xml version="1.0" encoding="ISO-8859-1"?>' + body('<w:p><w:cellIns w:id="21"/></w:p>')).encode("latin-1"),
    "UTF-8 BOM": b"\xef\xbb\xbf" + body('<w:p><w:cellDel w:id="23"/></w:p>').encode("utf-8"),
    "malformed": b"<w:document><w:ins w:id='25'>",
    "malformed without markup": b"<w:document><w:p>",
}
outcome = {name: [full_parse(archive_of(part)), _next_revision_id(archive_of(part)), _without_revision_markup(part)] for name, part in parts.items()}
names = {tag.rsplit("}", 1)[1]: _without_revision_markup(body('<w:' + tag.rsplit("}", 1)[1] + ' w:id="1"/>').encode("utf-8")) for tag in TRACK_CHANGE_TAGS}
json.dumps({"outcome": outcome, "names": names})
`) as string;
  const { outcome, names } = JSON.parse(result);
  for (const [name, [full, scanned]] of Object.entries(outcome as Record<string, [number, number, boolean]>)) assert.equal(scanned, full, name);
  assert.equal(outcome["w prefix"][0], 8, "the full parse sees the revision");
  assert.equal(outcome["entity element"][2], false, "a document type declaration is always parsed");
  assert.equal(outcome.plain[2], true, "a part without markup is skipped");
  for (const [name, skipped] of Object.entries(names as Record<string, boolean>)) assert.equal(skipped, false, `${name} is never skipped`);
});
