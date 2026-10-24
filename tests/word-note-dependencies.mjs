import assert from 'node:assert/strict';import fs from 'node:fs';import {loadPyodide} from 'pyodide';
import {compareDocumentModels,diffText} from '../src/features/document-compare/documentComparison.ts';
let last,mask;
globalThis.worklazyDiffJson=(a,b)=>JSON.stringify(diffText(a,b));globalThis.worklazyComparisonManifestJson=(a,b,formatting,tables,metadata)=>{last=compareDocumentModels('before','after',JSON.parse(a),JSON.parse(b),{formatting,tables,metadata,formattingMask:mask},'en');return JSON.stringify(last.manifest)};
const py=await loadPyodide();py.globals.set('WORKLAZY_FORMATTING_POLICY_JSON',fs.readFileSync('src/features/word-compare/formatting-policy.json','utf8'));
for(const name of ['compare','accept_revisions','tracked_docx'])py.runPython(fs.readFileSync(`src/features/word-compare/${name}.py`,'utf8'));
py.FS.mkdirTree('/fixtures');py.FS.writeFile('/fixtures/word-note-fixtures.py',fs.readFileSync('tests/word-note-fixtures.py'));py.globals.set('__file__','/fixtures/word-note-dependency-fixtures.py');py.runPython(fs.readFileSync('tests/word-note-dependency-fixtures.py','utf8').replace("if __name__=='__main__':",'if False:'));
const harness=fs.readFileSync('tests/word-package-events.mjs','utf8');py.runPython(harness.slice(harness.indexOf('def reject(node):'),harness.indexOf('def view(')));
py.globals.set('configure_mask',group=>{mask={fontFamily:true,size:true,style:true,color:true,paragraph:true,numbering:group!=='numbering-off'};return JSON.stringify(mask);});
const rows=JSON.parse(py.runPython(`
import os,copy
os.makedirs('/dependency-artifacts',exist_ok=True);rows=[];cases=fixtures('/dependency-sources')
def rewrite(path,out,transform):
 with zipfile.ZipFile(path) as src,zipfile.ZipFile(out,'w') as dst:
  for entry in src.infolist():
   data=transform(entry.filename,src.read(entry.filename))
   if data is not None:dst.writestr(entry,data)
def projected(raw):
 g=copy.deepcopy(raw)
 def paragraphs(values):
  for p in values:
   if p['numbering']:p['numbering']={k:v for k,v in p['numbering'].items() if k not in ['numId','abstractNumId']}
 paragraphs(g['bodyParagraphs'])
 notes={n['id']:n for n in g['notes']};g['notes']=[]
 for ref in g['references']:
  n=copy.deepcopy(notes[ref['id']]);n.pop('id');paragraphs(n['paragraphs']);g['notes'].append({'bodyParagraph':ref['bodyParagraph'],**n})
 g['references']=[{'bodyParagraph':r['bodyParagraph'],'ownerPart':r['ownerPart']} for r in g['references']]
 for family in ['bodyResources','noteResources']:
  g[family]=[{k:v for k,v in r.items() if k in ['type','mime','sha256','external']} for r in g[family]]
 return g
for case in cases:
 kind=case['kind'];before=case['sources']['before']['path'];original_after=case['sources']['after']['path'];custom=case['name'].startswith('custom')
 variants=[('original',original_after)]
 if custom:
  control='/control-after-'+kind+'.docx'
  rewrite(original_after,control,lambda name,data:data.replace(b'https://note.after.example/',b'https://note.before.example/') if name.endswith('.rels') else data)
  expected_control=copy.deepcopy(case['sources']['after']['expectedRawGraph']);link=expected_control['noteResources'][1];link['external']=link['rawTarget']='https://note.before.example/'
  assert graph(control,kind)==expected_control
  variants.append(('same-target-control',control))
 for variant,after in variants:
  scopes=[('all',True,True),('metadata-off',True,False)] if variant=='original' and custom else [('all',True,True),('master-off',False,True)]+([] if custom else [('numbering-off',True,True),('metadata-off',True,False)])
  for group,formatting,metadata in scopes:
   mask_json=configure_mask(group);name=case['name']+'-'+variant+'-'+group;guarded=custom and variant=='original' and metadata
   for side,path in [('before',before),('after',after)]:shutil.copyfile(path,'/dependency-artifacts/'+name+'-'+side+'.docx')
   if os.path.exists('/dependency.docx'):os.unlink('/dependency.docx')
   try:generate_tracked_document(before,after,'/dependency.docx','events',formatting,True,metadata,formatting_mask_json=mask_json)
   except ValueError as error:
    assert guarded and str(error)=='UNSUPPORTED_TRACKED_SOURCE_CUSTOM_NOTE_LINK_REVISION' and not os.path.exists('/dependency.docx'),(name,str(error))
    a=extract_document_model(open(before,'rb').read(),True,True,'en');b=extract_document_model(open(after,'rb').read(),True,True,'en');manifest=json.loads(worklazyComparisonManifestJson(a,b,formatting,True,metadata));assert not manifest['noteProjection']['supported'] and 'custom-note-link-revision' in manifest['noteProjection']['reasons']
    rows.append({'name':name,'status':'paired-changed-target-A5-refused'});continue
   assert not guarded,name+' unsafe hyperlink export'
   accept_tracked_document('/dependency.docx','/accepted.docx')
   with zipfile.ZipFile('/dependency.docx') as src,zipfile.ZipFile('/rejected.docx','w') as dst:
    for entry in src.infolist():dst.writestr(entry,_serialize_xml(reject(_qname_safe_parse(src.read(entry.filename)))[0]) if entry.filename.endswith('.xml') and entry.filename.startswith('word/') else src.read(entry.filename))
   old=graph(before,kind);new=graph(after,kind);target=copy.deepcopy(old)
   target['mainNoteRelationship']=copy.deepcopy(new['mainNoteRelationship']);target['noteContentType']=new['noteContentType']
   for ref in target['references']:ref['ownerPart']=new['mainNoteRelationship']['resolvedPart']
   if not metadata:
    for field in ['references','notes','specials','noteResources']:target[field]=copy.deepcopy(new[field])
   actual_accept=projected(graph('/accepted.docx',kind));actual_reject=projected(graph('/rejected.docx',kind))
   assert actual_accept==projected(new),(name,'accept',actual_accept,projected(new))
   assert actual_reject==projected(target),(name,'reject',actual_reject,projected(target))
   if not metadata:
    part=new['mainNoteRelationship']['resolvedPart']
    with zipfile.ZipFile('/dependency.docx') as out,zipfile.ZipFile(after) as revised:
     assert out.read(part)==revised.read(part)
     rel=posixpath.join(posixpath.dirname(part),'_rels',posixpath.basename(part)+'.rels')
     if rel in revised.namelist():assert out.read(rel)==revised.read(rel)
   a=json.loads(extract_document_model(open(before,'rb').read(),True,True,'en'));b=json.loads(extract_document_model(open(after,'rb').read(),True,True,'en'));manifest=json.loads(worklazyComparisonManifestJson(json.dumps(a),json.dumps(b),formatting,True,metadata))
   if custom and metadata:
    action=manifest['noteProjection']['partActions'][0];assert action['beforePart']==old['mainNoteRelationship']['resolvedPart'] and action['afterPart']==new['mainNoteRelationship']['resolvedPart'] and action['beforePart']!=action['afterPart']
   for output,path in [('out','/dependency.docx'),('accepted','/accepted.docx'),('rejected','/rejected.docx')]:shutil.copyfile(path,'/dependency-artifacts/'+name+'-'+output+'.docx')
   rows.append({'name':name,'status':'literal-policy-endpoints-pass','sourceSHA256':{'before':sha(pathlib.Path(before).read_bytes()),'after':sha(pathlib.Path(after).read_bytes())}})
# Malformed/unsupported dependencies and owner graphs must never yield output.
configure_mask('all')
for case in cases:
 kind=case['kind'];before=case['sources']['before']['path'];after=case['sources']['after']['path'];custom=case['name'].startswith('custom')
 if custom:
  valid_after='/control-after-'+kind+'.docx'
  defects=['external','escape','query','missing','wrong-mime','duplicate-kind','duplicate-id','wrong-root','backslash','missing-id']
  for defect in defects:
   part=case['sources']['after']['expectedRawGraph']['mainNoteRelationship']['resolvedPart']
   def transform(name,data):
    if name=='word/_rels/document.xml.rels':
     root=ET.fromstring(data);rel=next(r for r in root if r.get('Type')==RNS+'/'+kind+'s')
     if defect=='missing-id':rel.attrib.pop('Id')
     elif defect=='external':rel.set('TargetMode','External')
     elif defect=='escape':rel.set('Target','../../outside.xml')
     elif defect=='query':rel.set('Target',rel.get('Target')+'?x')
     elif defect=='backslash':rel.set('Target','notes'+chr(92)+'bad.xml')
     elif defect=='missing':rel.set('Target','notes/missing.xml')
     elif defect=='duplicate-kind':other=copy.deepcopy(rel);other.set('Id','other');root.append(other)
     elif defect=='duplicate-id':next(r for r in root if r is not rel).set('Id',rel.get('Id'))
     return _serialize_xml(root)
    if defect=='wrong-mime' and name=='[Content_Types].xml':return data.replace((kind+'s+xml').encode(),b'comments+xml')
    if defect=='wrong-root' and name==part:return data.replace(('<w:'+kind+'s').encode(),b'<w:wrong').replace(('</w:'+kind+'s>').encode(),b'</w:wrong>')
    return data
   rewrite(valid_after,'/bad-owner.docx',transform)
   if os.path.exists('/bad-output.docx'):os.unlink('/bad-output.docx')
   try:generate_tracked_document(before,'/bad-owner.docx','/bad-output.docx','events',True,True,True);raise AssertionError(defect+' exported')
   except ValueError:assert not os.path.exists('/bad-output.docx')
  for side in ['before','after']:
   path=before if side=='before' else valid_after;part=case['sources'][side]['expectedRawGraph']['mainNoteRelationship']['resolvedPart']
   def unlinked(name,data):
    if name!=part:return data
    root=ET.fromstring(data)
    for parent in root.iter():
     for child in list(parent):
      if child.tag==W+'hyperlink':
       index=list(parent).index(child);parent.remove(child)
       for offset,run in enumerate(list(child)):parent.insert(index+offset,run)
    return _serialize_xml(root)
   rewrite(path,'/unlinked.docx',unlinked)
   if os.path.exists('/bad-output.docx'):os.unlink('/bad-output.docx')
   try:generate_tracked_document('/unlinked.docx' if side=='before' else before,valid_after if side=='before' else '/unlinked.docx','/bad-output.docx','events',True,True,True);raise AssertionError('one-sided custom link exported')
   except ValueError as error:assert str(error)=='UNSUPPORTED_TRACKED_SOURCE_CUSTOM_NOTE_LINK_REVISION' and not os.path.exists('/bad-output.docx')
  a=extract_document_model(open(before,'rb').read(),True,True,'en');b=extract_document_model(open(valid_after,'rb').read(),True,True,'en');manifest=json.loads(worklazyComparisonManifestJson(a,b,True,True,True))
  for defect in ['owner-part','owner-rid','owner-target','before-part','after-part','omit-owners']:
   bad=copy.deepcopy(manifest)
   if defect=='owner-part':bad['noteFacts']['before']['owners'][0]['part']='word/forged.xml'
   elif defect=='owner-rid':bad['noteFacts']['after']['owners'][0]['rId']='forged'
   elif defect=='owner-target':bad['noteFacts']['before']['owners'][0]['rawTarget']='forged.xml'
   elif defect=='before-part':bad['noteProjection']['partActions'][0]['beforePart']=bad['noteProjection']['partActions'][0]['afterPart']
   elif defect=='after-part':bad['noteProjection']['partActions'][0]['afterPart']='word/forged.xml'
   else:bad['noteFacts']['before']['owners']=[]
   if os.path.exists('/bad-output.docx'):os.unlink('/bad-output.docx')
   try:generate_tracked_document(before,valid_after,'/bad-output.docx','events',True,True,True,json.dumps(bad));raise AssertionError(defect+' exported')
   except ValueError:assert not os.path.exists('/bad-output.docx')
 else:
  for defect in ['missing-num','duplicate-num','missing-abstract','duplicate-abstract','non-decimal','wrong-label','wrong-level','missing-relation','missing-part','wrong-mime','wrong-root']:
   def transform(name,data):
    if name=='word/numbering.xml':
     if defect=='missing-part':return None
     if defect=='wrong-root':return data.replace(b'<w:numbering',b'<w:wrong').replace(b'</w:numbering>',b'</w:wrong>')
     root=ET.fromstring(data);number=next(n for n in root.findall(W+'num') if n.get(W+'numId')=='5');abstract=next(n for n in root.findall(W+'abstractNum') if n.get(W+'abstractNumId')=='3')
     if defect=='missing-num':root.remove(number)
     elif defect=='duplicate-num':root.append(copy.deepcopy(number))
     elif defect=='missing-abstract':root.remove(abstract)
     elif defect=='duplicate-abstract':root.append(copy.deepcopy(abstract))
     elif defect=='non-decimal':abstract.find(W+'lvl/'+W+'numFmt').set(W+'val','bullet')
     elif defect=='wrong-label':abstract.find(W+'lvl/'+W+'lvlText').set(W+'val','%2.')
     elif defect=='wrong-level':abstract.find(W+'lvl').set(W+'ilvl','1')
     return _serialize_xml(root)
    if defect=='wrong-mime' and name=='[Content_Types].xml':return data.replace(b'wordprocessingml.numbering+xml',b'wordprocessingml.comments+xml')
    if defect=='missing-relation' and name=='word/_rels/document.xml.rels':
     root=ET.fromstring(data);root.remove(next(r for r in root if r.get('Type')==RNS+'/numbering'));return _serialize_xml(root)
    return data
   rewrite(before,'/bad-numbering.docx',transform)
   if os.path.exists('/bad-output.docx'):os.unlink('/bad-output.docx')
   try:generate_tracked_document('/bad-numbering.docx',after,'/bad-output.docx','events',True,True,True);raise AssertionError(defect+' exported')
   except ValueError:assert not os.path.exists('/bad-output.docx')
json.dumps(rows)
`));
console.log(JSON.stringify(rows,null,2));console.log('22 numbering dependency guards +20 owner-path guards +4 one-sided link guards +12 forged source-owner/actions refused');
assert.equal(rows.filter(row=>row.status==='literal-policy-endpoints-pass').length,14);assert.equal(rows.filter(row=>row.status==='paired-changed-target-A5-refused').length,2);
fs.mkdirSync('docs/jobs/todo/diffchecker-port-20261023/note-dependency-packages',{recursive:true});for(const name of py.FS.readdir('/dependency-artifacts').filter(n=>n.endsWith('.docx')))fs.writeFileSync('docs/jobs/todo/diffchecker-port-20261023/note-dependency-packages/'+name,py.FS.readFile('/dependency-artifacts/'+name));
