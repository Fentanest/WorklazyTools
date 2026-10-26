import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPyodide } from "pyodide";
import { compareDocumentModels, diffText } from "../src/features/document-compare/documentComparison.ts";
import { serializeManifestForTracked } from "../src/features/document-compare/manifestWire.ts";

// D2: text inserted right before a footnote reference keeps the unchanged note paired (no
// deleted + added note on screen, no cloned note in the tracked file). D3: a table cell whose
// text is wholly replaced keeps one paragraph per cell after Accept All.
globalThis.worklazyDiffJson = (before, after) => JSON.stringify(diffText(before, after));
let screen = null;
globalThis.worklazyWireManifestJson = (before, after) => {
  const result = compareDocumentModels("before", "after", JSON.parse(before), JSON.parse(after), { formatting: true, tables: true, metadata: true }, "en");
  screen = result;
  return serializeManifestForTracked(result.manifest);
};
globalThis.worklazyComparisonManifestJson = globalThis.worklazyWireManifestJson;
globalThis.noteViewKinds = () => JSON.stringify(screen.views.note.map((view) => view.kind));
const py = await loadPyodide();
py.globals.set("WORKLAZY_FORMATTING_POLICY_JSON", fs.readFileSync("src/features/word-compare/formatting-policy.json", "utf8"));
for (const name of ["compare", "accept_revisions", "tracked_docx"]) py.runPython(fs.readFileSync(`src/features/word-compare/${name}.py`, "utf8"));
const checks = py.runPython(String.raw`
from js import worklazyWireManifestJson, noteViewKinds
R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
def run(text):
    return '<w:r><w:t xml:space="preserve">' + text + '</w:t></w:r>'
def package(path, body, notes=False):
    with zipfile.ZipFile(path, 'w') as z:
        types = '<Override PartName="/word/footnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml"/>' if notes else ''
        z.writestr('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' + types + '</Types>')
        if notes:
            z.writestr('word/_rels/document.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdFn" Type="' + R + '/footnotes" Target="footnotes.xml"/></Relationships>')
            z.writestr('word/footnotes.xml', '<w:footnotes xmlns:w="' + WORD_NS + '"><w:footnote w:type="separator" w:id="-1"><w:p><w:r><w:separator/></w:r></w:p></w:footnote><w:footnote w:type="continuationSeparator" w:id="0"><w:p><w:r><w:continuationSeparator/></w:r></w:p></w:footnote><w:footnote w:id="1"><w:p><w:r><w:footnoteRef/></w:r>' + run(' The same note text.') + '</w:p></w:footnote></w:footnotes>')
        z.writestr('word/document.xml', '<w:document xmlns:w="' + WORD_NS + '" xmlns:r="' + R + '"><w:body>' + body + '<w:sectPr/></w:body></w:document>')
def generate(before, after, notes=False):
    package('/na-before.docx', before, notes); package('/na-after.docx', after, notes)
    a = extract_document_model(open('/na-before.docx', 'rb').read(), True, True, 'en')
    b = extract_document_model(open('/na-after.docx', 'rb').read(), True, True, 'en')
    manifest = worklazyWireManifestJson(a, b).replace(W, '\x01').encode('utf-8')
    generate_tracked_document('/na-before.docx', '/na-after.docx', '/na-out.docx', 'Review', True, True, True, manifest)
def text_of(path, part='word/document.xml'):
    with zipfile.ZipFile(path) as z:
        return ''.join(node.text or '' for node in ET.fromstring(z.read(part)).iter(W + 't'))
checks = []
note = '<w:r><w:footnoteReference w:id="1"/></w:r>'
generate('<w:p>' + run('Text') + note + run(' after.') + '</w:p>', '<w:p>' + run('Text inserted') + note + run(' after.') + '</w:p>', notes=True)
assert json.loads(noteViewKinds()) == ['unchanged'], noteViewKinds()
with zipfile.ZipFile('/na-out.docx') as z:
    notes_xml = ET.fromstring(z.read('word/footnotes.xml'))
assert [n.get(W + 'id') for n in notes_xml.findall(W + 'footnote')] == ['-1', '0', '1'], ET.tostring(notes_xml)
accept_tracked_document('/na-out.docx', '/na-accepted.docx')
assert text_of('/na-accepted.docx') == 'Text inserted after.'
checks.append('insertion before a note reference keeps the note paired')
def cell(text):
    return '<w:tc><w:p>' + run(text) + '</w:p></w:tc>'
def table(cells):
    return '<w:tbl><w:tblPr/><w:tblGrid><w:gridCol w:w="2000"/><w:gridCol w:w="2000"/></w:tblGrid><w:tr>' + ''.join(cell(c) for c in cells) + '</w:tr></w:tbl>'
generate(table(['A', 'alpha']), table(['A', 'gamma']))
accept_tracked_document('/na-out.docx', '/na-accepted.docx')
with zipfile.ZipFile('/na-accepted.docx') as z:
    root = ET.fromstring(z.read('word/document.xml'))
assert [len(tc.findall(W + 'p')) for tc in root.iter(W + 'tc')] == [1, 1] and text_of('/na-accepted.docx') == 'Agamma', ET.tostring(root)
checks.append('a wholly replaced cell keeps one paragraph after Accept All')
json.dumps(checks)
`);
assert.equal(JSON.parse(checks).length, 2);
console.log(JSON.stringify({ checks: JSON.parse(checks) }));
