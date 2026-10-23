import assert from 'node:assert/strict';import fs from 'node:fs';import {loadPyodide} from 'pyodide';
import {compareDocumentModels,diffText} from '../src/features/document-compare/documentComparison.ts';
import {defaultFormattingMask} from '../src/features/document-compare/formattingMask.ts';
let requested={...defaultFormattingMask},last;
globalThis.worklazyDiffJson=(a,b)=>JSON.stringify(diffText(a,b));
globalThis.worklazyComparisonManifestJson=(a,b,formatting,tables,metadata)=>{last=compareDocumentModels('before','after',JSON.parse(a),JSON.parse(b),{formatting,tables,metadata,formattingMask:requested},'en');return JSON.stringify(last.manifest)};
const py=await loadPyodide();py.globals.set('WORKLAZY_FORMATTING_POLICY_JSON',fs.readFileSync('src/features/word-compare/formatting-policy.json','utf8'));
for(const name of ['compare','accept_revisions','tracked_docx'])py.runPython(fs.readFileSync(`src/features/word-compare/${name}.py`,'utf8'));
const cases=[['fontFamily','rPr','rFonts','ascii','Arial','Calibri'],['size','rPr','sz','val','20','40'],['style','rPr','b','val','0','1'],['color','rPr','color','val','FF0000','0000FF'],['paragraph','pPr','jc','val','left','right'],['numbering','sectPr','pgNumType','start','1','5']];
for(const [group,property,name,attribute,old,next] of cases){
 py.globals.set('property',property);py.globals.set('name',name);py.globals.set('attribute',attribute);py.globals.set('old',old);py.globals.set('new',next);
 py.runPython(String.raw`
for side,value in [('before',old),('after',new)]:
    prop='<w:'+property+'><w:'+name+' w:'+attribute+'="'+value+'"/></w:'+property+'>'
    p='<w:p>'+(prop if property=='pPr' else '')+'<w:r>'+(prop if property=='rPr' else '')+'<w:t>Same sample</w:t></w:r></w:p>'
    with zipfile.ZipFile('/'+side+'.docx','w') as z:z.writestr('word/document.xml','<w:document xmlns:w="'+WORD_NS+'"><w:body>'+p+(prop if property=='sectPr' else '')+'</w:body></w:document>')
`);
 for(const [formatting,enabled] of [[true,false],[false,false],[false,true],[true,true]]){
  requested={...defaultFormattingMask,[group]:enabled};py.globals.set('requested_json',JSON.stringify(requested));py.globals.set('enabled_formatting',formatting);py.globals.set('expect_change',formatting&&enabled);
  py.runPython(String.raw`
a=extract_document_model(open('/before.docx','rb').read(),True,True,'en');b=extract_document_model(open('/after.docx','rb').read(),True,True,'en')
m=worklazyComparisonManifestJson(a,b,enabled_formatting,True,True)
generate_tracked_document('/before.docx','/after.docx','/out.docx','mask',enabled_formatting,True,True,m,requested_json)
with zipfile.ZipFile('/out.docx') as z:
    root=ET.fromstring(z.read('word/document.xml'));change=root.find('.//'+W+property+'Change')
    assert (change is not None)==expect_change,(property,ET.tostring(root))
    assert root.find('.//'+W+property+'/'+W+name).get(W+attribute)==new
    if expect_change:assert change.find(W+property+'/'+W+name).get(W+attribute)==old
# Mask binding is independent of the three boolean scope flags.
try:
    generate_tracked_document('/before.docx','/after.docx','/bad.docx','mask',enabled_formatting,True,True,m,json.dumps({**json.loads(requested_json),'size':not json.loads(requested_json)['size']}));raise AssertionError('mask binding accepted')
except ValueError as e:assert 'FORMATTING_MASK' in str(e)
`);
  assert.deepEqual(last.manifest.options,{formatting,tables:true,metadata:true});assert.equal(last.manifest.formattingMask.requested[group],enabled);assert.equal(last.manifest.formattingMask.effective[group],formatting&&enabled);
  assert.equal(last.summary.format>0,formatting&&enabled,group);
 }
}
console.log('24 mask off/master off/re-enable property projections +24 stale mask bindings passed');
requested={...defaultFormattingMask,size:false};py.globals.set('requested_json',JSON.stringify(requested));
py.runPython(String.raw`
def masked_paragraph(text,font,size):return '<w:p><w:r><w:rPr><w:rFonts w:ascii="'+font+'"/><w:sz w:val="'+size+'"/></w:rPr><w:t>'+text+'</w:t></w:r></w:p>'
for table in (False,True):
    for side,font,size in [('before','Arial','20'),('after','Calibri','40')]:
        body=masked_paragraph('Same sample' if table else ('Old clause' if side=='before' else 'New clause'),font,size)
        if table:body='<w:tbl><w:tr><w:tc>'+body+'</w:tc></w:tr></w:tbl>'
        with zipfile.ZipFile('/'+side+'.docx','w') as z:z.writestr('word/document.xml','<w:document xmlns:w="'+WORD_NS+'"><w:body>'+body+'</w:body></w:document>')
    a=extract_document_model(open('/before.docx','rb').read(),True,True,'en');b=extract_document_model(open('/after.docx','rb').read(),True,True,'en');m=worklazyComparisonManifestJson(a,b,True,True,True)
    generate_tracked_document('/before.docx','/after.docx','/out.docx','mask',True,True,True,m,requested_json)
    with zipfile.ZipFile('/out.docx') as z:
        root=ET.fromstring(z.read('word/document.xml'))
        if table:
            old=root.find('.//'+W+'rPrChange/'+W+'rPr');assert old.find(W+'rFonts').get(W+'ascii')=='Arial';assert old.find(W+'sz').get(W+'val')=='40'
        else:
            deleted=root.find('.//'+W+'del/'+W+'r/'+W+'rPr');assert deleted.find(W+'rFonts').get(W+'ascii')=='Arial';assert deleted.find(W+'sz').get(W+'val')=='40'
`);
assert.equal(last.tables[0].kind,'changed');assert.equal(last.tables[0].beforeKinds[0][0],'format');
assert.ok(last.views.document[0].formattingLabels.includes('Font family'));assert.ok(!last.views.document[0].formattingLabels.includes('Font size'));
console.log('Mixed included font/excluded size exact reject targets + table cell screen kinds passed');
