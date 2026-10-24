// Existing source fixtures/oracle + current Pyodide producer and authoritative TS decisions.
import assert from'node:assert/strict';import fs from'node:fs';import{loadPyodide}from'pyodide';import{compareDocumentModels,diffText}from'../src/features/document-compare/documentComparison.ts';
let requested,forge=false;const manifests=[];globalThis.worklazyDrawingMask=json=>{requested=JSON.parse(json)};globalThis.worklazyDiffJson=(a,b)=>JSON.stringify(diffText(a,b));globalThis.worklazyComparisonManifestJson=(a,b,formatting,tables,metadata)=>{let left=JSON.parse(a),right=JSON.parse(b);if(forge)for(const model of[left,right])for(const ref of model.sourceInventory){if(ref.objectEvent)ref.objectEvent.supported=true;if('objectEventsSupported'in ref)ref.objectEventsSupported=true;}const manifest=compareDocumentModels('before','after',left,right,{formatting,tables,metadata,formattingMask:requested},'en').manifest;manifests.push(manifest);return JSON.stringify(manifest)};
const py=await loadPyodide();py.globals.set('WORKLAZY_FORMATTING_POLICY_JSON',fs.readFileSync('src/features/word-compare/formatting-policy.json','utf8'));for(const name of['compare','accept_revisions','tracked_docx'])py.runPython(fs.readFileSync(`src/features/word-compare/${name}.py`,'utf8'));
const events=fs.readFileSync('tests/word-package-events.mjs','utf8');py.runPython(events.slice(events.indexOf('registry=dict(ET._namespace_map)'),events.indexOf('checks=[]')));py.runPython(fs.readFileSync('tests/word-future-resource-fixtures.py','utf8').replace("if __name__=='__main__':","if False:"));
console.log(py.runPython(String.raw`
VML_CASES=build_fixtures('/tmp/vml-packages');VML_CHECKS=[]
def project_vml(before,after,stem,formatting=False,expected_before=None,expected_after=None):
 output=stem+'-tracked.docx';accepted=stem+'-accepted.docx';rejected=stem+'-rejected.docx'
 generate_tracked_document(before,after,output,'events',formatting,True,True)
 accept_tracked_document(output,accepted)
 with zipfile.ZipFile(output)as source,zipfile.ZipFile(rejected,'w')as out:
  for entry in source.infolist():
   data=source.read(entry.filename)
   if entry.filename.endswith('.xml')and entry.filename!='[Content_Types].xml':
    root=ET.fromstring(data)
    if root.tag.startswith(W):data=ET.tostring(reject(root)[0],encoding='utf-8',xml_declaration=True)
   out.writestr(entry,data)
 for path in [output,accepted,rejected]:assert validate_source(path)
 assert reachable(accepted)==(expected_after if expected_after is not None else reachable(after))
 assert reachable(rejected)==(expected_before if expected_before is not None else reachable(before))
 return accepted,rejected
for case in VML_CASES:
 if case['name'] not in ['vml-body','vml-before-note']:continue
 assert reachable(case['before'])==case['expectedRejectGraph'];assert reachable(case['after'])==case['expectedAcceptGraph']
 project_vml(case['before'],case['after'],'/tmp/vml-packages/'+case['name'],expected_before=case['expectedRejectGraph'],expected_after=case['expectedAcceptGraph']);VML_CHECKS.append(case['name'])
# Same bytes with volatile VML IDs/rId/namespace aliases renamed: same event identity.
case=next(c for c in VML_CASES if c['name']=='vml-body')
with zipfile.ZipFile(case['before'])as z:entries={n:z.read(n) for n in z.namelist()}
entries['word/document.xml']=entries['word/document.xml'].replace(b'_x0000_t75',b'RenamedType').replace(b'_x0000_i1025',b'RenamedShape').replace(b'rImage',b'RenamedImage').replace(b'v:',b'alias:').replace(b'xmlns:v=',b'xmlns:alias=')
entries['word/_rels/document.xml.rels']=entries['word/_rels/document.xml.rels'].replace(b'Id="rImage"',b'Id="RenamedImage"')
with zipfile.ZipFile('/tmp/vml-packages/renamed.docx','w')as z:
 for name,data in entries.items():z.writestr(name,data)
project_vml(case['before'],'/tmp/vml-packages/renamed.docx','/tmp/vml-packages/renamed');VML_CHECKS.append('volatile IDs/rId/namespace aliases')
# W1: image run font changes remain independently controlled by existing masks.
for formatting in [False,True]:
 paths=[]
 for side,properties in [('before','<w:b/>'),('after','<w:i/>')]:
  path='/tmp/vml-packages/font-'+str(formatting)+'-'+side+'.docx'
  body=p(text('Same ')+image(True).replace('<w:r>','<w:r><w:rPr>'+properties+'</w:rPr>',1))
  package(path,body,side);paths.append(path)
 accepted,rejected=project_vml(*paths,'/tmp/vml-packages/font-'+str(formatting),formatting=formatting)
 for path,wanted in [(accepted,W+'i'),(rejected,W+'b' if formatting else W+'i')]:
  with zipfile.ZipFile(path)as z:
   root=ET.fromstring(z.read('word/document.xml'));parents={c:p for p in root.iter() for c in p};picture=root.find('.//'+W+'pict');properties=parents[picture].find(W+'rPr');assert properties.find(wanted)is not None,(path,ET.tostring(properties))
 VML_CHECKS.append('W1 formatting '+str(formatting))
json.dumps({'strictSourceWitnesses':2,'positiveProjectionCases':len(VML_CHECKS),'checks':VML_CHECKS})
`));
assert(manifests.some(m=>m.decisions.some(d=>d.objectEvents?.unchangedDrawings.length===1&&d.objectEvents.changed===false)));
const geometry=JSON.parse(py.runPython(String.raw`
geometry_checks=[]
for formatting in [False,True]:
 for axis in ['width','height']:
  paths=[]
  for side in ['before','after']:
   value='144' if side=='after' else '72';style=('width:'+value+'pt;height:72pt') if axis=='width' else ('width:72pt;height:'+value+'pt')
   path='/tmp/vml-packages/geometry-'+axis+'-'+str(formatting)+'-'+side+'.docx'
   package(path,p(text('Same ')+image(True).replace('width:72pt;height:72pt',style)),'before');paths.append(path)
  stem='/tmp/vml-packages/geometry-'+axis+'-'+str(formatting)
  if formatting:
   accepted,rejected=project_vml(*paths,stem,formatting=True)
   def styles(path):
    with zipfile.ZipFile(path)as z:return [n.get('style')for n in ET.fromstring(z.read('word/document.xml')).iter('{urn:schemas-microsoft-com:vml}shape')]
   assert styles(accepted)==styles(paths[1]);assert styles(rejected)==styles(paths[0]);outcome='included geometry endpoints exact'
  else:
   try:generate_tracked_document(*paths,stem+'-tracked.docx','events',False,True,True)
   except ValueError as error:assert str(error)=='UNSUPPORTED_TRACKED_SOURCE_VML_EXCLUDED_GEOMETRY',str(error)
   else:raise AssertionError('W1 excluded geometry reverted to before')
   assert not os.path.exists(stem+'-tracked.docx');outcome='explicit refusal/no partial output'
  geometry_checks.append({'axis':axis,'formatting':formatting,'outcome':outcome})
json.dumps(geometry_checks)
`));assert.equal(geometry.length,4);console.log(JSON.stringify({pairedGeometryBoundary:geometry}));
forge=true;const forged=JSON.parse(py.runPython(String.raw`
source=next(c for c in VML_CASES if c['name']=='vml-body');paths=[]
for side in ['before','after']:
 with zipfile.ZipFile(source[side])as z:entries={n:z.read(n) for n in z.namelist()}
 root=ET.fromstring(entries['word/document.xml']);shape=root.find('.//{urn:schemas-microsoft-com:vml}shape');ET.SubElement(shape,'{urn:schemas-microsoft-com:vml}textbox');entries['word/document.xml']=ET.tostring(root)
 path='/tmp/vml-packages/forged-'+side+'.docx'
 with zipfile.ZipFile(path,'w')as z:
  for name,data in entries.items():z.writestr(name,data)
 paths.append(path)
try:generate_tracked_document(*paths,'/tmp/vml-packages/forged-output.docx','events',False,True,True)
except ValueError as error:
 assert 'INVALID_COMPARISON_MANIFEST' in str(error) or 'UNSUPPORTED_TRACKED_SOURCE' in str(error),str(error)
 guard=str(error)
else:raise AssertionError('forged unsafe VML admitted')
assert not os.path.exists('/tmp/vml-packages/forged-output.docx')
json.dumps({'sourceForgeryGuard':guard,'partialOutput':False})
`));assert.equal(forged.partialOutput,false);console.log(JSON.stringify(forged));
if(process.env.WORD_VML_ARTIFACT_DIR){fs.mkdirSync(process.env.WORD_VML_ARTIFACT_DIR,{recursive:true});for(const name of py.FS.readdir('/tmp/vml-packages').filter(n=>n.endsWith('.docx')))fs.writeFileSync(process.env.WORD_VML_ARTIFACT_DIR+'/'+name,py.FS.readFile('/tmp/vml-packages/'+name));}
