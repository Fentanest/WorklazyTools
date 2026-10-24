// Actual provider+existing manifest+terminal codecs for one unchanged leaf rename.
// Changed-target endpoint remains separately pending in future-resource strict oracle.
import assert from'node:assert/strict';import fs from'node:fs';import{loadPyodide}from'pyodide';import{compareDocumentModels,diffText}from'../src/features/document-compare/documentComparison.ts';
let requested,manifest;globalThis.worklazyDrawingMask=json=>{requested=JSON.parse(json)};globalThis.worklazyDiffJson=(a,b)=>JSON.stringify(diffText(a,b));globalThis.worklazyComparisonManifestJson=(a,b,formatting,tables,metadata)=>{manifest=compareDocumentModels('before','after',JSON.parse(a),JSON.parse(b),{formatting,tables,metadata,formattingMask:requested},'en').manifest;return JSON.stringify(manifest)};
const py=await loadPyodide();py.globals.set('WORKLAZY_FORMATTING_POLICY_JSON',fs.readFileSync('src/features/word-compare/formatting-policy.json','utf8'));for(const name of['compare','accept_revisions','tracked_docx'])py.runPython(fs.readFileSync(`src/features/word-compare/${name}.py`,'utf8'));
const events=fs.readFileSync('tests/word-package-events.mjs','utf8');py.runPython(events.slice(events.indexOf('registry=dict(ET._namespace_map)'),events.indexOf('checks=[]')));py.runPython(fs.readFileSync('tests/word-future-resource-fixtures.py','utf8').replace("if __name__=='__main__':","if False:"));
const result=JSON.parse(py.runPython(String.raw`
case=next(c for c in build_fixtures('/tmp/leaf-identity') if c['name']=='internal-part-link')
with zipfile.ZipFile(case['before']) as z:entries={n:z.read(n) for n in z.namelist()}
entries['customXml/data.xml']=entries.pop('word/target.xml')
rels=ET.fromstring(entries['word/_rels/document.xml.rels'])
for rel in rels:
 if rel.get('Id')=='rLink':rel.set('Id','renamed');rel.set('Target','../customXml/data.xml')
entries['word/_rels/document.xml.rels']=ET.tostring(rels)
root=ET.fromstring(entries['word/document.xml']);root.find('.//'+W+'hyperlink').set(R+'id','renamed');entries['word/document.xml']=ET.tostring(root)
with zipfile.ZipFile('/tmp/leaf-identity/renamed.docx','w') as z:
 for name,data in entries.items():z.writestr(name,data)
generate_tracked_document(case['before'],'/tmp/leaf-identity/renamed.docx','/tmp/leaf-identity/output.docx','events',False,True,True)
accept_tracked_document('/tmp/leaf-identity/output.docx','/tmp/leaf-identity/accepted.docx')
with zipfile.ZipFile('/tmp/leaf-identity/output.docx')as source,zipfile.ZipFile('/tmp/leaf-identity/rejected.docx','w')as out:
 for entry in source.infolist():
  data=source.read(entry.filename)
  if entry.filename.endswith('.xml')and entry.filename!='[Content_Types].xml':
   root=ET.fromstring(data)
   if root.tag.startswith(W):data=ET.tostring(reject(root)[0],encoding='utf-8',xml_declaration=True)
  out.writestr(entry,data)
for name in ['output','accepted','rejected']:
 path='/tmp/leaf-identity/'+name+'.docx';assert validate_source(path);assert reachable(path)==case['expectedRejectGraph']
json.dumps({'graphs':3,'unchangedRawTargetSHA256':digest(entries['customXml/data.xml'])})
`));
assert(manifest.decisions.some(d=>d.objectEvents?.unchangedLinks.length===1&&d.objectEvents.changed===false));assert.equal(result.graphs,3);console.log(JSON.stringify({scope:'renamed same-byte XML leaf only; changed-target endpoint NOT asserted',...result}));

const deleted=JSON.parse(py.runPython(String.raw`
package('/tmp/leaf-identity/deletion-before.docx',p(text('Stable anchor'))+p(link('internal')),'before',internal=True)
package('/tmp/leaf-identity/deletion-after.docx',p(text('Stable anchor')),'after',internal=True)
expected_before=[P([T('Stable anchor')]),P([{'hyperlink':{'text':'internal','target':{'sha256':digest(b'<fixture>before internal target</fixture>'),'mime':'application/xml'}}}])]
expected_after=[P([T('Stable anchor')])]
assert reachable('/tmp/leaf-identity/deletion-before.docx')==expected_before
assert reachable('/tmp/leaf-identity/deletion-after.docx')==expected_after
generate_tracked_document('/tmp/leaf-identity/deletion-before.docx','/tmp/leaf-identity/deletion-after.docx','/tmp/leaf-identity/deletion-tracked.docx','events',False,True,True)
accept_tracked_document('/tmp/leaf-identity/deletion-tracked.docx','/tmp/leaf-identity/deletion-accepted.docx')
with zipfile.ZipFile('/tmp/leaf-identity/deletion-tracked.docx')as source,zipfile.ZipFile('/tmp/leaf-identity/deletion-rejected.docx','w')as out:
 for entry in source.infolist():
  data=source.read(entry.filename)
  if entry.filename.endswith('.xml')and entry.filename!='[Content_Types].xml':
   root=ET.fromstring(data)
   if root.tag.startswith(W):data=ET.tostring(reject(root)[0],encoding='utf-8',xml_declaration=True)
  out.writestr(entry,data)
for name,expected in [('accepted',expected_after),('rejected',expected_before)]:
 path='/tmp/leaf-identity/deletion-'+name+'.docx';validate_source(path);assert reachable(path)==expected
json.dumps({'literalTerminalGraphs':2})
`));assert(manifest.decisions.some(d=>d.before.length===1&&d.after.length===0&&d.objectEvents?.before.some(ref=>ref.objectEvent.kind==='hyperlink')));console.log(JSON.stringify({scope:'existing declared terminal whole-paragraph deletion only',...deleted}));
const guarded=JSON.parse(py.runPython(String.raw`
checks=[]
for label,before_body,after_body in [
 ('paired-changed-target',p(link('internal')),p(link('internal'))),
 ('nonterminal-deletion',p(link('internal'))+p(text('Stable anchor')),p(text('Stable anchor')))]:
 before='/tmp/leaf-identity/'+label+'-before.docx';after='/tmp/leaf-identity/'+label+'-after.docx';output='/tmp/leaf-identity/'+label+'-output.docx'
 package(before,before_body,'before',internal=True);package(after,after_body,'after',internal=True)
 try:generate_tracked_document(before,after,output,'events',False,True,True)
 except ValueError as error:assert str(error)=='UNSUPPORTED_TRACKED_SOURCE_INTERNAL_LINK_REVISION',(label,str(error))
 else:raise AssertionError('unsupported producer path enabled: '+label)
 assert not os.path.exists(output);checks.append(label)
json.dumps(checks)
`));assert.equal(guarded.length,2);console.log(JSON.stringify({preciseA5Guards:guarded,noPartialOutput:true}));
if(process.env.WORD_INTERNAL_LEAF_ARTIFACT_DIR){fs.mkdirSync(process.env.WORD_INTERNAL_LEAF_ARTIFACT_DIR,{recursive:true});for(const name of py.FS.readdir('/tmp/leaf-identity').filter(n=>n.endsWith('.docx')))fs.writeFileSync(process.env.WORD_INTERNAL_LEAF_ARTIFACT_DIR+'/'+name,py.FS.readFile('/tmp/leaf-identity/'+name));}
