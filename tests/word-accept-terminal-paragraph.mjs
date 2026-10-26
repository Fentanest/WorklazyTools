import fs from 'node:fs';
import { loadPyodide } from 'pyodide';
import {compareDocumentModels,diffText} from '../src/features/document-compare/documentComparison.ts';
globalThis.worklazyDiffJson=(a,b)=>JSON.stringify(diffText(a,b));
globalThis.worklazyComparisonManifestJson=(a,b,formatting,tables,metadata)=>JSON.stringify(compareDocumentModels('before','after',JSON.parse(a),JSON.parse(b),{formatting,tables,metadata},'en').manifest);
const py = await loadPyodide();
py.globals.set('WORKLAZY_FORMATTING_POLICY_JSON',fs.readFileSync('src/features/word-compare/formatting-policy.json','utf8'));
for(const name of ['compare','accept_revisions','tracked_docx'])py.runPython(fs.readFileSync(`src/features/word-compare/${name}.py`,'utf8'));
py.runPython(String.raw`
mark='<w:pPr><w:rPr><w:del w:id="1"/></w:rPr></w:pPr>'
deleted='<w:del w:id="2"><w:r><w:delText>Removed</w:delText></w:r></w:del>'
anchor='<w:p><w:r><w:t>Stable</w:t></w:r></w:p>'
def accepted(payload, tail='', container='body'):
    xml='<w:document xmlns:w="'+WORD_NS+'"><w:'+container+'>'+anchor+'<w:p>'+mark+payload+'</w:p>'+tail+'</w:'+container+'></w:document>'
    return ET.fromstring(_accept_xml(xml.encode())).find(W+container)
for tail in ['', '<w:sectPr/>', '<w:tbl><w:tr><w:tc><w:p/></w:tc></w:tr></w:tbl>']:
    result=accepted(deleted,tail)
    assert len(result.findall(W+'p'))==1
    assert ''.join(result.itertext())=='Stable'
# Protected content must retain a paragraph; no arbitrary empty-container cleanup.
protected=[
 '<w:bookmarkStart w:id="7" w:name="anchor"/>',
 '<w:commentRangeStart w:id="7"/>',
 '<w:permStart w:id="7"/>',
 '<w:r><w:drawing/></w:r>',
 '<w:r><w:t>Survives</w:t></w:r>',
 '<w:ins w:id="8"><w:r><w:t>Inserted history</w:t></w:r></w:ins>',
 '<w:del w:id="9"><w:r><w:commentReference w:id="7"/></w:r></w:del>',
 '<w:del w:id="9"><w:r><w:rPr><w:rPrChange w:id="10"><w:rPr/></w:rPrChange></w:rPr><w:delText>History</w:delText></w:r></w:del>',
]
for payload in protected:
    assert len(accepted(deleted+payload).findall(W+'p'))==2, payload
assert len(accepted('').findall(W+'p'))==2
assert len(accepted(deleted,container='tc').findall(W+'p'))==2
# Existing merge behavior for a following paragraph stays intact.
result=accepted(deleted,anchor)
assert len(result.findall(W+'p'))==2
assert ''.join(result.itertext())=='StableStable'
`);
py.runPython(String.raw`
for side,payload in [('before',anchor+'<w:p><w:r><w:t>Removed</w:t></w:r></w:p>'),('after',anchor)]:
    with zipfile.ZipFile('/'+side+'.docx','w') as z:
        z.writestr('word/document.xml','<w:document xmlns:w="'+WORD_NS+'"><w:body>'+payload+'<w:sectPr/></w:body></w:document>')
generate_tracked_document('/before.docx','/after.docx','/tracked.docx','codec-test',True,True,True)
accept_tracked_document('/tracked.docx','/accepted.docx')
with zipfile.ZipFile('/accepted.docx') as z,zipfile.ZipFile('/after.docx') as expected:
    assert ET.tostring(ET.fromstring(z.read('word/document.xml')))==ET.tostring(ET.fromstring(expected.read('word/document.xml')))
with zipfile.ZipFile('/tracked.docx') as z:
    root=ET.fromstring(z.read('word/document.xml'))
    for p in root.iter(W+'p'):
        _remove_paragraph_mark(p,'del')
        for deletion in list(p.findall(W+'del')):
            index=list(p).index(deletion);p.remove(deletion)
            for run in deletion:
                for text in run.findall(W+'delText'): text.tag=W+'t'
                p.insert(index,run);index+=1
    assert [(_local_name(p.tag),''.join(p.itertext())) for p in root.find(W+'body')]==[('p','Stable'),('p','Removed'),('sectPr','')]
`);
console.log('14 protected codec cases + exact generated accept/reject body structure passed');
