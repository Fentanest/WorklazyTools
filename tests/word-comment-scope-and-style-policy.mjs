import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadPyodide} from 'pyodide';
import {compareDocumentModels,diffText} from '../src/features/document-compare/documentComparison.ts';
globalThis.worklazyDiffJson=(a,b)=>JSON.stringify(diffText(a,b));
globalThis.worklazyComparisonManifestJson=(a,b,formatting,tables,metadata)=>JSON.stringify(compareDocumentModels('before','after',JSON.parse(a),JSON.parse(b),{formatting,tables,metadata},'en').manifest);
const py=await loadPyodide();
py.globals.set('WORKLAZY_FORMATTING_POLICY_JSON',fs.readFileSync('src/features/word-compare/formatting-policy.json','utf8'));
for(const name of ['compare','accept_revisions','tracked_docx'])py.runPython(fs.readFileSync(`src/features/word-compare/${name}.py`,'utf8'));
py.runPython(String.raw`
for side,text in [('before','Old secret table'),('after','New secret table')]:
    p='<w:p><w:commentRangeStart w:id="1"/><w:r><w:t>Same body</w:t></w:r><w:commentRangeEnd w:id="1"/><w:r><w:commentReference w:id="1"/></w:r></w:p>'
    with zipfile.ZipFile('/'+side+'.docx','w') as z:
        z.writestr('word/document.xml','<w:document xmlns:w="'+WORD_NS+'"><w:body>'+p+'<w:tbl><w:tr><w:tc>'+p+'</w:tc></w:tr></w:tbl></w:body></w:document>')
        z.writestr('word/comments.xml','<w:comments xmlns:w="'+WORD_NS+'"><w:comment w:id="1" w:author="Author"><w:p><w:r><w:t>Same comment</w:t></w:r></w:p><w:tbl><w:tr><w:tc><w:sdt><w:sdtContent><w:p><w:r><w:t>'+text+'</w:t></w:r></w:p></w:sdtContent></w:sdt></w:tc></w:tr></w:tbl></w:comment></w:comments>')
a=extract_document_model(open('/before.docx','rb').read(),True,True,'en');b=extract_document_model(open('/after.docx','rb').read(),True,True,'en')
`);
const before=JSON.parse(py.globals.get('a')),after=JSON.parse(py.globals.get('b'));
const original=JSON.stringify([before,after]);
for(const metadata of [false,true])for(const tables of [false,true]){
 const result=compareDocumentModels('before','after',before,after,{formatting:false,tables,metadata},'en');
 const body=result.views.document.find(view=>view.section==='body');
 const expected=metadata ? tables ? 'Same comment\nNew secret table' : 'Same comment' : undefined;
 assert.equal(body.comments.length,metadata?1:0);
 if(metadata)assert.equal(body.comments[0].after,expected);
 assert.equal(body.kind,metadata&&tables?'comment':'unchanged');
 if(tables){const cell=result.tables[0].after[0][0];assert.equal(cell.comments.length,metadata?1:0);if(metadata)assert.equal(cell.comments[0].text,expected);}
 assert.equal(JSON.stringify([before,after]),original,'all raw extraction records must remain immutable');
 py.globals.set('manifest',JSON.stringify(result.manifest));py.globals.set('tables_enabled',tables);py.globals.set('metadata_enabled',metadata);
 py.runPython(String.raw`
generate_tracked_document('/before.docx','/after.docx','/out.docx','scope',False,tables_enabled,metadata_enabled,manifest)
with zipfile.ZipFile('/out.docx') as out,zipfile.ZipFile('/after.docx') as revised:
    assert out.read('word/comments.xml')==revised.read('word/comments.xml')
if metadata_enabled and tables_enabled:
    baseline=json.loads(manifest)
    for field in ('wholeRestoreStyles','deletedFormattingPolicy','sourceSlices','restoreStyles'):
        bad=copy.deepcopy(baseline);d=next(d for d in bad['decisions'] if d.get('trackedRepresentation')=='preserve-after')
        if field in ('sourceSlices','restoreStyles'): d['comparisons'][0][field]=[]
        else: d[field]=[]
        try:
            generate_tracked_document('/before.docx','/after.docx','/bad.docx','scope',False,True,True,json.dumps(bad));raise AssertionError((field,'nonrevision accepted'))
        except ValueError as e:assert 'COMPARISON_MANIFEST' in str(e)
`);
}
py.runPython(String.raw`
def paragraph(text,size): return '<w:p><w:r><w:rPr><w:sz w:val="'+str(size)+'"/></w:rPr><w:t>'+text+'</w:t></w:r></w:p>'
for side,body in [('before',paragraph('Removed unique paragraph',20)+paragraph('Stable anchor',40)),('after',paragraph('Stable anchor',40)+paragraph('New inserted unique paragraph',50))]:
    with zipfile.ZipFile('/'+side+'.docx','w') as z:z.writestr('word/document.xml','<w:document xmlns:w="'+WORD_NS+'"><w:body>'+body+'</w:body></w:document>')
a=extract_document_model(open('/before.docx','rb').read(),True,True,'en');b=extract_document_model(open('/after.docx','rb').read(),True,True,'en')
m=json.loads(worklazyComparisonManifestJson(a,b,False,True,True))
unpaired=next(d for d in m['decisions'] if not d['after']);inserted=next(d for d in m['decisions'] if not d['before'])
assert unpaired['deletedFormattingPolicy']=='restore-before-unpaired'
assert 'wholeRestoreStyles' not in unpaired and all('sourceSlices' not in c and 'restoreStyles' not in c for c in unpaired['comparisons'])
generate_tracked_document('/before.docx','/after.docx','/good.docx','style',False,True,True,json.dumps(m))
with zipfile.ZipFile('/good.docx') as z:
    root=ET.fromstring(z.read('word/document.xml'));assert root.find('.//'+W+'del/'+W+'r/'+W+'rPr/'+W+'sz').get(W+'val')=='20'
run=next(r for r in m['sources']['after'] if r['kind']=='r');p=next(r for r in m['sources']['after'] if r['kind']=='p')
for target in ('unpaired','inserted'):
    for field in ('wholeRestoreStyles','sourceSlices','restoreStyles','deletedFormattingPolicy'):
        if target=='unpaired' and field=='deletedFormattingPolicy':continue
        bad=copy.deepcopy(m);d=next(d for d in bad['decisions'] if not d['after']) if target=='unpaired' else next(d for d in bad['decisions'] if not d['before'])
        if field=='wholeRestoreStyles':d[field]=[{'before':unpaired['before'][0],'afterParagraph':p,'projections':[{'beforeStart':0,'afterStart':0,'length':len(unpaired['beforeText']),'kind':'deleted','policy':'copy-revised-run','source':run}]}]
        elif field=='deletedFormattingPolicy':d[field]='paired-revised'
        else:d['comparisons'][0][field]=[]
        try:
            generate_tracked_document('/before.docx','/after.docx','/bad.docx','style',False,True,True,json.dumps(bad));raise AssertionError((target,field,'accepted'))
        except ValueError as e:assert 'COMPARISON_MANIFEST' in str(e)
`);
py.runPython(String.raw`
for field,location in [('wholeRestoreStyles','decision'),('sourceSlices','comparison'),('restoreStyles','comparison'),('deletedFormattingPolicy','decision')]:
    bad=copy.deepcopy(m)
    # Wrong-location fields are invalid even when their value is empty.
    d=next(d for d in bad['decisions'] if not d['after'])
    if field in ('wholeRestoreStyles','deletedFormattingPolicy'):d['comparisons'][0][field]=[]
    else:d[field]=[]
    try:
        generate_tracked_document('/before.docx','/after.docx','/bad.docx','style',False,True,True,json.dumps(bad));raise AssertionError((field,'wrong location accepted'))
    except ValueError as e:assert 'COMPARISON_MANIFEST' in str(e)
`);
console.log('4 anchored body/cell scope combinations immutable + raw E4 package;15 forbidden fields rejected; unpaired deleted style20 preserved');
