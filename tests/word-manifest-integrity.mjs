import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPyodide } from "pyodide";
import { compareDocumentModels, diffText } from "../src/features/document-compare/documentComparison.ts";
import { serializeManifestForTracked } from "../src/features/document-compare/manifestWire.ts";
let diffCalls = 0;
globalThis.worklazyDiffJson = (before, after) => { diffCalls++; return JSON.stringify(diffText(before, after)); };
globalThis.worklazyComparisonManifestJson = (before, after, formatting, tables, metadata) => JSON.stringify(compareDocumentModels("before", "after", JSON.parse(before), JSON.parse(after), { formatting, tables, metadata }, "en").manifest);
// The worker's transport: inventories by reference, references and facts as stubs.
globalThis.worklazyWireManifestJson = (before, after, formatting, tables, metadata) => serializeManifestForTracked(compareDocumentModels("before", "after", JSON.parse(before), JSON.parse(after), { formatting, tables, metadata }, "en").manifest);
const py = await loadPyodide();
py.globals.set("WORKLAZY_FORMATTING_POLICY_JSON", fs.readFileSync("src/features/word-compare/formatting-policy.json", "utf8"));
for (const name of ["compare", "accept_revisions", "tracked_docx"]) py.runPython(fs.readFileSync(`src/features/word-compare/${name}.py`, "utf8"));
py.runPython(String.raw`
import copy

def para(text): return '<w:p><w:r><w:t>' + text + '</w:t></w:r></w:p>'
def package(path, body, notes=None):
    with zipfile.ZipFile(path, 'w') as archive:
        archive.writestr('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>')
        archive.writestr('word/document.xml', '<w:document xmlns:w="' + WORD_NS + '"><w:body>' + body + '</w:body></w:document>')
        if notes is not None:
            archive.writestr('word/footnotes.xml', '<w:footnotes xmlns:w="' + WORD_NS + '">' + notes + '</w:footnotes>')
def manifest():
    before = extract_document_model(open('/before.docx', 'rb').read(), True, True, 'en')
    after = extract_document_model(open('/after.docx', 'rb').read(), True, True, 'en')
    return json.loads(worklazyComparisonManifestJson(before, after, True, True, True))
def export(value):
    try:
        return generate_tracked_document('/before.docx', '/after.docx', '/out.docx', 'integrity', True, True, True, json.dumps(value))
    finally:
        assert _MANIFEST is None and _MANIFEST_NODE_KEYS == {} and _MANIFEST_DECISIONS == [] and _MANIFEST_CONSUMED == {}
def refused(name, value):
    try:
        export(value)
    except ValueError as error:
        assert 'COMPARISON_MANIFEST' in str(error) or 'UNSUPPORTED_TRACKED_SOURCE' in str(error), (name, str(error))
        scenarios.append(name)
        return
    raise AssertionError(name + ' was accepted')
def accepted_text(part='word/document.xml'):
    accept_tracked_document('/out.docx', '/accepted.docx')
    with zipfile.ZipFile('/accepted.docx') as archive:
        return ''.join(ET.fromstring(archive.read(part)).itertext())
def views(part='word/document.xml'):
    """(accepted text, rejected text, accepted drawings, rejected drawings, rejected image targets) of /out.docx."""
    with zipfile.ZipFile('/out.docx') as archive:
        root = ET.fromstring(archive.read(part))
        rels = {node.get('Id'): node.get('Target') for node in ET.fromstring(archive.read('word/_rels/document.xml.rels'))} if 'word/_rels/document.xml.rels' in archive.namelist() else {}
        media = {name: archive.read(name) for name in archive.namelist() if name.startswith('word/media/')}
    def collect(node, skip, found, inside=False):
        inside = inside or node.tag == W + skip
        if not inside:
            found.append(node)
        for child in node:
            collect(child, skip, found, inside)
        return found
    accepted, rejected = collect(root, 'del', []), collect(root, 'ins', [])
    text = lambda nodes: ''.join(node.text or '' for node in nodes if node.tag in (W + 't', W + 'delText'))
    blips = [node.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed') for node in rejected if node.tag.endswith('}blip')]
    return text(accepted), text(rejected), sum(node.tag == W + 'drawing' for node in accepted), sum(node.tag == W + 'drawing' for node in rejected), [media.get('word/' + rels.get(rid, '')) for rid in blips]
scenarios = []
package('/before.docx', para('Deleted unique paragraph') + para('Stable anchor'))
package('/after.docx', para('Stable anchor'))
original = manifest()
export(original)
assert accepted_text() == 'Stable anchor'
scenarios.append('valid deletion')
def document_xml():
    with zipfile.ZipFile('/out.docx') as archive:
        return re.sub(rb'w:date="[^"]*"', b'', archive.read('word/document.xml'))
inline_output = document_xml()
from js import worklazyWireManifestJson
wire = json.loads(worklazyWireManifestJson(extract_document_model(open('/before.docx', 'rb').read(), True, True, 'en'), extract_document_model(open('/after.docx', 'rb').read(), True, True, 'en'), True, True, True))
assert all(set(wire['sources'][side]) == {'$inventory'} for side in ('before', 'after')), wire['sources']
export(wire)
assert document_xml() == inline_output
scenarios.append('inventory by reference')
value = copy.deepcopy(wire); value['sources']['before']['$inventory'] += 1
refused('inventory reference count mismatch', value)
value = copy.deepcopy(original); value['decisions'] = [item for item in value['decisions'] if item['after']]
refused('missing deletion decision', value)
value = copy.deepcopy(original); value['decisions'].append(copy.deepcopy(value['decisions'][-1]))
refused('duplicate decision and ref', value)
value = copy.deepcopy(original); duplicate = copy.deepcopy(value['decisions'][-1]); duplicate['id'] = 'different-id-same-source'; value['decisions'].append(duplicate)
refused('duplicate source under unique ID', value)
value = copy.deepcopy(original); value['decisions'][-1]['before'].append({'part':'word/document.xml','path':[999,999]})
refused('unknown extra source', value)
value = copy.deepcopy(original); value['sources']['before'].append(copy.deepcopy(value['sources']['before'][0]))
refused('duplicate inventory source', value)
value = copy.deepcopy(original); value['coverage']['before'] = value['coverage']['before'][1:]
refused('missing coverage entry', value)
value = copy.deepcopy(original); value['decisions'][0]['textSegments'] = []
refused('corrupt text range', value)
value = copy.deepcopy(original); value['coverage']['before'][0]['disposition'] = 'preserve-after'
refused('forged preserve-after deletion', value)
package('/before.docx', '<w:p><w:r><w:drawing><w:testObject/></w:drawing></w:r></w:p>' + para('Stable anchor'))
package('/after.docx', para('Stable anchor'))
# Content the run-level path cannot carry is recorded whole: the original deleted (copied verbatim,
# objects included) and the revision inserted, exact on Accept All and Reject All.
export(manifest())
assert views() == ('Stable anchor', 'Stable anchor', 0, 1, []), views()
scenarios.append('deleted image-only paragraph recorded whole')
# Identical drawing identities do not make a delete/insert move lossless.
opaque = '<w:p><w:r><w:drawing><w:testObject/></w:drawing><w:t>Movable drawing paragraph</w:t></w:r></w:p>'
package('/before.docx', opaque + para('First anchor unique') + para('Second anchor unique'))
package('/after.docx', para('First anchor unique') + para('Second anchor unique') + opaque)
value = manifest()
assert any(item['moved'] for item in value['decisions'])
export(value)
assert views()[:4] == ('First anchor uniqueSecond anchor uniqueMovable drawing paragraph', 'Movable drawing paragraphFirst anchor uniqueSecond anchor unique', 1, 1), views()
scenarios.append('moved opaque paragraph recorded whole')
opaque_table = '<w:tbl><w:tr><w:tc>' + opaque + '</w:tc></w:tr></w:tbl>'
package('/before.docx', opaque_table); package('/after.docx', opaque_table)
value = manifest(); value['decisions'][0]['moved'] = True
export(value)
assert views()[:4] == ('Movable drawing paragraph', 'Movable drawing paragraph', 1, 1), views()
scenarios.append('opaque descendant of a moved table recorded whole')
# A stationary structural copy keeps the original drawing node intact.
package('/before.docx', opaque); package('/after.docx', opaque)
export(manifest())
with zipfile.ZipFile('/out.docx') as archive:
    assert len(ET.fromstring(archive.read('word/document.xml')).findall('.//' + W + 'drawing')) == 1
scenarios.append('unchanged opaque structural copy')
# Same relationship ID is not identity when the embedded resource bytes differ.
linked = '<w:p><w:r><w:drawing><a:blip xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:embed="rId1"/></w:drawing><w:t>Resource anchor</w:t></w:r></w:p>'
for path, media in (('/before.docx', b'original-resource'), ('/after.docx', b'revised-resource')):
    package(path, linked)
    with zipfile.ZipFile(path, 'a') as archive:
        archive.writestr('word/_rels/document.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image.png"/></Relationships>')
        archive.writestr('word/media/image.png', media)
# Recorded whole, the original image must be copied; this package declares no content type for it.
refused('same rId changed resource bytes without a content type', manifest())
# Even an equal object signature is unsafe when paragraph text is rebuilt.
package('/before.docx', opaque)
package('/after.docx', opaque.replace('Movable drawing paragraph', 'Revised drawing paragraph'))
export(manifest())
assert views()[:4] == ('Revised drawing paragraph', 'Movable drawing paragraph', 1, 1), views()
scenarios.append('changed text with unchanged opaque signature recorded whole')
# Only real comment source contexts may use the existing comment capability.
package('/before.docx', para('Stable anchor'))
package('/after.docx', para('Stable anchor'))
with zipfile.ZipFile('/before.docx', 'a') as archive:
    archive.writestr('word/header1.xml', '<w:hdr xmlns:w="' + WORD_NS + '">' + para('Before header unique') + '</w:hdr>')
value = manifest()
for item in value['decisions']:
    if any(ref['part'] == 'word/header1.xml' for ref in item['before']):
        item['trackedRepresentation'] = 'preserve-after'
        item['trackedReason'] = 'existing-comment-contract'
refused('forged header comment preservation', value)
# The real comment capability still preserves after bytes, including opaque/table content.
package('/before.docx', para('Stable anchor')); package('/after.docx', para('Stable anchor'))
for path, text_value in (('/before.docx', 'Original comment'), ('/after.docx', 'Revised comment')):
    with zipfile.ZipFile(path, 'a') as archive:
        archive.writestr('word/comments.xml', '<w:comments xmlns:w="' + WORD_NS + '"><w:comment w:id="1"><w:tbl><w:tr><w:tc>' + para(text_value) + opaque + '</w:tc></w:tr></w:tbl></w:comment></w:comments>')
export(manifest())
with zipfile.ZipFile('/out.docx') as output, zipfile.ZipFile('/after.docx') as after_archive:
    assert output.read('word/comments.xml') == after_archive.read('word/comments.xml')
scenarios.append('real comment opaque/table bytes preserved')
# Empty raw paragraphs remain explicitly covered instead of being labelled equal.
package('/before.docx', '<w:p/>' + para('Stable anchor'))
package('/after.docx', para('Stable anchor') + '<w:p/>')
value = manifest()
assert all(any(item['reason'] == 'blank-paragraph' for item in value['coverage'][side] if item['disposition'] == 'preserve-after') for side in ('before','after'))
export(value)
assert accepted_text() == 'Stable anchor'
scenarios.append('explicit blank-paragraph policy')
# Exact split slices belong to TS. No Python suffix/prefix correspondence remains.
assert '_tracked_common_suffix_length' not in globals()
package('/before.docx', para('Alpha clause Beta clause'))
package('/after.docx', para('Alpha clause ') + para('Beta clause'))
value = manifest(); split = next(item for item in value['decisions'] if len(item['after']) == 2)
assert split['splitSlices'] == [[0,13],[13,24]]
export(value)
assert accepted_text() == 'Alpha clause Beta clause'
scenarios.append('TS split source slices')
corrupt = copy.deepcopy(value); next(item for item in corrupt['decisions'] if len(item['after']) == 2)['splitSlices'][0][1] += 1
refused('corrupt split slices', corrupt)
# A valid axis owns every source index once, even when cells are empty.
table = '<w:tbl><w:tr><w:tc>' + para('Cell') + '</w:tc></w:tr></w:tbl>'
package('/before.docx', table); package('/after.docx', table)
value = manifest(); export(value); assert accepted_text() == 'Cell'
scenarios.append('valid table axis')
corrupt = copy.deepcopy(value); corrupt['decisions'][0]['rows'].append(copy.deepcopy(corrupt['decisions'][0]['rows'][0]))
refused('duplicate table axis', corrupt)
corrupt = copy.deepcopy(value); corrupt['decisions'][0]['columns'][0]['beforeIndex'] = 9
refused('out-of-range table axis', corrupt)
# Unreferenced notes whose numeric IDs swapped content are not displayed by Word; revised by ID,
# both views keep each ID's own text exactly.
old_notes = '<w:footnote w:id="1">' + para('First note unique') + '</w:footnote><w:footnote w:id="2">' + para('Second note unique') + '</w:footnote>'
new_notes = '<w:footnote w:id="1">' + para('Second note unique') + '</w:footnote><w:footnote w:id="2">' + para('First note unique') + '</w:footnote>'
package('/before.docx', para('Stable anchor'), old_notes); package('/after.docx', para('Stable anchor'), new_notes)
export(manifest())
def note_views():
    with zipfile.ZipFile('/out.docx') as archive:
        notes = ET.fromstring(archive.read('word/footnotes.xml'))
    def text(note, skip):
        found = []
        def visit(node, inside=False):
            inside = inside or node.tag == W + skip
            if not inside and node.tag in (W + 't', W + 'delText'):
                found.append(node.text or '')
            for child in node:
                visit(child, inside)
        visit(note)
        return ''.join(found)
    return {note.get(W + 'id'): (text(note, 'del'), text(note, 'ins')) for note in notes}
assert note_views() == {'1': ('Second note unique', 'First note unique'), '2': ('First note unique', 'Second note unique')}, note_views()
scenarios.append('unreferenced notes revised by ID')
# A before-only visible story is unsupported until package-reference support.
package('/after.docx', para('Stable anchor'))
refused('before-only footnote story', manifest())
`);
const scenarios = py.globals.get("scenarios").toJs();
assert.equal(scenarios.length, 27);
assert.equal(diffCalls, 0, "The emitter must not ask TypeScript to recompute a text diff");
console.log(JSON.stringify({ scenarios: scenarios.length, checks: scenarios }));
