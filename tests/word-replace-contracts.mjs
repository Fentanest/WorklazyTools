import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPyodide } from "pyodide";
import { compareDocumentModels, diffText } from "../src/features/document-compare/documentComparison.ts";
import { serializeManifestForTracked } from "../src/features/document-compare/manifestWire.ts";

// Whole-block replacements ("original deleted + revision inserted") keep the run-by-run contracts:
// the revision's own history stays its author's, excluded formatting keeps the revised value on
// Reject, run positions skip existing deletions, and a changed even/odd header setting keeps the
// revised value instead of refusing the file. Built through the worker's manifest transport.
let mask = null;
globalThis.worklazyDiffJson = (before, after) => JSON.stringify(diffText(before, after));
globalThis.setReplaceMask = (value) => { mask = JSON.parse(value); };
globalThis.worklazyWireManifestJson = (before, after, formatting) => serializeManifestForTracked(compareDocumentModels("before", "after", JSON.parse(before), JSON.parse(after), { formatting, tables: true, metadata: true, formattingMask: mask ?? undefined }, "en").manifest);
globalThis.worklazyComparisonManifestJson = globalThis.worklazyWireManifestJson;
const py = await loadPyodide();
py.globals.set("WORKLAZY_FORMATTING_POLICY_JSON", fs.readFileSync("src/features/word-compare/formatting-policy.json", "utf8"));
for (const name of ["compare", "accept_revisions", "tracked_docx"]) py.runPython(fs.readFileSync(`src/features/word-compare/${name}.py`, "utf8"));
const checks = py.runPython(String.raw`
from js import setReplaceMask, worklazyWireManifestJson
GROUPS = ['fontFamily', 'size', 'style', 'color', 'paragraph', 'numbering']
def package(path, body, settings=''):
    with zipfile.ZipFile(path, 'w') as z:
        z.writestr('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>')
        z.writestr('word/document.xml', '<w:document xmlns:w="' + WORD_NS + '"><w:body>' + body + '<w:sectPr/></w:body></w:document>')
        z.writestr('word/settings.xml', '<w:settings xmlns:w="' + WORD_NS + '">' + settings + '</w:settings>')
def run(text, pr=''):
    return '<w:r>' + ('<w:rPr>' + pr + '</w:rPr>' if pr else '') + '<w:t xml:space="preserve">' + text + '</w:t></w:r>'
def para(content, pr=''):
    return '<w:p>' + ('<w:pPr>' + pr + '</w:pPr>' if pr else '') + content + '</w:p>'
def field(text, pr=''):
    return '<w:fldSimple w:instr="QUOTE value">' + run(text, pr) + '</w:fldSimple>'
def table(cells):
    return '<w:tbl><w:tblPr/><w:tblGrid>' + ''.join('<w:gridCol w:w="1000"/>' for _ in cells) + '</w:tblGrid><w:tr>' + ''.join('<w:tc>' + para(cell) + '</w:tc>' for cell in cells) + '</w:tr></w:tbl>'
def generate(before, after, settings_before='', settings_after='', formatting=True, selected=None):
    full = {key: True for key in GROUPS} if selected is None else {**{key: True for key in GROUPS}, **selected}
    setReplaceMask(json.dumps(full))
    package('/rc-before.docx', before, settings_before)
    package('/rc-after.docx', after, settings_after)
    a = extract_document_model(open('/rc-before.docx', 'rb').read(), True, True, 'en')
    b = extract_document_model(open('/rc-after.docx', 'rb').read(), True, True, 'en')
    manifest = worklazyWireManifestJson(a, b, formatting).replace(W, '\x01').encode('utf-8')
    generate_tracked_document('/rc-before.docx', '/rc-after.docx', '/rc-out.docx', 'Review', formatting, True, True, manifest, json.dumps(full))
    with zipfile.ZipFile('/rc-out.docx') as z:
        return ET.fromstring(z.read('word/document.xml')), z.read('word/settings.xml') if 'word/settings.xml' in z.namelist() else b''
def deleted(root):
    return [node for container in root.iter(W + 'del') for node in container.iter(W + 'r')]
checks = []
history = '<w:ins w:id="77" w:author="Original Author" w:date="2020-01-01T00:00:00Z">' + run(' history') + '</w:ins>'

# The revision's existing insertion stays its author's in a replaced field paragraph.
root, _ = generate(para(field('old')), para(field('new') + history))
own = [node for node in root.iter(W + 'ins') if node.get(W + 'author') == 'Original Author']
assert len(own) == 1 and own[0].get(W + 'id') == '77' and ''.join(own[0].itertext()) == ' history', ET.tostring(root)
assert not any(node.get(W + 'author') == 'Review' and ''.join(node.itertext()) == ' history' for node in root.iter(W + 'ins'))
checks.append('field replacement keeps revision history')

# Same in a replaced table (columns added): the revision's insertion inside a cell is kept.
root, _ = generate(table([run('a')]), table([run('a'), run('b') + history]))
assert [node.get(W + 'author') for node in root.iter(W + 'ins') if ''.join(node.itertext()) == ' history'] == ['Original Author'], ET.tostring(root)
checks.append('table replacement keeps revision history')

# Excluded color and alignment keep the revised value on Reject; with formatting off, too.
root, _ = generate(para(field('old', '<w:color w:val="FF0000"/>'), '<w:jc w:val="left"/>'), para(field('new', '<w:color w:val="0000FF"/>'), '<w:jc w:val="right"/>'), selected={'color': False, 'paragraph': False})
assert [node.get(W + 'val') for run_node in deleted(root) for node in run_node.iter(W + 'color')] == ['0000FF'], ET.tostring(root)
assert root.find('.//' + W + 'pPrChange') is None, ET.tostring(root)
checks.append('excluded families keep revised values in a replacement')
root, _ = generate(para(field('old', '<w:color w:val="FF0000"/>'), '<w:jc w:val="left"/>'), para(field('new', '<w:color w:val="0000FF"/>'), '<w:jc w:val="right"/>'))
assert [node.get(W + 'val') for run_node in deleted(root) for node in run_node.iter(W + 'color')] == ['FF0000'], ET.tostring(root)
assert [node.get(W + 'val') for node in root.findall('.//' + W + 'pPrChange/' + W + 'pPr/' + W + 'jc')] == ['left'], ET.tostring(root)
checks.append('included families restore the original in a replacement')
root, _ = generate(para(field('old', '<w:color w:val="FF0000"/>')), para(field('new', '<w:color w:val="0000FF"/>')), formatting=False)
assert [node.get(W + 'val') for run_node in deleted(root) for node in run_node.iter(W + 'color')] == ['0000FF'], ET.tostring(root)
checks.append('formatting off keeps revised formatting in a replacement')

# A deleted tab in an existing deletion does not shift the positions of the text after it.
earlier = '<w:del w:id="7" w:author="Earlier" w:date="2020-01-01T00:00:00Z"><w:r><w:tab/></w:r></w:del>'
root, _ = generate(para(earlier + run('same', '<w:b/>')), para(earlier + run('same', '<w:i/>')))
assert [''.join(node.itertext()) for node in root.iter(W + 'r') if node.find(W + 'rPr/' + W + 'rPrChange') is not None] == ['same'], ET.tostring(root)
checks.append('existing deletions add no run positions')

# A changed even/odd header setting keeps the revised value, both ways.
for before_settings, after_settings in (('', '<w:evenAndOddHeaders/>'), ('<w:evenAndOddHeaders/>', '')):
    root, settings = generate(para(run('Same')), para(run('Same changed')), before_settings, after_settings)
    assert (b'evenAndOddHeaders' in settings) == bool(after_settings), settings
checks.append('even/odd header setting keeps the revised value')
json.dumps(checks)
`);
const names = JSON.parse(checks);
assert.equal(names.length, 7);
console.log(JSON.stringify({ checks: names }));
