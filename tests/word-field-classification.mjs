import assert from 'node:assert/strict';import fs from 'node:fs';import {loadPyodide} from 'pyodide';
import {compareDocumentModels,diffText} from '../src/features/document-compare/documentComparison.ts';
let last;globalThis.worklazyDiffJson=(a,b)=>JSON.stringify(diffText(a,b));globalThis.worklazyComparisonManifestJson=(a,b,formatting,tables,metadata)=>{last=compareDocumentModels('before','after',JSON.parse(a),JSON.parse(b),{formatting,tables,metadata},'en');return JSON.stringify(last.manifest)};
const py=await loadPyodide();py.globals.set('WORKLAZY_FORMATTING_POLICY_JSON',fs.readFileSync('src/features/word-compare/formatting-policy.json','utf8'));
for(const name of ['compare','accept_revisions','tracked_docx'])py.runPython(fs.readFileSync(`src/features/word-compare/${name}.py`,'utf8'));
py.runPython(String.raw`
for side,page in [('before','1'),('after','2')]:
    complex='<w:p><w:r><w:fldChar w:fldCharType="begin"/></w:r><w:r><w:instrText> PA</w:instrText></w:r><w:r><w:instrText>GE </w:instrText></w:r><w:r><w:fldChar w:fldCharType="separate"/></w:r><w:r><w:t>'+page+'</w:t></w:r><w:r><w:fldChar w:fldCharType="end"/></w:r></w:p>'
    simple=''.join('<w:p><w:fldSimple w:instr="'+code+'"><w:r><w:t>'+value+'</w:t></w:r></w:fldSimple></w:p>' for code,value in [('DATE','2026-10-24'),('TOC','Chapter 1'),('DOCPROPERTY Title','Report'),('UNKNOWN','Kept')])
    with zipfile.ZipFile('/'+side+'.docx','w') as z:z.writestr('word/document.xml','<w:document xmlns:w="'+WORD_NS+'"><w:body>'+complex+simple+'</w:body></w:document>')
a=extract_document_model(open('/before.docx','rb').read(),True,True,'en');b=extract_document_model(open('/after.docx','rb').read(),True,True,'en')
model=json.loads(a);assert [field['kind'] for field in model['fields']]==['pagination','automatic-date','table-of-contents','value','other'];assert model['fields'][0]['instruction']==' PAGE ';assert model['fields'][0]['cachedText']=='1';assert len(model['fields'][0]['sources'])==3
with zipfile.ZipFile('/strict.docx','w') as z:z.writestr('word/document.xml','<w:document xmlns:w="http://purl.oclc.org/ooxml/wordprocessingml/main"><w:body><w:p><w:r><w:t>Must not appear empty</w:t></w:r></w:p></w:body></w:document>')
try:
    extract_document_model(open('/strict.docx','rb').read(),True,True,'en');raise AssertionError('unsupported namespace appeared empty')
except ValueError as e:assert 'not supported' in str(e)
m=worklazyComparisonManifestJson(a,b,False,True,True)
# This checkpoint annotates fields without changing their cached-text decisions.
# A changed simple-field cache cannot be revised run by run inside the wrapper, so the
# paragraph is recorded whole: the original deleted and the revision inserted, each
# keeping its own field wrapper, so Accept All and Reject All both keep the field.
for side,value in [('before','Old'),('after','New')]:
    with zipfile.ZipFile('/simple-'+side+'.docx','w') as z:z.writestr('word/document.xml','<w:document xmlns:w="'+WORD_NS+'"><w:body><w:p><w:fldSimple w:instr="DOCPROPERTY Title"><w:r><w:t>'+value+'</w:t></w:r></w:fldSimple></w:p></w:body></w:document>')
generate_tracked_document('/simple-before.docx','/simple-after.docx','/simple-tracked.docx','field',False,True,True)
with zipfile.ZipFile('/simple-tracked.docx') as z:tracked=ET.fromstring(z.read('word/document.xml'))
fields=tracked.findall('.//'+W+'fldSimple')
assert [field.get(W+'instr') for field in fields]==['DOCPROPERTY Title','DOCPROPERTY Title'],'simple field lost its wrapper'
marked={('del' if field.find(W+'del') is not None else 'ins' if field.find(W+'ins') is not None else None):''.join(node.text or '' for node in field.iter() if node.tag in (W+'t',W+'delText')) for field in fields}
assert marked=={'del':'Old','ins':'New'},marked
assert all(field.find('.//'+W+'t') is None for field in fields if field.find(W+'del') is not None)
accept_tracked_document('/simple-tracked.docx','/simple-accepted.docx')
with zipfile.ZipFile('/simple-accepted.docx') as z:accepted=ET.fromstring(z.read('word/document.xml'))
assert [''.join(node.text or '' for node in field.iter(W+'t')) for field in accepted.findall('.//'+W+'fldSimple')]==['New']
# Unchanged fields may partition equivalent per-character formatting into
# different runs. Preserve the revised wrapper without rejecting that copy.
for side,runs in [('before','<w:r><w:t>Field</w:t></w:r><w:r><w:t xml:space="preserve"> result</w:t></w:r>'),('after','<w:r><w:t>Field result</w:t></w:r>')]:
    with zipfile.ZipFile('/copy-'+side+'.docx','w') as z:z.writestr('word/document.xml','<w:document xmlns:w="'+WORD_NS+'"><w:body><w:p><w:fldSimple w:instr=" DATE ">'+runs+'</w:fldSimple></w:p></w:body></w:document>')
generate_tracked_document('/copy-before.docx','/copy-after.docx','/copy.docx','field',False,True,True)
with zipfile.ZipFile('/copy.docx') as out,zipfile.ZipFile('/copy-after.docx') as revised:
    assert ET.tostring(ET.fromstring(out.read('word/document.xml')))==ET.tostring(ET.fromstring(revised.read('word/document.xml')))
worklazyComparisonManifestJson(a,b,False,True,True)
bad=json.loads(m);bad['fields']['before']=[]
try:
    generate_tracked_document('/before.docx','/after.docx','/bad.docx','field',False,True,True,json.dumps(bad));raise AssertionError('forged field annotation accepted')
except ValueError as e:assert 'COMPARISON_MANIFEST' in str(e)
`);
assert.equal(last.manifest.fields.before[0].cachedText,'1');assert.equal(last.manifest.fields.after[0].cachedText,'2');assert.ok(last.summary.changed+last.summary.added+last.summary.deleted>0);assert.ok(last.views.document.some(view=>view.before==='1'));assert.ok(last.views.document.some(view=>view.after==='2'));assert.ok(last.warnings.some(warning=>warning.includes('not recalculated')));
console.log('5 field families, split instruction source refs, preserved raw cached-text change and annotation forgery guard passed');
