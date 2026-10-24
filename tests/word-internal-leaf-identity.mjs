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
