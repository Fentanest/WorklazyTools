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
# Existing opaque-field rebuild limit remains fail-closed until P.
# Simple field wrappers also carry opaque structure; changing their cache must
# fail closed until the output event codec supports it.
for side,value in [('before','Old'),('after','New')]:
    with zipfile.ZipFile('/simple-'+side+'.docx','w') as z:z.writestr('word/document.xml','<w:document xmlns:w="'+WORD_NS+'"><w:body><w:p><w:fldSimple w:instr="DOCPROPERTY Title"><w:r><w:t>'+value+'</w:t></w:r></w:fldSimple></w:p></w:body></w:document>')
try:
    generate_tracked_document('/simple-before.docx','/simple-after.docx','/unsafe.docx','field',False,True,True);raise AssertionError('simple field lost its wrapper')
except ValueError as e:assert 'UNSUPPORTED_TRACKED_SOURCE' in str(e)
worklazyComparisonManifestJson(a,b,False,True,True)
bad=json.loads(m);bad['fields']['before']=[]
try:
    generate_tracked_document('/before.docx','/after.docx','/bad.docx','field',False,True,True,json.dumps(bad));raise AssertionError('forged field annotation accepted')
except ValueError as e:assert 'COMPARISON_MANIFEST' in str(e)
`);
assert.equal(last.manifest.fields.before[0].cachedText,'1');assert.equal(last.manifest.fields.after[0].cachedText,'2');assert.ok(last.summary.changed+last.summary.added+last.summary.deleted>0);assert.ok(last.views.document.some(view=>view.before==='1'));assert.ok(last.views.document.some(view=>view.after==='2'));assert.ok(last.warnings.some(warning=>warning.includes('not recalculated')));
console.log('5 field families, split instruction source refs, preserved raw cached-text change and annotation forgery guard passed');
