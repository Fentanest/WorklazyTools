import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPyodide } from "pyodide";
import { compareDocumentModels, diffText } from "../src/features/document-compare/documentComparison.ts";
let diffCalls = 0;
globalThis.worklazyDiffJson = (before, after) => { diffCalls++; return JSON.stringify(diffText(before, after)); };
globalThis.worklazyComparisonManifestJson = (before, after, formatting, tables, metadata) => JSON.stringify(compareDocumentModels("before", "after", JSON.parse(before), JSON.parse(after), { formatting, tables, metadata }, "en").manifest);
const py = await loadPyodide();
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
scenarios = []
package('/before.docx', para('Deleted unique paragraph') + para('Stable anchor'))
package('/after.docx', para('Stable anchor'))
original = manifest()
export(original)
assert accepted_text() == 'Stable anchor'
scenarios.append('valid deletion')
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
value = manifest()
assert any(item['disposition'] == 'unsupported' for item in value['coverage']['before'])
refused('deleted image-only paragraph', value)
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
# Reordered note containers cannot be silently paired by colliding numeric IDs.
old_notes = '<w:footnote w:id="1">' + para('First note unique') + '</w:footnote><w:footnote w:id="2">' + para('Second note unique') + '</w:footnote>'
new_notes = '<w:footnote w:id="1">' + para('Second note unique') + '</w:footnote><w:footnote w:id="2">' + para('First note unique') + '</w:footnote>'
package('/before.docx', para('Stable anchor'), old_notes); package('/after.docx', para('Stable anchor'), new_notes)
refused('reordered colliding note IDs', manifest())
# A before-only visible story is unsupported until package-reference support.
package('/after.docx', para('Stable anchor'))
refused('before-only footnote story', manifest())
`);
const scenarios = py.globals.get("scenarios").toJs();
assert.equal(scenarios.length, 18);
assert.equal(diffCalls, 0, "The emitter must not ask TypeScript to recompute a text diff");
console.log(JSON.stringify({ scenarios: scenarios.length, checks: scenarios }));
