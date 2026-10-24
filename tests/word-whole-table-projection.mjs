import assert from 'node:assert/strict';import fs from 'node:fs';import {loadPyodide} from 'pyodide';
import {compareDocumentModels,diffText} from '../src/features/document-compare/documentComparison.ts';
let latest;
globalThis.worklazyDiffJson=(a,b)=>JSON.stringify(diffText(a,b));globalThis.worklazyComparisonManifestJson=(a,b,formatting,tables,metadata)=>{latest=compareDocumentModels('before','after',JSON.parse(a),JSON.parse(b),{formatting,tables,metadata},'en');return JSON.stringify(latest.manifest)};
const py=await loadPyodide();py.globals.set('WORKLAZY_FORMATTING_POLICY_JSON',fs.readFileSync('src/features/word-compare/formatting-policy.json','utf8'));
for(const name of ['compare','accept_revisions','tracked_docx'])py.runPython(fs.readFileSync(`src/features/word-compare/${name}.py`,'utf8'));
py.FS.mkdirTree('/fixtures');py.FS.writeFile('/fixtures/word-note-fixtures.py',fs.readFileSync('tests/word-note-fixtures.py'));py.globals.set('__file__','/fixtures/word-whole-table-fixtures.py');py.runPython(fs.readFileSync('tests/word-whole-table-fixtures.py','utf8').replace("if __name__=='__main__':",'if False:'));
const harness=fs.readFileSync('tests/word-package-events.mjs','utf8');py.runPython(harness.slice(harness.indexOf('def reject(node):'),harness.indexOf('def view(')));
const rows=JSON.parse(py.runPython(`
import os,shutil
os.makedirs('/whole-artifacts',exist_ok=True)
cases=fixtures('/whole-sources');results=[]
legacy_reject=reject
def reject(node):
 # Reject inserted rows via the standard reversal of insertion/deletion.
 # A fully inserted table has no surviving row/container in the before view.
 if node.tag==W+'tbl':
  rows=node.findall(W+'tr')
  if rows and all(row.find(W+'trPr/'+W+'ins') is not None and row.find(W+'trPr/'+W+'ins').get(W+'author')=='events' for row in rows):return []
 if node.tag==W+'tr' and node.find(W+'trPr/'+W+'ins') is not None and node.find(W+'trPr/'+W+'ins').get(W+'author')=='events':return []
 return legacy_reject(node)
def endpoint(path):
 with zipfile.ZipFile(path) as z:
  root=ET.fromstring(z.read('word/document.xml'));body=root.find(W+'body');rels={r.get('Id'):r for r in ET.fromstring(z.read('word/_rels/document.xml.rels'))} if 'word/_rels/document.xml.rels' in z.namelist() else {};notes={}
  if 'word/footnotes.xml' in z.namelist():notes={n.get(W+'id'):''.join(n.itertext()) for n in ET.fromstring(z.read('word/footnotes.xml')) if n.get(W+'type','normal')=='normal'}
  targets=[notes[n.get(W+'id')] for n in body.iter(W+'footnoteReference')]
  images=[];links=[]
  for n in body.iter():
   if n.tag=='{http://schemas.openxmlformats.org/drawingml/2006/main}blip':
    rel=rels[n.get(R+'embed')];part=posixpath.normpath(posixpath.join('word',rel.get('Target')));images.append(SHA(z.read(part)))
   if n.tag==W+'hyperlink':links.append({'text':''.join(n.itertext()),'target':rels[n.get(R+'id')].get('Target')})
  return {'bodyBlocks':[n.tag.split('}')[-1] for n in body],'bodyTextNodes':[n.text or '' for n in body.iter(W+'t')],'tables':[{'gridColumns':len(t.findall(W+'tblGrid/'+W+'gridCol')),'rows':len(t.findall(W+'tr')),'cells':[len(r.findall(W+'tc')) for r in t.findall(W+'tr')]} for t in body.iter(W+'tbl')],'noteTargets':targets,'images':images,'links':links}
def expected_endpoint(raw):
 return {k:raw[k] for k in ['bodyBlocks','bodyTextNodes','tables']}|{'noteTargets':[next(n['text'] for n in raw['notes'] if n['id']==rid) for rid in raw['noteReferences']],'images':[n['sha256'] for n in raw['media']],'links':[{'text':'External link','target':n[2]} for n in raw['relationships'] if n[1]=='hyperlink']}
for case in cases:
 before=case['sources']['before']['path'];after=case['sources']['after']['path'];out='/whole-output.docx';name=case['name']
 for side in ['before','after']:assert endpoint(case['sources'][side]['path'])==expected_endpoint(case['sources'][side]['expected'])
 item={'name':name}
 try:
  if os.path.exists(out):os.unlink(out)
  generate_tracked_document(before,after,out,'events',True,True,True)
  assert name!='zero-row-to-populated','zero-row source emitted'
  accept_tracked_document(out,'/whole-accepted.docx')
  with zipfile.ZipFile(out) as source,zipfile.ZipFile('/whole-rejected.docx','w') as output:
   for entry in source.infolist():
    data=source.read(entry.filename)
    if entry.filename.startswith('word/') and entry.filename.endswith('.xml'):data=_serialize_xml(reject(ET.fromstring(data))[0])
    output.writestr(entry,data)
  actual_a=endpoint('/whole-accepted.docx');actual_b=endpoint('/whole-rejected.docx');item.update(accept=actual_a==expected_endpoint(case['sources']['after']['expected']),reject=actual_b==expected_endpoint(case['sources']['before']['expected']),actualAccept=actual_a,actualReject=actual_b)
  a=extract_document_model(open(before,'rb').read(),True,True,'en');b=extract_document_model(open(after,'rb').read(),True,True,'en');manifest=json.loads(worklazyComparisonManifestJson(a,b,True,True,True))
  for defect in ['grid-owner','duplicate-row','duplicate-column','missing-child']:
   bad=copy.deepcopy(manifest);table=next(d for d in bad['decisions'] if d['type']=='table')
   if defect=='grid-owner':table['gridProjection']['mode']='paired'
   elif defect=='duplicate-row':table['rows']*=2
   elif defect=='duplicate-column':table['columns']*=2
   else:table['children']=[]
   if os.path.exists('/bad-whole.docx'):os.unlink('/bad-whole.docx')
   try:generate_tracked_document(before,after,'/bad-whole.docx','events',True,True,True,json.dumps(bad));raise AssertionError(defect+' emitted')
   except ValueError:assert not os.path.exists('/bad-whole.docx')
  for variant,path in [('before',before),('after',after),('out',out),('accepted','/whole-accepted.docx'),('rejected','/whole-rejected.docx')]:shutil.copyfile(path,'/whole-artifacts/'+name+'-'+variant+'.docx')
 except Exception as error:
  if name=='zero-row-to-populated' and isinstance(error,ValueError) and str(error)=='UNSUPPORTED_TRACKED_SOURCE_ZERO_ROW_TABLE':
   assert not os.path.exists(out);item.update(status='native-unfaithful-zero-row-refused',accept=False,reject=False)
  else:item['error']=str(error)
 results.append(item)
# No arbitrary empty-container pruning: unmarked zero rows survive the codec;
# mixed deleted/live rows keep the table and its remaining cells.
zero=next(c for c in cases if c['name']=='zero-row-to-populated')['sources']['before']['path']
accept_tracked_document(zero,'/zero-unchanged.docx');assert endpoint('/zero-unchanged.docx')==endpoint(zero)
plain=next(c for c in cases if c['name']=='whole-table-death')['sources']['before']['path']
with zipfile.ZipFile(plain) as z:entries={n:z.read(n) for n in z.namelist()}
root=ET.fromstring(entries['word/document.xml']);t=root.find('.//'+W+'tbl');old=t.find(W+'tr');t.append(copy.deepcopy(old));props=ET.Element(W+'trPr');old.insert(0,props);ET.SubElement(props,W+'del',{W+'id':'91',W+'author':'Old'});entries['word/document.xml']=_serialize_xml(root)
with zipfile.ZipFile('/mixed-rows.docx','w') as z:
 for n,data in entries.items():z.writestr(n,data)
accept_tracked_document('/mixed-rows.docx','/mixed-accepted.docx');assert endpoint('/mixed-accepted.docx')==endpoint(plain)
json.dumps(results)
`));console.log(JSON.stringify(rows,null,2));
fs.mkdirSync('docs/jobs/todo/diffchecker-port-20261023/whole-table-packages',{recursive:true});for(const name of py.FS.readdir('/whole-artifacts').filter(n=>n.endsWith('.docx')))fs.writeFileSync('docs/jobs/todo/diffchecker-port-20261023/whole-table-packages/'+name,py.FS.readFile('/whole-artifacts/'+name));
assert.equal(rows.filter(r=>r.accept&&r.reject&&!r.error).length,4);assert.equal(rows.filter(r=>r.status==='native-unfaithful-zero-row-refused').length,1);
