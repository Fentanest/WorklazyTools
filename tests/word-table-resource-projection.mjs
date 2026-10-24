import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadPyodide} from 'pyodide';
import {compareDocumentModels,diffText} from '../src/features/document-compare/documentComparison.ts';
let last;
globalThis.worklazyDiffJson=(a,b)=>JSON.stringify(diffText(a,b));
globalThis.worklazyComparisonManifestJson=(a,b,formatting,tables,metadata)=>{last=compareDocumentModels('before','after',JSON.parse(a),JSON.parse(b),{formatting,tables,metadata},'en');return JSON.stringify(last.manifest)};
const py=await loadPyodide();py.globals.set('WORKLAZY_FORMATTING_POLICY_JSON',fs.readFileSync('src/features/word-compare/formatting-policy.json','utf8'));
for(const name of ['compare','accept_revisions','tracked_docx'])py.runPython(fs.readFileSync(`src/features/word-compare/${name}.py`,'utf8'));
const harness=fs.readFileSync('tests/word-package-events.mjs','utf8');py.runPython(harness.slice(harness.indexOf('def reject(node):'),harness.indexOf('def view(')));
py.runPython(fs.readFileSync('tests/word-future-resource-fixtures.py','utf8').replace("if __name__=='__main__':","if False:"));
py.runPython("note_oracle={};exec("+JSON.stringify(fs.readFileSync('tests/word-note-fixtures.py','utf8').replace("if __name__=='__main__':","if False:"))+",note_oracle)");
const result=JSON.parse(py.runPython(`
import shutil
os.makedirs('/table-projection',exist_ok=True)
legacy_reject=reject
source_grid_ids=set()
def reject(node):
 # Independent native table structure semantics: rejection removes inserted
 # rows/cells; a deleted cell survives and its own deletion marker is removed.
 if node.tag==W+'tr' and any(n.get(W+'author')=='events' for n in node.findall(W+'trPr/'+W+'ins')):return []
 if node.tag==W+'tc' and any(n.get(W+'author')=='events' for n in node.findall(W+'tcPr/'+W+'cellIns')):return []
 if node.tag==W+'cellDel' and node.get(W+'author')=='events':return []
 if node.tag==W+'tblGrid':
  change=node.find(W+'tblGridChange')
  if change is not None and change.get(W+'id') not in source_grid_ids:return [copy.deepcopy(change.find(W+'tblGrid'))]
 return legacy_reject(node)
def without_notes(value):
 if isinstance(value,list):return [without_notes(v) for v in value if not isinstance(v,dict) or 'footnote' not in v]
 if isinstance(value,dict):return {k:without_notes(v) for k,v in value.items()}
 return value
results=[]
cases=[case for case in build_fixtures('/table-sources') if case['name'].startswith('table-')]
for base in [case for case in cases if case['name'].endswith('-delete')]:
 case=copy.deepcopy(base);case['name']+='-collision';case['collision']=True
 for side,target,identity in [('before','expectedRejectGraph','8'),('after','expectedAcceptGraph','7')]:
  with zipfile.ZipFile(base[side]) as z:entries={n:z.read(n) for n in z.namelist()}
  body=ET.fromstring(entries['word/document.xml']);container=body.find(W+'body');container.insert(len(container)-2,ET.fromstring('<w:p'+NS+'>'+text('Retained ')+note_ref().replace('w:id="7"','w:id="'+identity+'"')+'</w:p>'))
  notes=ET.fromstring(entries['word/footnotes.xml']);notes.append(ET.fromstring('<w:footnote'+NS+' w:id="'+identity+'">'+p(text('Retained note'))+'</w:footnote>'))
  if side=='before':
   marker=next(node for node in body.iter(W+'footnoteReference') if node.get(W+'id')=='7');parents={child:parent for parent in body.iter() for child in parent};run=parents[marker];paragraph=parents[run];paragraph.insert(list(paragraph).index(run)+1,ET.fromstring('<w:r'+NS+'><w:footnoteReference w:id="17"/></w:r>'))
   notes.append(ET.fromstring('<w:footnote'+NS+' w:id="17">'+p(text('Second note'))+'</w:footnote>'))
   case[target][0]['table'][-1][-1][0]['paragraph'].append({'footnote':[P([T('Second note')])]})
  entries['word/document.xml']=_serialize_xml(body);entries['word/footnotes.xml']=_serialize_xml(notes)
  case[side]='/table-sources/'+case['name']+'-'+side+'.docx'
  with zipfile.ZipFile(case[side],'w') as z:
   for n,data in entries.items():z.writestr(n,data)
  case[target].insert(-1,P([T('Retained '),{'footnote':[P([T('Retained note')])]}]))
 cases.append(case)
for case in cases:
 for formatting in [False,True]:
  for metadata in [False,True]:
   for rich_note in ([False] if case.get('collision') else [False,True]):
    paths={};expected={}
    for side,target in [('before','expectedRejectGraph'),('after','expectedAcceptGraph')]:
     with zipfile.ZipFile(case[side]) as z:entries={n:z.read(n) for n in z.namelist()}
     expected[side]=copy.deepcopy(case[target]);root=ET.fromstring(entries['word/footnotes.xml'])
     if rich_note:
      for note in root:
       if note.get(W+'type','normal')=='normal':note.find(W+'p').extend(ET.fromstring('<w:p'+NS+'>'+image()+link('link')+'</w:p>'))
      entries['word/footnotes.xml']=_serialize_xml(root)
      def enrich(value):
       if isinstance(value,list):
        for v in value:enrich(v)
       elif isinstance(value,dict):
        if 'footnote' in value:value['footnote'][0]['paragraph'] += [I(side),L(side,True)]
        else:
         for v in value.values():enrich(v)
      enrich(expected[side])
     paths[side]='/table-'+side+'.docx'
     with zipfile.ZipFile(paths[side],'w') as z:
      for n,data in entries.items():z.writestr(n,data)
     validate_source(paths[side]);assert reachable(paths[side])==expected[side]
    name=case['name']+'-'+str(formatting)+'-'+str(metadata)+'-'+str(rich_note)
    try:
     generate_tracked_document(paths['before'],paths['after'],'/table-out.docx','events',formatting,True,metadata)
     accept_tracked_document('/table-out.docx','/table-accepted.docx')
     with zipfile.ZipFile('/table-out.docx') as src,zipfile.ZipFile('/table-rejected.docx','w') as dst:
      for entry in src.infolist():
       data=src.read(entry.filename)
       if entry.filename in ['word/document.xml','word/footnotes.xml','word/styles.xml']:data=_serialize_xml(reject(_qname_safe_parse(data))[0])
       dst.writestr(entry,data)
     target=expected['before'] if metadata else without_notes(expected['before'])
     assert reachable('/table-accepted.docx')==expected['after'],('accept',name,reachable('/table-accepted.docx'),expected['after'])
     if not metadata and case.get('collision'):target[-2]=copy.deepcopy(expected['after'][-2])
     assert reachable('/table-rejected.docx')==target,('reject',name,reachable('/table-rejected.docx'),target)
     for variant in ['out','accepted','rejected']:validate_source('/table-'+variant+'.docx')
     if not metadata:
      with zipfile.ZipFile('/table-out.docx') as out,zipfile.ZipFile(paths['after']) as after:assert out.read('word/footnotes.xml')==after.read('word/footnotes.xml')
     a=extract_document_model(open(paths['before'],'rb').read(),True,True,'en');b=extract_document_model(open(paths['after'],'rb').read(),True,True,'en');manifest=json.loads(worklazyComparisonManifestJson(a,b,formatting,True,metadata))
     for defect in ['note-fact','part-action','event-owner']:
      bad=copy.deepcopy(manifest)
      if defect=='note-fact':
       side=next(side for side in ['before','after'] if bad['noteFacts'][side]['references']);bad['noteFacts'][side]['references'][0]['id']='999'
      elif defect=='part-action':bad['noteProjection']['partActions']=[]
      else:
       def flatten(decisions):return [node for d in decisions for node in [d]+flatten(d.get('children',[]))]
       owner=next(d for d in flatten(bad['decisions']) if d.get('objectEvents'))
       side=next(side for side in ['before','after'] if owner['objectEvents'][side]);owner['objectEvents'][side].append(copy.deepcopy(owner['objectEvents'][side][0]))
      if os.path.exists('/bad-table.docx'):os.unlink('/bad-table.docx')
      try:generate_tracked_document(paths['before'],paths['after'],'/bad-table.docx','events',formatting,True,metadata,json.dumps(bad));raise AssertionError(defect+' accepted')
      except ValueError:assert not os.path.exists('/bad-table.docx')
     for variant,path in [('before',paths['before']),('after',paths['after']),('out','/table-out.docx'),('accepted','/table-accepted.docx'),('rejected','/table-rejected.docx')]:shutil.copyfile(path,'/table-projection/'+name+'-'+variant+'.docx')
     results.append({'name':name,'pass':True})
    except Exception as error:results.append({'name':name,'pass':False,'error':str(error)})
for case in [case for case in cases if not case.get('collision')]:
 for formatting in [False,True]:
  generate_tracked_document(case['before'],case['after'],'/table-out.docx','events',formatting,False,False)
  accept_tracked_document('/table-out.docx','/table-accepted.docx')
  with zipfile.ZipFile('/table-out.docx') as src,zipfile.ZipFile('/table-rejected.docx','w') as dst:
   for entry in src.infolist():dst.writestr(entry,_serialize_xml(reject(_qname_safe_parse(src.read(entry.filename)))[0]) if entry.filename in ['word/document.xml','word/footnotes.xml'] else src.read(entry.filename))
  assert reachable('/table-accepted.docx')==case['expectedAcceptGraph'] and reachable('/table-rejected.docx')==case['expectedAcceptGraph']
  with zipfile.ZipFile('/table-out.docx') as out,zipfile.ZipFile(case['after']) as after:assert out.read('word/footnotes.xml')==after.read('word/footnotes.xml')
  name=case['name']+'-tables-off-'+str(formatting)
  for variant in ['out','accepted','rejected']:shutil.copyfile('/table-'+variant+'.docx','/table-projection/'+name+'-'+variant+'.docx')
  results.append({'name':name,'pass':True})
for case in [case for case in cases if not case.get('collision')]:
 for formatting in [False,True]:
  paths={}
  for side in ['before','after']:
   with zipfile.ZipFile(case[side]) as z:entries={n.replace('footnotes','endnotes'):(z.read(n).replace(b'footnote',b'endnote') if n.endswith(('.xml','.rels')) else z.read(n)) for n in z.namelist()}
   paths[side]='/end-table-'+side+'.docx'
   with zipfile.ZipFile(paths[side],'w') as z:
    for n,data in entries.items():z.writestr(n,data)
  generate_tracked_document(paths['before'],paths['after'],'/end-table-out.docx','events',formatting,True,True)
  accept_tracked_document('/end-table-out.docx','/end-table-accepted.docx')
  with zipfile.ZipFile('/end-table-out.docx') as src,zipfile.ZipFile('/end-table-rejected.docx','w') as dst:
   for entry in src.infolist():dst.writestr(entry,_serialize_xml(reject(_qname_safe_parse(src.read(entry.filename)))[0]) if entry.filename in ['word/document.xml','word/endnotes.xml'] else src.read(entry.filename))
  for variant,target in [('accepted','expectedAcceptGraph'),('rejected','expectedRejectGraph')]:
   assert reachable('/end-table-'+variant+'.docx')==without_notes(case[target])
   side='after' if variant=='accepted' else 'before'
   assert note_oracle['reachable']('/end-table-'+variant+'.docx','endnote')==note_oracle['reachable'](paths[side],'endnote')
  name='endnote-'+case['name']+'-'+str(formatting)
  for variant,path in [('before',paths['before']),('after',paths['after']),('out','/end-table-out.docx'),('accepted','/end-table-accepted.docx'),('rejected','/end-table-rejected.docx')]:shutil.copyfile(path,'/table-projection/'+name+'-'+variant+'.docx')
  results.append({'name':name,'pass':True})
base=next(case for case in cases if case['name']=='table-cell-delete')
for mode in ['custom-part','missing-main-link']:
 with zipfile.ZipFile(base['before']) as z:entries={n:z.read(n) for n in z.namelist()}
 root=ET.fromstring(entries['word/_rels/document.xml.rels']);note_rel=next(rel for rel in root if rel.get('Type').endswith('/footnotes'))
 if mode=='missing-main-link':root.remove(note_rel)
 else:
  note_rel.set('Target','custom/notes.xml');entries['word/custom/notes.xml']=entries['word/footnotes.xml']
  rels=ET.fromstring(entries['word/_rels/footnotes.xml.rels'])
  for rel in rels:
   if rel.get('TargetMode')!='External':rel.set('Target','../'+rel.get('Target'))
  entries['word/custom/_rels/notes.xml.rels']=_serialize_xml(rels)
  types=ET.fromstring(entries['[Content_Types].xml']);ET.SubElement(types,CT+'Override',{'PartName':'/word/custom/notes.xml','ContentType':'application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml'});entries['[Content_Types].xml']=_serialize_xml(types)
 entries['word/_rels/document.xml.rels']=_serialize_xml(root)
 with zipfile.ZipFile('/table-unsupported-note.docx','w') as z:
  for n,data in entries.items():z.writestr(n,data)
 model=json.loads(extract_document_model(open('/table-unsupported-note.docx','rb').read(),True,True,'en'));assert 'unsupported-note-part-path' in model['noteFacts']['errors']
 if os.path.exists('/unsupported-note-out.docx'):os.unlink('/unsupported-note-out.docx')
 try:generate_tracked_document('/table-unsupported-note.docx',base['after'],'/unsupported-note-out.docx','events',True,True,True);raise AssertionError(mode+' emitted')
 except ValueError:assert not os.path.exists('/unsupported-note-out.docx')
 results.append({'name':mode,'pass':True,'status':'unsupported-source-part-mapping-refused'})
json.dumps(results)
`));
console.log(JSON.stringify(result,null,2));
assert.equal(result.filter(row=>!row.pass).length,0);
fs.mkdirSync('docs/jobs/todo/diffchecker-port-20261023/table-projection',{recursive:true});
for(const name of py.FS.readdir('/table-projection').filter(name=>name.endsWith('.docx')))fs.writeFileSync('docs/jobs/todo/diffchecker-port-20261023/table-projection/'+name,py.FS.readFile('/table-projection/'+name));
