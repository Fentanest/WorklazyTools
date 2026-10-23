import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadPyodide} from 'pyodide';
import {compareDocumentModels,diffText} from '../src/features/document-compare/documentComparison.ts';
let actual;
globalThis.worklazyDiffJson=(a,b)=>JSON.stringify(diffText(a,b));
globalThis.worklazyComparisonManifestJson=(a,b,formatting,tables,metadata)=>{
 actual=compareDocumentModels('before','after',JSON.parse(a),JSON.parse(b),{formatting,tables,metadata},'en');return JSON.stringify(actual.manifest);
};
const py=await loadPyodide();
py.globals.set('WORKLAZY_FORMATTING_POLICY_JSON',fs.readFileSync('src/features/word-compare/formatting-policy.json','utf8'));
for(const name of ['compare','accept_revisions','tracked_docx'])py.runPython(fs.readFileSync(`src/features/word-compare/${name}.py`,'utf8'));
for (const [part,root,container] of [['header1','hdr',''],['footer1','ftr',''],['footnotes','footnotes','footnote'],['endnotes','endnotes','endnote'],['comments','comments','comment']]) {
 py.globals.set('part',part);py.globals.set('root_tag',root);py.globals.set('container',container);
 py.runPython(String.raw`
for side,value in [('before','Old table text'),('after','New table text')]:
    paragraph='<w:p><w:r><w:t>Unchanged outside</w:t></w:r></w:p>'
    table='<w:tbl><w:tr><w:tc><w:sdt><w:sdtContent><w:p><w:r><w:t>'+value+'</w:t></w:r></w:p></w:sdtContent></w:sdt></w:tc></w:tr></w:tbl>'
    story=paragraph+table
    if container: story='<w:'+container+' w:id="1">'+story+'</w:'+container+'>'
    story='<w:'+root_tag+' xmlns:w="'+WORD_NS+'">'+story+'</w:'+root_tag+'>'
    with zipfile.ZipFile('/'+side+'.docx','w') as archive:
        archive.writestr('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/></Types>')
        archive.writestr('word/document.xml','<w:document xmlns:w="'+WORD_NS+'"><w:body>'+paragraph+table+'</w:body></w:document>')
        archive.writestr('word/'+part+'.xml',story)
generate_tracked_document('/before.docx','/after.docx','/out.docx','scope-test',False,False,True)
with zipfile.ZipFile('/out.docx') as out, zipfile.ZipFile('/after.docx') as after:
    assert ET.tostring(ET.fromstring(out.read('word/'+part+'.xml')))==ET.tostring(ET.fromstring(after.read('word/'+part+'.xml'))), part
    body=ET.fromstring(out.read('word/document.xml'))
    assert ''.join(body.find('.//'+W+'tbl').itertext())=='New table text'
`);
 assert.equal(actual.summary.changed,0,part);
 assert.equal(actual.summary.added,0,part);
 assert.equal(actual.summary.deleted,0,part);
 for(const side of ['before','after']){
  const excluded=actual.manifest.coverage[side].filter(item=>item.reason==='excluded-table');
  assert.ok(excluded.some(item=>item.source.part===`word/${part}.xml`),part);
 }
 py.runPython(String.raw`
with open('/before.docx','rb') as f: left=extract_document_model(f.read(),True,True,'en')
with open('/after.docx','rb') as f: right=extract_document_model(f.read(),True,True,'en')
`);
 const enabled=compareDocumentModels('before','after',JSON.parse(py.globals.get('left')),JSON.parse(py.globals.get('right')),{formatting:false,tables:true,metadata:true},'en');
 assert.ok(enabled.summary.changed>0,part);
}
console.log('5 metadata stories: excluded screen/manifest/export and enabled comparison passed');
