import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import { loadPyodide } from "pyodide";

// _serialize_xml encodes once instead of through ET's TextIOWrapper; the bytes must not change.
test("tracked part serialization keeps ET.tostring bytes", { timeout: 120_000 }, async () => {
  Object.assign(globalThis, { worklazyDiffJson: () => "[]", worklazyComparisonManifestJson: () => "{}" });
  const py = await loadPyodide();
  py.globals.set("WORKLAZY_FORMATTING_POLICY_JSON", fs.readFileSync("src/features/word-compare/formatting-policy.json", "utf8"));
  for (const name of ["compare", "accept_revisions", "tracked_docx"]) py.runPython(fs.readFileSync(`src/features/word-compare/${name}.py`, "utf8"));
  const result = py.runPython(String.raw`
import json
def reference(root):
    if root.tag in {PR+"Relationships",CT+"Types"}:ET.register_namespace("",root.tag[1:].split("}",1)[0])
    return ET.tostring(root, encoding="utf-8", xml_declaration=True)
document = _parse_xml(('<w:document xmlns:w="' + WORD_NS + '" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="w"><w:body>'
    '<w:p><w:r><w:t xml:space="preserve"> 한글 😀 &amp; &lt;tag&gt; "q" </w:t></w:r><w:r><w:br/></w:r></w:p></w:body></w:document>').encode("utf-8"))
run = document.find(".//" + W + "r")
run.find(W + "t").text = "lone \ud800 surrogate\r\nand tab\t"
run.set(W + "rsidR", 'quote " newline \n tab \t lt <')
run.find(W + "t").tail = "tail \udfff"
relationships = ET.fromstring('<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="t" Target="x.xml"/></Relationships>')
types = ET.fromstring('<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>')
json.dumps({name: _serialize_xml(root) == reference(root) for name, root in (("document", document), ("relationships", relationships), ("types", types))})
`) as string;
  assert.deepEqual(JSON.parse(result), { document: true, relationships: true, types: true });
});
