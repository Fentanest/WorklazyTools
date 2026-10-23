import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPyodide } from "pyodide";
import { compareDocumentModels, diffText } from "../src/features/document-compare/documentComparison.ts";

const manifests = [];
globalThis.worklazyDiffJson = (before, after) => JSON.stringify(diffText(before, after));
globalThis.worklazyComparisonManifestJson = (before, after, formatting, tables, metadata) => {
  const result = compareDocumentModels("before", "after", JSON.parse(before), JSON.parse(after), { formatting, tables, metadata }, "en");
  manifests.push(result.manifest);
  assert(Object.isFrozen(result.manifest));
  assert(Object.isFrozen(result.manifest.decisions));
  for (const decision of result.manifest.decisions) {
    if (decision.type === "paragraph") {
      const view = result.views.document.find((view) => view.before === decision.beforeText && view.after === decision.afterText);
      if (view) assert.deepEqual(view.segments, decision.segments);
    }
  }
  return JSON.stringify(result.manifest);
};
const py = await loadPyodide();
py.globals.set("WORKLAZY_FORMATTING_POLICY_JSON", fs.readFileSync("src/features/word-compare/formatting-policy.json", "utf8"));
for (const name of ["compare", "accept_revisions", "tracked_docx"]) py.runPython(fs.readFileSync(`src/features/word-compare/${name}.py`, "utf8"));
py.runPython(String.raw`
def _fixture_paragraph(text, bold=False):
    return '<w:p><w:r>' + ('<w:rPr><w:b/></w:rPr>' if bold else '') + '<w:t>' + text + '</w:t></w:r></w:p>'

def _fixture_package(path, body, table, header):
    with zipfile.ZipFile(path, 'w') as archive:
        archive.writestr('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>')
        archive.writestr('word/document.xml', '<w:document xmlns:w="' + WORD_NS + '"><w:body>' + body + '<w:tbl><w:tr><w:tc>' + table + '</w:tc></w:tr></w:tbl></w:body></w:document>')
        archive.writestr('word/header1.xml', '<w:hdr xmlns:w="' + WORD_NS + '">' + header + '</w:hdr>')
        archive.writestr('word/footnotes.xml', '<w:footnotes xmlns:w="' + WORD_NS + '"><w:footnote w:id="1">' + header + '</w:footnote></w:footnotes>')

def _visible(node, reject=False):
    if node.tag in PROPERTY_CHANGE_TAGS or node.tag == W + 'pPr':
        return ''
    if reject and node.tag in (W + 'ins', W + 'moveTo'):
        return ''
    if not reject and node.tag in (W + 'del', W + 'moveFrom'):
        return ''
    if node.tag in (W + 't', W + 'delText'):
        return node.text or ''
    if node.tag == W + 'tab': return '\t'
    if node.tag in (W + 'br', W + 'cr'): return '\n'
    return ''.join(_visible(child, reject) for child in node)

def _story_text(path, part, reject=False):
    with zipfile.ZipFile(path) as archive:
        return _visible(ET.fromstring(archive.read(part)), reject)

checks = 0
for unchanged in (False, True):
    old_body = _fixture_paragraph('Original text', False)
    new_body = _fixture_paragraph('Revised text', True)
    old_table = _fixture_paragraph('Cell first ') + _fixture_paragraph('Cell second')
    new_table = old_table if unchanged else _fixture_paragraph('Cell first') + _fixture_paragraph('Cell updated')
    old_header = _fixture_paragraph('Header original')
    new_header = old_header if unchanged else _fixture_paragraph('Header revised')
    _fixture_package('/tmp/before.docx', old_body, old_table, old_header)
    _fixture_package('/tmp/after.docx', new_body, new_table, new_header)
    for formatting, tables, metadata in ((True, True, True), (False, True, True), (True, False, True), (True, True, False), (False, False, False)):
        generate_tracked_document('/tmp/before.docx', '/tmp/after.docx', '/tmp/output.docx', 'Manifest test', formatting, tables, metadata)
        accept_tracked_document('/tmp/output.docx', '/tmp/accepted.docx')
        for part in ('word/document.xml', 'word/header1.xml', 'word/footnotes.xml'):
            assert _story_text('/tmp/accepted.docx', part) == _story_text('/tmp/after.docx', part), ('accept', unchanged, formatting, tables, metadata, part)
            if part == 'word/document.xml':
                expected = 'Original text' + _visible(ET.fromstring('<root xmlns:w="' + WORD_NS + '">' + (old_table if tables else new_table) + '</root>'))
            else:
                expected = _story_text('/tmp/before.docx' if metadata else '/tmp/after.docx', part)
            assert _story_text('/tmp/output.docx', part, True) == expected, ('reject policy', unchanged, formatting, tables, metadata, part)
            checks += 2
        with zipfile.ZipFile('/tmp/output.docx') as archive:
            root = ET.fromstring(archive.read('word/document.xml'))
            has_format_revision = root.find('.//' + W + 'rPrChange') is not None
            assert has_format_revision == formatting, ('format scope', formatting)
            checks += 1

# Move decisions must produce both a rejectable source deletion and insertion.
_fixture_package('/tmp/before.docx', ''.join(_fixture_paragraph(t) for t in ['Movable unique clause', 'Anchor first clause', 'Anchor second clause']), _fixture_paragraph('same cell'), _fixture_paragraph('same header'))
_fixture_package('/tmp/after.docx', ''.join(_fixture_paragraph(t) for t in ['Anchor first clause', 'Anchor second clause', 'Movable unique clause']), _fixture_paragraph('same cell'), _fixture_paragraph('same header'))
generate_tracked_document('/tmp/before.docx', '/tmp/after.docx', '/tmp/output.docx', 'Manifest test', True, True, True)
assert _story_text('/tmp/output.docx', 'word/document.xml', True) == _story_text('/tmp/before.docx', 'word/document.xml')
accept_tracked_document('/tmp/output.docx', '/tmp/accepted.docx')
assert _story_text('/tmp/accepted.docx', 'word/document.xml') == _story_text('/tmp/after.docx', 'word/document.xml')
checks += 2

# Refuse stale snapshots rather than rebuilding a second comparison.
before_model = extract_document_model(open('/tmp/before.docx', 'rb').read(), True, True, 'en')
after_model = extract_document_model(open('/tmp/after.docx', 'rb').read(), True, True, 'en')
manifest = json.loads(worklazyComparisonManifestJson(before_model, after_model, True, True, True))
manifest['inputRevision']['before'] = 'stale'
try:
    generate_tracked_document('/tmp/before.docx', '/tmp/after.docx', '/tmp/output.docx', 'Manifest test', True, True, True, json.dumps(manifest))
    raise AssertionError('stale manifest accepted')
except ValueError as error:
    assert str(error) == 'STALE_COMPARISON_MANIFEST'
checks += 1
`);
assert.equal(py.globals.get("checks"), 73);
assert(manifests.some((manifest) => manifest.decisions.some((decision) => decision.moved)));
for (const manifest of manifests) {
  assert(manifest.sources.before.length > 0);
  assert(manifest.sources.after.length > 0);
  if (!manifest.options.formatting) assert.equal(manifest.exclusions.formatting, "preserve-after");
  if (!manifest.options.tables) assert(manifest.exclusions.tables.length > 0);
  if (!manifest.options.metadata) assert(manifest.exclusions.metadata.length > 0);
  for (const decision of manifest.decisions) {
    for (const side of ["before", "after"]) for (const ref of decision[side]) {
      assert(manifest.sources[side].some((source) => source.part === ref.part && JSON.stringify(source.path) === JSON.stringify(ref.path)));
    }
  }
}
console.log(JSON.stringify({ checks: 73, manifests: manifests.length, options: "changed and unchanged exclusions", staleManifestRejected: true, movedRejectReconstructed: true }));
