import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPyodide } from "pyodide";
import { compareDocumentModels, diffText } from "../src/features/document-compare/documentComparison.ts";
globalThis.worklazyDiffJson = (a, b) => JSON.stringify(diffText(a, b));
const manifests = [];
globalThis.worklazyComparisonManifestJson = (a, b, formatting, tables, metadata) => {
  const result = compareDocumentModels("before", "after", JSON.parse(a), JSON.parse(b), { formatting, tables, metadata, trackedDocument: true }, "en");
  manifests.push(result.manifest); return JSON.stringify(result.manifest);
};
const py = await loadPyodide();
py.globals.set("WORKLAZY_FORMATTING_POLICY_JSON", fs.readFileSync("src/features/word-compare/formatting-policy.json", "utf8"));
for (const name of ["compare", "accept_revisions", "tracked_docx"]) py.runPython(fs.readFileSync(`src/features/word-compare/${name}.py`, "utf8"));
py.runPython(String.raw`
def run(text, properties):
    return '<w:r>' + ('<w:rPr>' + properties + '</w:rPr>' if properties else '') + '<w:t xml:space="preserve">' + text + '</w:t></w:r>'
def paragraph(runs, align='left'):
    return '<w:p><w:pPr><w:jc w:val="' + align + '"/></w:pPr>' + ''.join(run(text,properties) for text,properties in runs) + '</w:p>'
def package(path, body, header=None):
    with zipfile.ZipFile(path,'w') as archive:
        archive.writestr('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>')
        archive.writestr('word/document.xml','<w:document xmlns:w="' + WORD_NS + '"><w:body>' + body + '</w:body></w:document>')
        if header is not None: archive.writestr('word/header1.xml','<w:hdr xmlns:w="' + WORD_NS + '">' + header + '</w:hdr>')
def characters(path, reject, part='word/document.xml'):
    with zipfile.ZipFile(path) as archive: root=ET.fromstring(archive.read(part))
    result=[]
    def walk(node):
        if reject and node.tag==W+'ins' and node.get(W+'author')=='projection-test': return
        if node.tag==W+'tr' and node.find(W+'trPr/'+W+('ins' if reject else 'del')) is not None: return
        if not reject and node.tag==W+'del': return
        if node.tag==W+'r':
            properties=node.find(W+'rPr')
            signature=tuple(sorted((child.tag.rsplit('}',1)[-1], tuple(sorted(child.attrib.items()))) for child in properties if child.tag!=W+'rPrChange')) if properties is not None else ()
            for child in node:
                if child.tag in (W+'t',W+'delText'): result.extend((char,signature) for char in child.text or '')
            return
        if node.tag not in {W+'pPr',W+'rPr'}:
            for child in node: walk(child)
    walk(root);return result
B='<w:b/>';I='<w:i/>';U='<w:u w:val="single"/>'
checks=[]
for name,old,new,expected in [
    ('paired replacement',[('Old word',B)],[('New word',I)],[('Old word',I)]),
    ('cursor within revised run',[('Anchor gone tail',B)],[('Anchor ',B),('tail',I)],[('Anchor gone ',B),('tail',I)]),
    ('next revised run',[('Anchor gone tail',B)],[('Anchor',B),(' tail',I)],[('Anchor',B),(' gone tail',I)]),
    ('previous revised run',[('Anchor stable gone',B)],[('Anchor stable',I)],[('Anchor stable gone',I)]),
    ('revised default style',[('Old word',B)],[('New word','')],[('Old word','')]),
    ('unicode code-point projection',[('검토 old 😀 문장',B)],[('검토 new 😀 문장',I)],[('검토 old 😀 문장',I)]),
]:
    package('/before.docx',paragraph(old));package('/after.docx',paragraph(new,'right'))
    generate_tracked_document('/before.docx','/after.docx','/output.docx','projection-test',False,True,True)
    package('/expected.docx',paragraph(expected,'right'))
    assert characters('/output.docx',True)==characters('/expected.docx',False),(name,characters('/output.docx',True))
    assert characters('/output.docx',False)==characters('/after.docx',False),(name,'accept')
    with zipfile.ZipFile('/output.docx') as archive:
        root=ET.fromstring(archive.read('word/document.xml'))
        assert root.find('.//'+W+'pPr/'+W+'jc').get(W+'val')=='right'
        assert not root.findall('.//'+W+'rPrChange') and not root.findall('.//'+W+'pPrChange')
    checks.append(name)
# No revised counterpart: restore original formatting of the entire deleted paragraph.
package('/before.docx',paragraph([('Removed paragraph',B)])+paragraph([('Stable anchor','')]))
package('/after.docx',paragraph([('Stable anchor',I)],'right'))
generate_tracked_document('/before.docx','/after.docx','/output.docx','projection-test',False,True,True)
package('/expected.docx',paragraph([('Removed paragraph',B)])+paragraph([('Stable anchor',I)],'right'))
assert characters('/output.docx',True)==characters('/expected.docx',False)
checks.append('whole deleted paragraph keeps before')
# A header style must come from its paired header, not a body or neighboring paragraph.
package('/before.docx',paragraph([('Same body',B)]),paragraph([('Old header',B)]))
package('/after.docx',paragraph([('Same body',I)]),paragraph([('New header',U)],'right'))
generate_tracked_document('/before.docx','/after.docx','/output.docx','projection-test',False,True,True)
package('/expected.docx',paragraph([('Same body',I)]),paragraph([('Old header',U)],'right'))
assert characters('/output.docx',True,'word/header1.xml')==characters('/expected.docx',False,'word/header1.xml')
checks.append('paired header style source')
# Supported before formatting survives, unsupported formatting follows revised source.
old='<w:sz w:val="20"/><w:lang w:val="ko-KR"/>';new='<w:sz w:val="40"/><w:lang w:val="en-US"/>'
package('/before.docx',paragraph([('Old word',old)]));package('/after.docx',paragraph([('New word',new)]))
generate_tracked_document('/before.docx','/after.docx','/output.docx','projection-test',True,True,True)
with zipfile.ZipFile('/output.docx') as archive:
    root=ET.fromstring(archive.read('word/document.xml'));deleted=root.find('.//'+W+'del/'+W+'r/'+W+'rPr')
    assert deleted.find(W+'sz').get(W+'val')=='20' and deleted.find(W+'lang').get(W+'val')=='en-US'
checks.append('deleted supported-before unsupported-after')
# A moved paragraph has a paired counterpart, so excluded formatting still follows after.
package('/before.docx',paragraph([('Movable unique clause',B)])+paragraph([('First anchor unique','')])+paragraph([('Second anchor unique','')]))
package('/after.docx',paragraph([('First anchor unique','')])+paragraph([('Second anchor unique','')])+paragraph([('Movable unique clause',I)],'right'))
generate_tracked_document('/before.docx','/after.docx','/output.docx','projection-test',False,True,True)
package('/expected.docx',paragraph([('Movable unique clause',I)],'right')+paragraph([('First anchor unique','')])+paragraph([('Second anchor unique','')]))
assert characters('/output.docx',True)==characters('/expected.docx',False)
checks.append('moved paired paragraph style')
# Whole table moves use the declared paragraph/row/cell counterpart projections too.
def moving_table(style, width, height, fill, align):
    return '<w:tbl><w:tblPr><w:tblW w:type="dxa" w:w="'+width+'"/></w:tblPr><w:tr><w:trPr><w:trHeight w:val="'+height+'"/></w:trPr><w:tc><w:tcPr><w:shd w:fill="'+fill+'"/></w:tcPr>'+paragraph([('Movable table unique',style)],align)+'</w:tc></w:tr></w:tbl>'
for formatting in (False,True):
    old=moving_table(B,'1440','240','AAAAAA','left');new=moving_table(I,'2880','480','BBBBBB','right')
    anchors=paragraph([('First anchor unique','')])+paragraph([('Second anchor unique','')])
    package('/before.docx',old+anchors);package('/after.docx',anchors+new)
    generate_tracked_document('/before.docx','/after.docx','/output.docx','projection-test',formatting,True,True)
    expected=moving_table(B if formatting else I,'1440' if formatting else '2880','240' if formatting else '480','AAAAAA' if formatting else 'BBBBBB','left' if formatting else 'right')
    package('/expected.docx',expected+anchors)
    assert characters('/output.docx',True)==characters('/expected.docx',False),('table move',formatting)
    assert characters('/output.docx',False)==characters('/after.docx',False),('table move accept text/style',formatting)
    with zipfile.ZipFile('/output.docx') as archive:
        root=ET.fromstring(archive.read('word/document.xml'));table=root.find('.//'+W+'tbl')
        assert table.find(W+'tblPr/'+W+'tblW').get(W+'w')==('1440' if formatting else '2880')
        assert table.find(W+'tr/'+W+'trPr/'+W+'trHeight').get(W+'val')==('240' if formatting else '480')
        assert table.find(W+'tr/'+W+'tc/'+W+'tcPr/'+W+'shd').get(W+'fill')==('AAAAAA' if formatting else 'BBBBBB')
    checks.append('whole table paired properties '+str(formatting))
# Corruption is rejected rather than borrowing a source or reselecting style.
package('/before.docx',paragraph([('Movable unique clause',B)])+paragraph([('First anchor unique','')])+paragraph([('Second anchor unique','')]))
package('/after.docx',paragraph([('First anchor unique','')])+paragraph([('Second anchor unique','')])+paragraph([('Movable unique clause',I)],'right'))
a=extract_document_model(open('/before.docx','rb').read(),True,True,'en');b=extract_document_model(open('/after.docx','rb').read(),True,True,'en')
value=json.loads(worklazyComparisonManifestJson(a,b,False,True,True))
for mutation in ('missing-projection','wrong-source','missing-whole-projection'):
    corrupt=copy.deepcopy(value)
    decision=next(item for item in corrupt['decisions'] if item.get('moved'))
    if mutation=='missing-projection': decision['comparisons'][0]['restoreStyles']=[]
    if mutation=='wrong-source': decision['comparisons'][0]['restoreStyles'][0]['source']={'part':'word/header99.xml','path':[99]}
    if mutation=='missing-whole-projection': decision['wholeRestoreStyles']=[]
    try:
        generate_tracked_document('/before.docx','/after.docx','/bad.docx','projection-test',False,True,True,json.dumps(corrupt));raise AssertionError(mutation+' accepted')
    except ValueError as error: assert 'COMPARISON_MANIFEST' in str(error)
    checks.append(mutation)
`);
const checks = py.globals.get("checks").toJs();
assert.equal(checks.length, 15);
assert(manifests.some((manifest) => manifest.decisions.some((decision) => decision.deletedFormattingPolicy === "restore-before-unpaired")));
for (const manifest of manifests) for (const decision of manifest.decisions) if (decision.beforeText === "Anchor gone tail" && decision.afterText === "Anchor tail") assert.deepEqual(decision.textSegments, [{ type: "equal", text: "Anchor" }, { type: "deleted", text: " gone" }, { type: "equal", text: " tail" }]);
console.log(JSON.stringify({ checks: checks.length, nextPreviousDefaultAndWholeDeleted: true, sameParagraphAndStorySources: true, adversarialSourcesRejected: true }));
