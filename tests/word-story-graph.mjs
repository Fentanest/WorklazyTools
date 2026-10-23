import assert from 'node:assert/strict';import fs from 'node:fs';import {loadPyodide} from 'pyodide';
import {compareDocumentModels,diffText} from '../src/features/document-compare/documentComparison.ts';
let last,requested={fontFamily:true,size:true,style:true,color:true,paragraph:true,numbering:true};
globalThis.worklazyDiffJson=(a,b)=>JSON.stringify(diffText(a,b));
globalThis.worklazyComparisonManifestJson=(a,b,formatting,tables,metadata)=>{last=compareDocumentModels('before','after',JSON.parse(a),JSON.parse(b),{formatting,tables,metadata,formattingMask:requested},'en');return JSON.stringify(last.manifest)};
const py=await loadPyodide();py.globals.set('WORKLAZY_FORMATTING_POLICY_JSON',fs.readFileSync('src/features/word-compare/formatting-policy.json','utf8'));
for(const name of ['compare','accept_revisions','tracked_docx'])py.runPython(fs.readFileSync(`src/features/word-compare/${name}.py`,'utf8'));
// Reuse only source-package constructors and the independent author-scoped
// rejection oracle; none of the old case answers is regenerated.
const harness=fs.readFileSync('tests/word-package-events.mjs','utf8');py.runPython(harness.slice(harness.indexOf('registry=dict(ET._namespace_map)'),harness.indexOf('checks=[]')));
py.runPython(String.raw`
import shutil
os.makedirs('/story-packages',exist_ok=True)
def rewrite(path,entries):
 with zipfile.ZipFile(path,'w') as z:
  for name,data in entries.items():z.writestr(name,data)
def source(path,story,part,kind='header',size='20',margin='100',comment=False):
 body=p(text('Body stable'));header=p('<w:r><w:rPr><w:sz w:val="'+size+'"/></w:rPr><w:t>Story '+story+'</w:t>'+('<w:commentReference w:id="7"/>' if comment else '')+image()+'</w:r>'+link(' destination')) if story is not None else None
 package(path,body,OLDPNG if size=='20' else NEWPNG,'https://'+('before' if size=='20' else 'after')+'.example/story',header)
 with zipfile.ZipFile(path) as z:entries={name:z.read(name) for name in z.namelist()}
 root=ET.fromstring(entries['word/document.xml']);section=root.find('.//'+W+'sectPr')
 if section is None:section=ET.SubElement(root.find(W+'body'),W+'sectPr')
 ET.SubElement(section,W+'pgMar',{W+'top':margin});entries['word/document.xml']=_serialize_xml(root)
 if story is not None:
  root=ET.fromstring(entries.pop('word/header1.xml'));root.tag=W+('hdr' if kind=='header' else 'ftr');entries[part]=_serialize_xml(root)
  rels=ET.fromstring(entries.pop('word/_rels/header1.xml.rels'))
  for rel in rels:
   if rel.get('TargetMode')!='External':rel.set('Target',posixpath.relpath('word/media/image1.png',posixpath.dirname(part)))
  entries[posixpath.join(posixpath.dirname(part),'_rels',posixpath.basename(part)+'.rels')]=_serialize_xml(rels)
  rels=ET.fromstring(entries['word/_rels/document.xml.rels'])
  for rel in rels:
   if rel.get('Type')==REL+'header':rel.set('Target',posixpath.relpath(part,'word'));rel.set('Type',REL+kind)
  entries['word/_rels/document.xml.rels']=_serialize_xml(rels)
  root=ET.fromstring(entries['word/document.xml'])
  for ref in root.iter(W+'headerReference'):ref.tag=W+kind+'Reference'
  entries['word/document.xml']=_serialize_xml(root)
  types=ET.fromstring(entries['[Content_Types].xml'])
  for node in types:
   if node.get('PartName')=='/word/header1.xml':node.set('PartName','/'+part);node.set('ContentType','application/vnd.openxmlformats-officedocument.wordprocessingml.'+kind+'+xml')
  entries['[Content_Types].xml']=_serialize_xml(types)
 rewrite(path,entries)
def rels_of(z,part):
 path=posixpath.join(posixpath.dirname(part),'_rels',posixpath.basename(part)+'.rels')
 root=ET.fromstring(z.read(path)) if path in z.namelist() else []
 ids=[node.get('Id') for node in root];assert len(ids)==len(set(ids))
 return {node.get('Id'):node for node in root}
def resolve(part,target):return target.lstrip('/') if target.startswith('/') else posixpath.normpath(posixpath.join(posixpath.dirname(part),target))
def payload(z,part):
 relations=rels_of(z,part);root=ET.fromstring(z.read(part));events=[]
 for paragraph in root.iter(W+'p'):
  row=[]
  def walk(node):
   if node.tag==W+'drawing':
    blip=node.find('.//{http://schemas.openxmlformats.org/drawingml/2006/main}blip');rel=relations[blip.get(R+'embed')];assert rel.get('Type')==REL+'image'
    target=resolve(part,rel.get('Target'));row.append(('image',hashlib.sha256(z.read(target)).hexdigest()));return
   if node.tag==W+'hyperlink':
    rel=relations[node.get(R+'id')];assert rel.get('Type')==REL+'hyperlink';value=''.join(t.text or '' for t in node.iter(W+'t'))
    if value:row.append(('link',rel.get('Target'),value))
    return
   if node.tag==W+'t':
    if row and row[-1][0]=='text':row[-1]=('text',row[-1][1]+(node.text or ''))
    elif node.text:row.append(('text',node.text))
    return
   for child in node:walk(child)
  walk(paragraph);events.append(row)
 return events
def reachable(path):
 with zipfile.ZipFile(path) as z:
  root=ET.fromstring(z.read('word/document.xml'));section=root.find(W+'body/'+W+'sectPr');relations=rels_of(z,'word/document.xml');result={}
  if section is None:return result
  for ref in section:
   if ref.tag not in (W+'headerReference',W+'footerReference'):continue
   kind='header' if ref.tag==W+'headerReference' else 'footer';rel=relations[ref.get(R+'id')];assert rel.get('Type')==REL+kind
   part=resolve('word/document.xml',rel.get('Target'));result[(kind,ref.get(W+'type'))]=payload(z,part)
  return result
def rejected(source,target):
 with zipfile.ZipFile(source) as src,zipfile.ZipFile(target,'w') as out:
  parts={'word/document.xml'}|{resolve('word/document.xml',rel.get('Target')) for rel in rels_of(src,'word/document.xml').values() if rel.get('Type') in (REL+'header',REL+'footer')}
  for info in src.infolist():out.writestr(info,_serialize_xml(reject(_qname_safe_parse(src.read(info.filename)))[0]) if info.filename in parts else src.read(info.filename))
def margin(path):
 with zipfile.ZipFile(path) as z:return ET.fromstring(z.read('word/document.xml')).find('.//'+W+'sectPr/'+W+'pgMar').get(W+'top')
`);
let count=0,unsupported=0;
for(const mode of ['before-only','after-only','renamed-paired'])for(const kind of ['header','footer'])for(const [formatting,metadata,paragraph] of [[true,true,true],[false,true,true],[true,true,false],[true,false,true]]){
 requested={...requested,paragraph};py.globals.set('mask_json',JSON.stringify(requested));py.globals.set('mode',mode);py.globals.set('kind',kind);py.globals.set('formatting',formatting);py.globals.set('metadata',metadata);py.globals.set('paragraph',paragraph);
 py.runPython(String.raw`
source('/story-before.docx',None if mode=='after-only' else 'original','word/source/'+kind+'-old.xml',kind,'20','100')
source('/story-after.docx',None if mode=='before-only' else 'revised','word/custom/'+kind+'-new.xml',kind,'40','200')
a=extract_document_model(open('/story-before.docx','rb').read(),True,True,'en');b=extract_document_model(open('/story-after.docx','rb').read(),True,True,'en');manifest=worklazyComparisonManifestJson(a,b,formatting,True,metadata)
if os.path.exists('/story-out.docx'):os.unlink('/story-out.docx')
if mode!='renamed-paired' and metadata:
 try:generate_tracked_document('/story-before.docx','/story-after.docx','/story-out.docx','events',formatting,True,metadata,manifest,mask_json);raise AssertionError('unsupported binding change accepted')
 except ValueError as error:assert 'UNSUPPORTED_TRACKED_SOURCE_STORY' in str(error)
 assert not os.path.exists('/story-out.docx')
 for variant in ['before','after']:shutil.copyfile('/story-'+variant+'.docx','/story-packages/refused-'+mode+'-'+kind+'-'+str(formatting)+'-'+str(paragraph)+'-'+variant+'.docx')
else:
 generate_tracked_document('/story-before.docx','/story-after.docx','/story-out.docx','events',formatting,True,metadata,manifest,mask_json)
 accept_tracked_document('/story-out.docx','/story-accepted.docx');rejected('/story-out.docx','/story-rejected.docx')
 assert reachable('/story-accepted.docx')==reachable('/story-after.docx'),(mode,kind,'accept',reachable('/story-accepted.docx'),reachable('/story-after.docx'))
 assert reachable('/story-rejected.docx')==reachable('/story-before.docx' if metadata else '/story-after.docx'),(mode,kind,'reject',reachable('/story-rejected.docx'),reachable('/story-before.docx'))
 assert margin('/story-accepted.docx')=='200'
 assert margin('/story-rejected.docx')==('100' if formatting and paragraph else '200')
 with zipfile.ZipFile('/story-out.docx') as z:
  root=ET.fromstring(z.read('word/document.xml'));assert len(list(root.iter(W+'sectPrChange')))<=1
  for previous in root.findall('.//'+W+'sectPrChange/'+W+'sectPr'):assert previous.find(W+'headerReference') is None and previous.find(W+'footerReference') is None
 name=mode+'-'+kind+'-'+str(formatting)+'-'+str(metadata)+'-'+str(paragraph)
 for variant in ['before','after','out','accepted','rejected']:shutil.copyfile('/story-'+variant+'.docx','/story-packages/'+name+'-'+variant+'.docx')
`);if(mode!=='renamed-paired'&&metadata)unsupported++;else count++;
}
requested={fontFamily:true,size:true,style:true,color:true,paragraph:true,numbering:true};py.globals.set('mask_json',JSON.stringify(requested));
py.runPython(String.raw`
# Same local IDs in body/header must resolve relative to their source AND
# destination owners. Different resources/URLs deliberately collide by ID.
for side,size,color in [('before','20',(0,255,0)),('after','40',(255,255,0))]:
 part='word/'+side+'/collision-header.xml';source('/owner-'+side+'.docx',side,part,'header',size,'100')
 with zipfile.ZipFile('/owner-'+side+'.docx') as z:entries={name:z.read(name) for name in z.namelist()}
 root=ET.fromstring(entries['word/document.xml']);body=root.find(W+'body');body[0]=ET.fromstring('<w:root'+NS+'>'+p(text('Body '+side)+ '<w:r>'+image()+'</w:r>'+link(' body link'))+'</w:root>')[0];entries['word/document.xml']=_serialize_xml(root)
 header_rels='word/'+side+'/_rels/collision-header.xml.rels';rels=ET.fromstring(entries[header_rels])
 for rel in rels:
  if rel.get('Type')==REL+'image':rel.set('Target','../media/header.png')
  else:rel.set('Target','https://header-'+side+'.example/')
 entries[header_rels]=_serialize_xml(rels);entries['word/media/header.png']=png(color)
 rels=ET.fromstring(entries['word/_rels/document.xml.rels'])
 for rel in rels:
  if rel.get('Type')==REL+'hyperlink':rel.set('Target','https://body-'+side+'.example/')
 entries['word/_rels/document.xml.rels']=_serialize_xml(rels);rewrite('/owner-'+side+'.docx',entries)
a=extract_document_model(open('/owner-before.docx','rb').read(),True,True,'en');b=extract_document_model(open('/owner-after.docx','rb').read(),True,True,'en');manifest=worklazyComparisonManifestJson(a,b,False,True,True)
generate_tracked_document('/owner-before.docx','/owner-after.docx','/owner-out.docx','events',False,True,True,manifest,mask_json)
accept_tracked_document('/owner-out.docx','/owner-accepted.docx');rejected('/owner-out.docx','/owner-rejected.docx')
assert reachable('/owner-accepted.docx')==reachable('/owner-after.docx')
assert reachable('/owner-rejected.docx')==reachable('/owner-before.docx')
for actual,expected in [('accepted','after'),('rejected','before')]:
 with zipfile.ZipFile('/owner-'+actual+'.docx') as x,zipfile.ZipFile('/owner-'+expected+'.docx') as y:assert payload(x,'word/document.xml')==payload(y,'word/document.xml')
for variant in ['before','after','out','accepted','rejected']:shutil.copyfile('/owner-'+variant+'.docx','/story-packages/owner-collision-'+variant+'.docx')
# All mutations use a valid source pair; no Python matching/recovery is allowed.
value=json.loads(manifest)
for mutation in ['facts','missing-pair','duplicate-pair','before-owner','output-owner','binding','decision','coverage']:
 bad=copy.deepcopy(value)
 if mutation=='facts':bad['storyFacts']['before']['parts'][0]['sha256']='forged'
 elif mutation=='missing-pair':bad['storyProjection']['pairs'].clear()
 elif mutation=='duplicate-pair':bad['storyProjection']['pairs']*=2
 elif mutation=='before-owner':bad['storyProjection']['pairs'][0]['beforePart']='word/document.xml'
 elif mutation=='output-owner':bad['storyProjection']['pairs'][0]['afterPart']='word/document.xml'
 elif mutation=='binding':bad['storyProjection']['bindings'][0]['storyId']='unknown'
 elif mutation=='decision':bad['storyProjection']['pairs'][0]['decisionIds'].clear()
 else:bad['storyProjection']['pairs'][0]['coverage']['before'].clear()
 if os.path.exists('/bad.docx'):os.unlink('/bad.docx')
 try:generate_tracked_document('/owner-before.docx','/owner-after.docx','/bad.docx','events',False,True,True,json.dumps(bad),mask_json);raise AssertionError(mutation+' accepted')
 except ValueError as error:assert 'INVALID_COMPARISON_MANIFEST_STORY' in str(error)
 assert not os.path.exists('/bad.docx')
# E4 mixed reference runs must retain their visible payload when anchors strip.
clean=_accepted_copy(ET.fromstring('<w:hdr'+NS+'>'+p('<w:r><w:t>Kept text</w:t><w:commentReference w:id="7"/></w:r>')+'</w:hdr>'))
assert ''.join(node.text or '' for node in clean.iter(W+'t'))=='Kept text'
assert not list(clean.iter(W+'commentReference'))
`);
console.log('Distinct body/header source/output owner resources +8 source-bound negatives +mixed-comment glyph retention passed');
py.runPython(String.raw`
# Concrete two-section counterexample to the donor's persistent empty-ref
# representation: absent final binding inherits A; explicit empty suppresses A.
source('/inherit-after.docx','Common inherited','word/custom/common.xml','header','40','200')
with zipfile.ZipFile('/inherit-after.docx') as z:entries={name:z.read(name) for name in z.namelist()}
root=ET.fromstring(entries['word/document.xml']);body=root.find(W+'body');final=body.find(W+'sectPr');reference=final.find(W+'headerReference');final.remove(reference)
first=ET.Element(W+'p');props=ET.SubElement(first,W+'pPr');section=ET.SubElement(props,W+'sectPr');section.append(reference);first.append(ET.fromstring('<w:root'+NS+'>'+text('Section one')+'</w:root>')[0]);body.insert(0,first)
entries['word/document.xml']=_serialize_xml(root);rewrite('/inherit-after.docx',entries)
before=copy.deepcopy(entries);root=ET.fromstring(before['word/document.xml']);ET.SubElement(root.find(W+'body/'+W+'sectPr'),W+'headerReference',{W+'type':'default',R+'id':'rIdRemoved'})
before['word/document.xml']=_serialize_xml(root);rels=ET.fromstring(before['word/_rels/document.xml.rels']);ET.SubElement(rels,PR+'Relationship',{'Id':'rIdRemoved','Type':REL+'header','Target':'source/removed.xml'});before['word/_rels/document.xml.rels']=_serialize_xml(rels)
before['word/source/removed.xml']=('<w:hdr'+NS+'>'+p(text('Removed second header'))+'</w:hdr>').encode();types=ET.fromstring(before['[Content_Types].xml']);ET.SubElement(types,CT+'Override',{'PartName':'/word/source/removed.xml','ContentType':'application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml'});before['[Content_Types].xml']=_serialize_xml(types);rewrite('/inherit-before.docx',before)
donor=copy.deepcopy(before);root=ET.fromstring(donor['word/document.xml']);donor['word/document.xml']=_serialize_xml(root);donor['word/source/removed.xml']=('<w:hdr'+NS+'>'+p('')+'</w:hdr>').encode();rewrite('/inherit-donor-accepted.docx',donor)
def effective(path):
 with zipfile.ZipFile(path) as z:
  state={};result=[];relations=rels_of(z,'word/document.xml')
  for section in ET.fromstring(z.read('word/document.xml')).iter(W+'sectPr'):
   for ref in section:
    if ref.tag==W+'headerReference':state[ref.get(W+'type')]=payload(z,resolve('word/document.xml',relations[ref.get(R+'id')].get('Target')))
   result.append(copy.deepcopy(state))
  return result
actual=effective('/inherit-after.docx');wrong=effective('/inherit-donor-accepted.docx');assert actual[1]!=wrong[1]
print(json.dumps({'twoSectionDonorCounterexample':True,'afterInheritedHeader':actual[1],'persistentEmptyAccepted':wrong[1]}))
if os.path.exists('/bad.docx'):os.unlink('/bad.docx')
try:generate_tracked_document('/inherit-before.docx','/inherit-after.docx','/bad.docx','events',False,True,True,None,mask_json);raise AssertionError('complex binding changed accepted')
except ValueError as error:assert 'UNSUPPORTED_TRACKED_SOURCE' in str(error)
assert not os.path.exists('/bad.docx')
for variant in ['before','after','donor-accepted']:shutil.copyfile('/inherit-'+variant+'.docx','/story-packages/two-section-'+variant+'.docx')
`);
fs.mkdirSync('docs/jobs/todo/diffchecker-port-20261023/story-packages',{recursive:true});for(const name of py.FS.readdir('/story-packages').filter(name=>name.endsWith('.docx')))fs.writeFileSync('docs/jobs/todo/diffchecker-port-20261023/story-packages/'+name,py.FS.readFile('/story-packages/'+name));
console.log(count+' reachable-story/margin scope exports +'+unsupported+' schema-bound binding presence refusals passed');

fs.writeFileSync('docs/jobs/todo/diffchecker-port-20261023/word-story-current-files.json',JSON.stringify(py.FS.readdir('/story-packages').filter(name=>name.endsWith('.docx')).sort(),null,2)+'\n');
