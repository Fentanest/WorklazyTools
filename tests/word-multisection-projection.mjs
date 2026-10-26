import assert from 'node:assert/strict';import fs from 'node:fs';import {loadPyodide} from 'pyodide';
import {compareDocumentModels,diffText} from '../src/features/document-compare/documentComparison.ts';
let latest;
globalThis.worklazyDiffJson=(a,b)=>JSON.stringify(diffText(a,b));
globalThis.worklazyComparisonManifestJson=(a,b,formatting,tables,metadata)=>{latest=compareDocumentModels('before','after',JSON.parse(a),JSON.parse(b),{formatting,tables,metadata},'en');return JSON.stringify(latest.manifest)};
const py=await loadPyodide();py.globals.set('WORKLAZY_FORMATTING_POLICY_JSON',fs.readFileSync('src/features/word-compare/formatting-policy.json','utf8'));
for(const name of ['compare','accept_revisions','tracked_docx'])py.runPython(fs.readFileSync(`src/features/word-compare/${name}.py`,'utf8'));
const harness=fs.readFileSync('tests/word-package-events.mjs','utf8');py.runPython(harness.slice(harness.indexOf('def reject(node):'),harness.indexOf('def view(')));
const fixture=fs.readFileSync('tests/word-multisection-fixtures.py','utf8').replace("if __name__=='__main__':main()","if False:main()");py.runPython(fixture);
// Source invariant oracle remains unchanged; output accepts semantically empty
// hyperlink envelopes after removal of a tracked insertion.
py.runPython(fixture.slice(fixture.indexOf('def inspect('),fixture.indexOf('def native_source_check(')).replace('def inspect(','def inspect_output(').replace('links=list(story.iter(W+\'hyperlink\'))','links=[link for link in story.iter(W+\'hyperlink\') if "".join(link.itertext())]'));
const results=JSON.parse(py.runPython(`
import os
os.makedirs('/multisection',exist_ok=True)
legacy_reject=reject
def reject(node):
 if node.tag==W+'pPr':
  change=node.find(W+'pPrChange')
  if change is not None and change.get(W+'author')=='events':
   previous=copy.deepcopy(change.find(W+'pPr'))
   for name in ['rPr','sectPr']:
    current=node.find(W+name)
    if current is not None:previous.append(copy.deepcopy(current))
   return reject(previous)
 return legacy_reject(node)
original_part_writer=_revisionize_xml_part
part_calls={}
def counted_part_writer(*args,**kwargs):
 part=kwargs.get('part','word/document.xml')
 if part!='word/document.xml':part_calls[part]=part_calls.get(part,0)+1
 return original_part_writer(*args,**kwargs)
_revisionize_xml_part=counted_part_writer
results=[]
for case in CASES:
 for side in ['before','after']:build('/multi-'+side+'.docx',case,side);assert inspect('/multi-'+side+'.docx')==expected(case,side)
 for formatting in [False,True]:
  for metadata in [False,True]:
   name=case['name']+'-'+str(formatting)+'-'+str(metadata)
   part_calls={}
   try:
    generate_tracked_document('/multi-before.docx','/multi-after.docx','/multi-out.docx','events',formatting,True,metadata)
    accept_tracked_document('/multi-out.docx','/multi-accepted.docx')
    with zipfile.ZipFile('/multi-out.docx') as source,zipfile.ZipFile('/multi-rejected.docx','w') as output:
     for entry in source.infolist():
      data=source.read(entry.filename)
      if entry.filename.endswith('.xml') and entry.filename.startswith('word/'):
       root=ET.fromstring(data)
       if root.tag.startswith(W):data=_serialize_xml(reject(root)[0])
      output.writestr(entry,data)
    accepted=inspect_output('/multi-accepted.docx');rejected=inspect_output('/multi-rejected.docx')
    model_a=extract_document_model(open('/multi-before.docx','rb').read(),True,True,'en');model_b=extract_document_model(open('/multi-after.docx','rb').read(),True,True,'en');manifest=json.loads(worklazyComparisonManifestJson(model_a,model_b,formatting,True,metadata))
    assert part_calls=={pair['afterPart']:1 for pair in manifest['storyProjection']['pairs']}
    assert accepted==expected(case,'after'),('accept',accepted,expected(case,'after'))
    target=copy.deepcopy(expected(case,'before'))
    for old,current in zip(target,expected(case,'after')):
     if not formatting:old['topMargin']=current['topMargin']
     for kind in ['header','footer']:
      if not metadata:old['slots'][kind]=current['slots'][kind]
      else:
       old['slots'][kind]['part']=current['slots'][kind]['part'];old['slots'][kind]['referenceId']=current['slots'][kind]['referenceId']
    assert rejected==target,('reject',rejected,target)
    with zipfile.ZipFile('/multi-out.docx') as z,zipfile.ZipFile('/multi-after.docx') as after:
     for entry in z.namelist():
      if entry.startswith('word/') and entry.endswith('.xml'):
       root=ET.fromstring(z.read(entry))
       for change in root.iter():
        if change.tag in [W+'pPrChange',W+'sectPrChange']:assert not any(n.tag in [W+'headerReference',W+'footerReference'] for n in change.iter()),'Previous properties contain forbidden refs'
     if not metadata:
      for part in [p for p in after.namelist() if p.startswith('word/stories/') and p.endswith('.xml')]:assert z.read(part)==after.read(part)
    for defect in ['section-missing','section-owner','section-source','section-order']+(['binding-section','route-donor','sharing-owner','physical-decision'] if metadata else []):
     if not manifest['storyProjection']['sections']:continue
     bad=copy.deepcopy(manifest);plan=bad['storyProjection']
     if defect=='section-missing':plan['sections']=[]
     elif defect=='section-owner':plan['sections'][0]['ownerDecisionId']='fake'
     elif defect=='section-source':plan['sections'][0]['after']['source']['path']=[999]
     elif defect=='section-order':plan['sections'].reverse()
     elif defect=='binding-section':plan['bindings'][0]['sectionId']='fake'
     elif defect=='route-donor':plan['routes'][0]['after']['donorSectionId']='fake'
     elif defect=='sharing-owner':plan['pairs'][0]['afterPart']='word/document.xml'
     else:plan['pairs'][0]['decisionIds']*=2
     if os.path.exists('/bad-multi.docx'):os.unlink('/bad-multi.docx')
     try:generate_tracked_document('/multi-before.docx','/multi-after.docx','/bad-multi.docx','events',formatting,True,metadata,json.dumps(bad));raise AssertionError(defect+' emitted')
     except ValueError:assert not os.path.exists('/bad-multi.docx')
    for variant in ['before','after','out','accepted','rejected']:shutil.copyfile('/multi-'+variant+'.docx','/multisection/'+name+'-'+variant+'.docx')
    results.append({'name':name,'pass':True})
   except Exception as error:results.append({'name':name,'pass':False,'error':str(error)})
# Paragraph base history must not swallow live paragraph-mark/section children.
case=next(case for case in CASES if case['name']=='stable-bindings-margin-change')
for side in ['before','after']:
 build('/multi-'+side+'.docx',case,side)
 with zipfile.ZipFile('/multi-'+side+'.docx') as z:entries={n:z.read(n) for n in z.namelist()}
 root=ET.fromstring(entries['word/document.xml']);props=next(p.find(W+'pPr') for p in root.iter(W+'p') if p.find(W+'pPr/'+W+'sectPr') is not None)
 props.insert(0,ET.Element(W+'jc',{W+'val':'left' if side=='before' else 'right'}));mark=ET.Element(W+'rPr');ET.SubElement(mark,W+'color',{W+'val':'FF0000' if side=='before' else '0000FF'});props.insert(1,mark)
 entries['word/document.xml']=_serialize_xml(root)
 with zipfile.ZipFile('/multi-'+side+'.docx','w') as z:
  for n,data in entries.items():z.writestr(n,data)
generate_tracked_document('/multi-before.docx','/multi-after.docx','/coexist-out.docx','events',True,True,True)
with zipfile.ZipFile('/coexist-out.docx') as source,zipfile.ZipFile('/coexist-rejected.docx','w') as out:
 for entry in source.infolist():
  data=source.read(entry.filename)
  if entry.filename.startswith('word/') and entry.filename.endswith('.xml'):
   root=ET.fromstring(data)
   if root.tag.startswith(W):data=_serialize_xml(reject(root)[0])
  out.writestr(entry,data)
with zipfile.ZipFile('/coexist-out.docx') as z:
 root=ET.fromstring(z.read('word/document.xml'));previous=root.find('.//'+W+'pPrChange/'+W+'pPr');assert previous is not None and previous.find(W+'rPr') is None and previous.find(W+'sectPr') is None
 assert root.find('.//'+W+'sectPrChange/'+W+'sectPr/'+W+'headerReference') is None
with zipfile.ZipFile('/coexist-rejected.docx') as z:
 root=ET.fromstring(z.read('word/document.xml'));props=next(p.find(W+'pPr') for p in root.iter(W+'p') if p.find(W+'pPr/'+W+'sectPr') is not None)
 assert props.find(W+'jc').get(W+'val')=='left' and props.find(W+'rPr/'+W+'color').get(W+'val')=='0000FF'
 assert props.find(W+'sectPr/'+W+'pgMar').get(W+'top')=='720' and props.find(W+'sectPr/'+W+'headerReference').get(R+'id').startswith('afterBinding_')
for variant,path in [('before','/multi-before.docx'),('after','/multi-after.docx'),('out','/coexist-out.docx'),('rejected','/coexist-rejected.docx')]:shutil.copyfile(path,'/multisection/paragraph-section-coexist-'+variant+'.docx')
results.append({'name':'paragraph-section-base-coexistence','pass':True})
# Known changed/ambiguous bindings and non-1:1 boundary ownership are refused.
for defect in ['sharing','presence','moved-boundary','split-boundary','merged-boundary','activation']:
 case=CASES[0]
 for side in ['before','after']:build('/bad-'+side+'.docx',case,side)
 for side in ['before','after']:
  with zipfile.ZipFile('/bad-'+side+'.docx') as z:entries={n:z.read(n) for n in z.namelist()}
  root=ET.fromstring(entries['word/document.xml']);body=root.find(W+'body');boundary=next(p for p in body.findall(W+'p') if p.find(W+'pPr/'+W+'sectPr') is not None)
  if defect=='moved-boundary':
   for value in ['ADDITIONAL SECOND SECTION ALPHA','ADDITIONAL SECOND SECTION OMEGA']:body.insert(len(body)-1,ET.fromstring('<w:p'+NS+'><w:r><w:t>'+value+'</w:t></w:r></w:p>'))
   if side=='after':body.remove(boundary);body.insert(len(body)-1,boundary)
  if defect in ['split-boundary','merged-boundary']:
   full='First boundary sentence. Second boundary sentence.';split=(side=='after')==(defect=='split-boundary');boundary.find(W+'r/'+W+'t').text='Second boundary sentence.' if split else full
   if split:body.insert(list(body).index(boundary),ET.fromstring('<w:p'+NS+'><w:r><w:t>First boundary sentence. </w:t></w:r></w:p>'))
  if side=='after':
   sections=[p.find(W+'pPr/'+W+'sectPr') for p in body.findall(W+'p') if p.find(W+'pPr/'+W+'sectPr') is not None]+body.findall(W+'sectPr')
   if defect=='sharing':sections[1].find(W+'headerReference').set(R+'id',sections[0].find(W+'headerReference').get(R+'id'))
   if defect=='presence':sections[1].remove(sections[1].find(W+'headerReference'))
   if defect=='activation':sections[0].find(W+'type').set(W+'val','continuous')
  entries['word/document.xml']=_serialize_xml(root)
  with zipfile.ZipFile('/bad-'+side+'.docx','w') as z:
   for n,data in entries.items():z.writestr(n,data)
 if os.path.exists('/bad-output.docx'):os.unlink('/bad-output.docx')
 try:generate_tracked_document('/bad-before.docx','/bad-after.docx','/bad-output.docx','events',True,True,True);raise AssertionError(defect+' emitted')
 except ValueError:assert not os.path.exists('/bad-output.docx')
 a=extract_document_model(open('/bad-before.docx','rb').read(),True,True,'en');b=extract_document_model(open('/bad-after.docx','rb').read(),True,True,'en');bad=json.loads(worklazyComparisonManifestJson(a,b,True,True,True));assert not bad['storyProjection']['supported'],defect
 bad['storyProjection']['supported']=True;bad['storyProjection']['reasons']=[]
 try:generate_tracked_document('/bad-before.docx','/bad-after.docx','/bad-output.docx','events',True,True,True,json.dumps(bad));raise AssertionError(defect+' forged capability emitted')
 except ValueError:assert not os.path.exists('/bad-output.docx')
 results.append({'name':defect,'pass':True,'status':'explicit-unsupported-boundary'})
json.dumps(results)
`));
console.log(JSON.stringify(results,null,2));assert.equal(results.filter(r=>!r.pass).length,0);
fs.mkdirSync('docs/jobs/todo/diffchecker-port-20261023/multisection-packages',{recursive:true});
for(const name of py.FS.readdir('/multisection').filter(n=>n.endsWith('.docx')))fs.writeFileSync('docs/jobs/todo/diffchecker-port-20261023/multisection-packages/'+name,py.FS.readFile('/multisection/'+name));
