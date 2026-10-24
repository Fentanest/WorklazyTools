import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadPyodide} from 'pyodide';
import {compareDocumentModels,diffText} from '../src/features/document-compare/documentComparison.ts';
let last,requested;
globalThis.worklazyDiffJson=(a,b)=>JSON.stringify(diffText(a,b));
globalThis.worklazyComparisonManifestJson=(a,b,formatting,tables,metadata)=>{last=compareDocumentModels('before','after',JSON.parse(a),JSON.parse(b),{formatting,tables,metadata,formattingMask:requested},'en');return JSON.stringify(last.manifest)};
const py=await loadPyodide();
py.globals.set('WORKLAZY_FORMATTING_POLICY_JSON',fs.readFileSync('src/features/word-compare/formatting-policy.json','utf8'));
for(const name of ['compare','accept_revisions','tracked_docx'])py.runPython(fs.readFileSync(`src/features/word-compare/${name}.py`,'utf8'));
py.runPython(fs.readFileSync('tests/word-note-fixtures.py','utf8').replace("if __name__=='__main__':","if False:"));
const harness=fs.readFileSync('tests/word-package-events.mjs','utf8');py.runPython(harness.slice(harness.indexOf('def reject(node):'),harness.indexOf('def view(')));
py.globals.set('describe_manifest',()=>JSON.stringify(last.manifest.decisions.map(d=>({type:d.type,before:d.beforeText,after:d.afterText,shape:[d.before.length,d.after.length],moved:d.moved}))));
py.globals.set('select_size',enabled=>{requested={fontFamily:true,size:enabled,style:true,color:true,paragraph:true,numbering:true};});
const results=JSON.parse(py.runPython(`
import os,shutil
os.makedirs('/note-structure',exist_ok=True)
results=[]
source_run=run
run=lambda text:source_run(text) if text else ''
def note_graph(path,kind):
 rows=reachable(path,kind)
 for row in rows:
  events=[]
  for event in row['events']:
   if event[0]=='text' and events and events[-1][0]=='text':events[-1][1]+=event[1]
   else:events.append(event)
  row['events']=events
 return rows
def body_text(path):
 with zipfile.ZipFile(path) as z:return [''.join(p.itertext()) for p in ET.fromstring(z.read('word/document.xml')).find(W+'body').findall(W+'p')]
for kind in ['footnote','endnote']:
 for axis in ['split','merge','move']:
  for cursor in [0,16,32]:
   for formatting in [False,True]:
    old='First sentence. Second sentence.';new=old
    oldruns=run(old[:cursor])+reference(kind,7)+run(old[cursor:])
    left=run(old[:16])+(reference(kind,9) if cursor<=16 else '')
    right=(reference(kind,9) if cursor>16 else '')+run(old[16:])
    if cursor<16:left=run(old[:cursor])+reference(kind,9)+run(old[cursor:16])
    if cursor>16:right=run(old[16:cursor])+reference(kind,9)+run(old[cursor:])
    before=paragraph(oldruns);after=paragraph(left)+paragraph(right)
    if axis=='merge':before,after=after.replace('w:id="9"','w:id="7"'),before.replace('w:id="7"','w:id="9"')
    if axis=='move':before=paragraph(oldruns)+paragraph(run('Second distinct paragraph'));after=paragraph(run('Second distinct paragraph'))+paragraph(oldruns.replace('w:id="7"','w:id="9"'))
    payload=lambda identity,value:note(identity,value,kind).replace('</w:p>','<w:hyperlink r:id="rIdShared">'+run('Link')+'</w:hyperlink><w:r>'+drawing()+'</w:r></w:p>')
    package('/structure-before.docx',before,[payload(7,'Old note')],kind,resources=True)
    package('/structure-after.docx',after,[payload(9,'New note')],kind,resources=True)
    name=kind+'-'+axis+'-'+str(cursor)+'-'+str(formatting)
    try:
     generate_tracked_document('/structure-before.docx','/structure-after.docx','/structure-out.docx','events',formatting,True,True)
     accept_tracked_document('/structure-out.docx','/structure-accepted.docx')
     with zipfile.ZipFile('/structure-out.docx') as source,zipfile.ZipFile('/structure-rejected.docx','w') as output:
      for entry in source.infolist():output.writestr(entry,_serialize_xml(reject(_qname_safe_parse(source.read(entry.filename)))[0]) if entry.filename in ['word/document.xml','word/'+kind+'s.xml'] else source.read(entry.filename))
     assert body_text('/structure-accepted.docx')==body_text('/structure-after.docx'),('accept text',body_text('/structure-accepted.docx'))
     assert body_text('/structure-rejected.docx')==body_text('/structure-before.docx'),('reject text',body_text('/structure-rejected.docx'))
     assert note_graph('/structure-accepted.docx',kind)==note_graph('/structure-after.docx',kind),'accept notes'
     assert note_graph('/structure-rejected.docx',kind)==note_graph('/structure-before.docx',kind),'reject notes'
     for variant in ['before','after','out','accepted','rejected']:shutil.copyfile('/structure-'+variant+'.docx','/note-structure/'+name+'-'+variant+'.docx')
     a=extract_document_model(open('/structure-before.docx','rb').read(),True,True,'en');b=extract_document_model(open('/structure-after.docx','rb').read(),True,True,'en');manifest=json.loads(worklazyComparisonManifestJson(a,b,formatting,True,True))
     for defect in ['context','reference','decision','property-pair']:
      bad=copy.deepcopy(manifest);ref=bad['noteProjection']['references'][0]
      decision=next(d for d in bad['decisions'] if d['id']==ref['decisionId'])
      if defect=='reference':ref[next(side for side in ['before','after'] if side in ref)]['objectEvent']['start']+=1
      elif defect=='decision':ref['decisionId']=next(d['id'] for d in bad['decisions'] if any(ref['part']=='word/'+kind+'s.xml' for side in ['before','after'] for ref in d[side]))
      elif defect=='context':decision['objectEvents']['contexts'][0]['offset']+=1
      else:decision['objectEvents']['drawingProperties']=[];decision['objectEvents']['before']=[];decision['objectEvents']['after']=[]
      if os.path.exists('/forged-structure.docx'):os.unlink('/forged-structure.docx')
      try:generate_tracked_document('/structure-before.docx','/structure-after.docx','/forged-structure.docx','events',formatting,True,True,json.dumps(bad));raise AssertionError(defect+' accepted')
      except ValueError:assert not os.path.exists('/forged-structure.docx')
     results.append({'name':name,'pass':True,'sourceAxes':json.loads(describe_manifest())})
    except Exception as error:results.append({'name':name,'pass':False,'error':str(error),'decisions':json.loads(describe_manifest())})
json.dumps(results)
`));
for(const result of results.filter(result=>result.pass)){const axis=result.name.split('-')[1];assert.ok(result.sourceAxes.some(d=>axis==='move'?d.moved:JSON.stringify(d.shape)===JSON.stringify(axis==='split'?[1,2]:[2,1])),`Expected actual ${axis} source decision`);}
console.log(JSON.stringify(results,null,2));
assert.equal(results.filter(result=>!result.pass).length,0);
py.runPython(`
def special_graph(path,kind):
 with zipfile.ZipFile(path) as z:
  part='word/'+kind+'s.xml';root=ET.fromstring(z.read(part))
  relpath='word/_rels/'+kind+'s.xml.rels';rels={r.get('Id'):r.get('Target') for r in ET.fromstring(z.read(relpath))} if relpath in z.namelist() else {}
  def canonical(node):return None if node is None or (node.tag in {W+'pPr',W+'rPr'} and not node.attrib and not list(node)) else (node.tag,sorted(node.attrib.items()),node.text or '',[canonical(c) for c in node])
  result=[]
  for special in root:
   if special.get(W+'type','normal')=='normal':continue
   paragraphs=[]
   for p in special.findall(W+'p'):
    chars=[(c,canonical(r.find(W+'rPr'))) for r in p.iter(W+'r') for c in _element_text(r)]
    controls=[canonical(c) for c in p.iter() if c.tag in {W+'separator',W+'continuationSeparator',W+'continuationNotice'}]
    links=[(rels.get(link.get(R+'id')),_element_text(link)) for link in p.iter(W+'hyperlink')]
    paragraphs.append((canonical(p.find(W+'pPr')),chars,controls,links))
   result.append((special.get(W+'type'),paragraphs))
  return result
checks=0
for kind in ['footnote','endnote']:
 for scenario in ['renumber','properties-off','properties-on','properties-mask','role','missing','text','metadata-off','volatile-rel','control-style','control-mixed','duplicate','control-missing','negative-ids']:
  before_special=note(77,'Separator',kind,'separator').replace('</w:p>','<w:r><w:'+('separator')+'/></w:r></w:p>')
  after_special=before_special.replace('w:id="77"','w:id="88"')
  if scenario=='negative-ids':
   before_special=before_special.replace('w:id="77"','w:id="-1"');after_special=after_special.replace('w:id="88"','w:id="-9"')
  if scenario.startswith('properties'):after_special=after_special.replace('<w:r><w:t>','<w:r><w:rPr><w:sz w:val="40"/></w:rPr><w:t>')
  if scenario in ['role','metadata-off']:after_special=after_special.replace('separator','continuationSeparator')
  if scenario=='text':after_special=after_special.replace('Separator','CHANGED SEPARATOR')
  if scenario=='control-style':after_special=after_special.replace('<w:r><w:separator/>','<w:r><w:rPr><w:sz w:val="40"/></w:rPr><w:separator/>')
  if scenario=='control-mixed':after_special=after_special.replace('<w:r><w:separator/></w:r>','').replace('<w:t>Separator','<w:separator/><w:t>Separator')
  if scenario=='control-missing':after_special=after_special.replace('<w:r><w:separator/></w:r>','')
  if scenario=='duplicate':after_special+=after_special.replace('w:id="88"','w:id="89"')
  if scenario=='volatile-rel':
   before_special=before_special.replace('</w:p>','<w:hyperlink r:id="rIdShared">'+run('Link')+'</w:hyperlink></w:p>')
   after_special=before_special.replace('w:id="77"','w:id="88"').replace('rIdShared','rIdRenumbered')
  package('/paired-special-before.docx',paragraph(run('Anchor')+reference(kind,1)),[before_special,note(1,'Same note',kind)],kind,resources=scenario=='volatile-rel')
  package('/paired-special-after.docx',paragraph(run('Anchor')+reference(kind,9)),([] if scenario=='missing' else [after_special])+[note(9,'Same note',kind)],kind,resources=scenario=='volatile-rel')
  if scenario=='volatile-rel':
   with zipfile.ZipFile('/paired-special-after.docx') as z:entries={n:z.read(n) for n in z.namelist()}
   relpath='word/_rels/'+kind+'s.xml.rels';entries[relpath]=entries[relpath].replace(b'rIdShared',b'rIdRenumbered')
   with zipfile.ZipFile('/paired-special-after.docx','w') as z:
    for n,data in entries.items():z.writestr(n,data)
  select_size(scenario!='properties-mask')
  mask={name:True for name in ['fontFamily','size','style','color','paragraph','numbering']};mask['size']=scenario!='properties-mask'
  supported=scenario in ['negative-ids','renumber','properties-off','properties-on','properties-mask','text','metadata-off','volatile-rel'];formatting=scenario!='properties-off';metadata=scenario!='metadata-off'
  if os.path.exists('/paired-special-out.docx'):os.unlink('/paired-special-out.docx')
  try:
   generate_tracked_document('/paired-special-before.docx','/paired-special-after.docx','/paired-special-out.docx','events',formatting,True,metadata,formatting_mask_json=json.dumps(mask))
   assert supported,(scenario,'unsafe included special difference exported')
   accept_tracked_document('/paired-special-out.docx','/paired-special-accepted.docx')
   assert note_graph('/paired-special-accepted.docx',kind)==note_graph('/paired-special-after.docx',kind)
   with zipfile.ZipFile('/paired-special-out.docx') as source,zipfile.ZipFile('/paired-special-rejected.docx','w') as output:
    for entry in source.infolist():output.writestr(entry,_serialize_xml(reject(_qname_safe_parse(source.read(entry.filename)))[0]) if entry.filename in ['word/document.xml','word/'+kind+'s.xml'] else source.read(entry.filename))
   assert special_graph('/paired-special-accepted.docx',kind)==special_graph('/paired-special-after.docx',kind),(kind,scenario,'accept special')
   target='after' if scenario in ['properties-off','properties-mask','metadata-off','volatile-rel'] else 'before'
   assert special_graph('/paired-special-rejected.docx',kind)==special_graph('/paired-special-'+target+'.docx',kind),(kind,scenario,'reject special',special_graph('/paired-special-rejected.docx',kind),special_graph('/paired-special-'+target+'.docx',kind))
   if scenario in ['text','properties-on']:
    a=extract_document_model(open('/paired-special-before.docx','rb').read(),True,True,'en');b=extract_document_model(open('/paired-special-after.docx','rb').read(),True,True,'en');manifest=json.loads(worklazyComparisonManifestJson(a,b,formatting,True,metadata))
    check=manifest['noteProjection']['specialChecks'][0];assert check['redline'] and not check['includedEqual']
    pair=next(pair for pair in manifest['noteProjection']['pairs'] if pair['before']['type']=='separator');assert pair['decisionIds'] and pair['before']['id']!=pair['after']['id']
    decision=next(d for d in manifest['decisions'] if d['id']==pair['decisionIds'][0]);assert decision['beforeText']=='Separator' and decision['afterText']==('CHANGED SEPARATOR' if scenario=='text' else 'Separator')
    for defect in ['omit-pair','false-redline','false-equal','source-shape','omit-decision']:
     bad=copy.deepcopy(manifest)
     if defect=='omit-pair':bad['noteProjection']['pairs'].remove(next(p for p in bad['noteProjection']['pairs'] if p['before']['type']=='separator'))
     elif defect=='false-redline':bad['noteProjection']['specialChecks'][0]['redline']=False
     elif defect=='false-equal':bad['noteProjection']['specialChecks'][0]['includedEqual']=True
     elif defect=='source-shape':bad['noteFacts']['before']['containers'][0]['specialRevisionShape']=[]
     else:bad['decisions']=[d for d in bad['decisions'] if d['id']!=pair['decisionIds'][0]]
     if os.path.exists('/bad-special.docx'):os.unlink('/bad-special.docx')
     try:generate_tracked_document('/paired-special-before.docx','/paired-special-after.docx','/bad-special.docx','events',formatting,True,metadata,json.dumps(bad),json.dumps(mask));raise AssertionError(defect+' exported')
     except ValueError:assert not os.path.exists('/bad-special.docx')

  except ValueError as error:
   assert not supported,(scenario,str(error))
   assert str(error)=='UNSUPPORTED_TRACKED_SOURCE_NOTE_SPECIAL' and not os.path.exists('/paired-special-out.docx')
   a=extract_document_model(open('/paired-special-before.docx','rb').read(),True,True,'en');b=extract_document_model(open('/paired-special-after.docx','rb').read(),True,True,'en');manifest=json.loads(worklazyComparisonManifestJson(a,b,formatting,True,metadata))
   assert not manifest['noteProjection']['supported'] and 'unsupported-paired-note-special' in manifest['noteProjection']['reasons']
   for defect in ['force-equal','omit-check','source']:
    bad=copy.deepcopy(manifest);bad['noteProjection']['supported']=True;bad['noteProjection']['reasons']=[]
    if defect=='force-equal':
     for check in bad['noteProjection']['specialChecks']:check['includedEqual']=True
    elif defect=='omit-check':bad['noteProjection']['specialChecks']=[]
    else:bad['noteProjection']['specialChecks'][0]['before'][0]['source']['path']=[999]
    try:generate_tracked_document('/paired-special-before.docx','/paired-special-after.docx','/paired-special-out.docx','events',formatting,True,metadata,json.dumps(bad),json.dumps(mask));raise AssertionError(defect+' accepted')
    except ValueError:assert not os.path.exists('/paired-special-out.docx')
  for side in ['before','after']:shutil.copyfile('/paired-special-'+side+'.docx','/note-structure/'+kind+'-special-'+scenario+'-'+side+'.docx')
  if supported:
   for side in ['out','accepted','rejected']:shutil.copyfile('/paired-special-'+side+'.docx','/note-structure/'+kind+'-special-'+scenario+'-'+side+'.docx')
  checks+=1
select_size(True)
# The terminal-deletion codec admits reference payload only INSIDE deletion.
for kind in ['footnote','endnote']:
 for protected in [False,True]:
  body='<w:p><w:pPr><w:rPr><w:del w:id="1"/></w:rPr></w:pPr><w:del w:id="2">'+reference(kind,1)+'</w:del>'+(reference(kind,2) if protected else '')+'</w:p>'
  data=('<w:document xmlns:w="'+WNS+'"><w:body>'+body+'</w:body></w:document>').encode()
  root=ET.fromstring(_accept_xml(data));assert len(root.find(W+'body'))==(1 if protected else 0)
`);
console.log('28 paired special-role/property/mask/ID/resource scope cases +36 forged guards +20 forged redline actions +4 terminal-marker codec targets passed');

fs.mkdirSync('docs/jobs/todo/diffchecker-port-20261023/note-structure',{recursive:true});
for(const name of py.FS.readdir('/note-structure').filter(name=>name.endsWith('.docx')))fs.writeFileSync('docs/jobs/todo/diffchecker-port-20261023/note-structure/'+name,py.FS.readFile('/note-structure/'+name));
