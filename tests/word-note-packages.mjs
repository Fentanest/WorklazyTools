// Deliberately strict future-feature regressions: unsupported is recorded as failure.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadPyodide} from 'pyodide';
import {compareDocumentModels,diffText} from '../src/features/document-compare/documentComparison.ts';
let requested;
globalThis.worklazyDrawingMask=json=>{requested=JSON.parse(json)};
globalThis.worklazyDiffJson=(a,b)=>JSON.stringify(diffText(a,b));
globalThis.worklazyComparisonManifestJson=(a,b,formatting,tables,metadata)=>JSON.stringify(compareDocumentModels('before','after',JSON.parse(a),JSON.parse(b),{formatting,tables,metadata,formattingMask:requested},'en').manifest);
const py=await loadPyodide();
py.globals.set('WORKLAZY_FORMATTING_POLICY_JSON',fs.readFileSync('src/features/word-compare/formatting-policy.json','utf8'));
for(const name of ['compare','accept_revisions','tracked_docx'])py.runPython(fs.readFileSync(`src/features/word-compare/${name}.py`,'utf8'));
py.runPython(fs.readFileSync('tests/word-note-fixtures.py','utf8').replace("if __name__=='__main__':","if False:"));
const results=JSON.parse(py.runPython(`
import os,shutil
os.makedirs('/note-packages',exist_ok=True)
results=[]
for case in validate_fixtures():
 try:
  generate_tracked_document(case['before'],case['after'],'/note-output.docx','notes',False,True,True)
  if case.get('comments'):
   with zipfile.ZipFile('/note-output.docx') as out,zipfile.ZipFile(case['after']) as after:
    assert ('word/comments.xml' in out.namelist())==('word/comments.xml' in after.namelist())
    if 'word/comments.xml' in after.namelist():assert out.read('word/comments.xml')==after.read('word/comments.xml')
    root=ET.fromstring(out.read('word/document.xml'))
    assert not any(n.get(W+'id')=='4' for n in root.iter() if n.tag in [W+'commentReference',W+'commentRangeStart',W+'commentRangeEnd']), 'Old anchor aliases revised comment'
  if case['invalid']:raise AssertionError('Malformed ordinary IDs were accepted')
  if '-absent-part-before' in case['name']:
   with zipfile.ZipFile('/note-output.docx') as z:
    part='word/'+case['kind']+'s.xml';root=ET.fromstring(z.read(part))
    assert [(n.get(W+'id'),n.get(W+'type')) for n in root if n.get(W+'type')]==[('-1','separator'),('0','continuationSeparator')]
    assert [n.get(W+'id') for n in root if n.get(W+'type','normal')=='normal']==['1']
    rows=[r for r in ET.fromstring(z.read('word/_rels/document.xml.rels')) if r.get('Type')==RNS+'/'+case['kind']+'s']
    assert len(rows)==1 and rows[0].get('Target')==case['kind']+'s.xml'
    rows=[r for r in ET.fromstring(z.read('[Content_Types].xml')) if r.get('PartName')=='/'+part]
    assert len(rows)==1 and rows[0].get('ContentType')=='application/vnd.openxmlformats-officedocument.wordprocessingml.'+case['kind']+'s+xml'
  accept_tracked_document('/note-output.docx','/note-accepted.docx')
  assert reachable('/note-accepted.docx',case['kind'])==expected(case,'after'),('accept',reachable('/note-accepted.docx',case['kind']),expected(case,'after'))
  # Independent author-scoped rejection. Paragraph boundary fixtures are separate;
  # these note inputs have one text run per note and stable body paragraphs.
  def reject_note(n):
   if n.tag==W+'ins' and n.get(W+'author')=='notes':return []
   children=[v for c in n for v in reject_note(c)];n[:]=children
   if n.tag==W+'del' and n.get(W+'author')=='notes':return children
   if n.tag==W+'delText':n.tag=W+'t'
   return [n]
  with zipfile.ZipFile('/note-output.docx') as source,zipfile.ZipFile('/note-rejected.docx','w') as output:
   for entry in source.infolist():
    data=source.read(entry.filename)
    if entry.filename in ['word/document.xml','word/footnotes.xml','word/endnotes.xml']:data=_serialize_xml(reject_note(_qname_safe_parse(data))[0])
    output.writestr(entry,data)
  assert reachable('/note-rejected.docx',case['kind'])==expected(case,'before'),('reject',reachable('/note-rejected.docx',case['kind']),expected(case,'before'))
  for variant,path in [('before',case['before']),('after',case['after']),('out','/note-output.docx'),('accepted','/note-accepted.docx'),('rejected','/note-rejected.docx')]:shutil.copyfile(path,'/note-packages/'+case['name']+'-'+variant+'.docx')
  results.append({'name':case['name'],'status':'pass'})
 except Exception as error:
  if case['invalid'] and isinstance(error,ValueError):results.append({'name':case['name'],'status':'pass','rejection':str(error)})
  else:results.append({'name':case['name'],'status':'fail','error':str(error)})
json.dumps(results)
`));
py.runPython(`
case=next(case for case in validate_fixtures() if case['name']=='footnote-different-id-same-note')
a=extract_document_model(open(case['before'],'rb').read(),True,True,'en');b=extract_document_model(open(case['after'],'rb').read(),True,True,'en');value=json.loads(worklazyComparisonManifestJson(a,b,False,True,True))
for mutation in ['facts','missing','duplicate','container','id','reference','coverage','decisions','part-create','part-missing','part-facts']:
 bad=copy.deepcopy(value)
 if mutation=='part-create':bad['noteProjection']['partActions'][0]['create']=True
 elif mutation=='part-missing':bad['noteProjection']['partActions']=[]
 elif mutation=='part-facts':bad['noteFacts']['before']['parts']=[]
 elif mutation=='facts':bad['noteFacts']['before']['containers'][0]['id']='invalid'
 elif mutation=='missing':bad['noteProjection']['pairs'].clear()
 elif mutation=='duplicate':bad['noteProjection']['pairs']*=2
 elif mutation=='container':bad['noteProjection']['pairs'][0]['before']['source']['path']=[99]
 elif mutation=='id':bad['noteProjection']['pairs'][0]['after']['id']='1'
 elif mutation=='reference':bad['noteProjection']['references'][0]['after']['objectEvent']['start']+=1
 elif mutation=='coverage':bad['noteProjection']['pairs'][0]['coverage']['before'].clear()
 else:bad['noteProjection']['pairs'][0]['decisionIds'].clear()
 if os.path.exists('/bad-note.docx'):os.unlink('/bad-note.docx')
 try:generate_tracked_document(case['before'],case['after'],'/bad-note.docx','notes',False,True,True,json.dumps(bad));raise AssertionError(mutation+' accepted')
 except ValueError as error:assert 'COMPARISON_MANIFEST_NOTE' in str(error)
 assert not os.path.exists('/bad-note.docx')
`);
py.runPython(`
for kind in ['footnote','endnote']:
 for changed in [False,True]:
  case=next(case for case in validate_fixtures() if case['name']==kind+'-different-id-same-note')
  if changed:
   with zipfile.ZipFile(case['after']) as z:entries={name:z.read(name) for name in z.namelist()}
   entries['word/document.xml']=entries['word/document.xml'].replace(b'Anchor',b'Anchor revised')
   with zipfile.ZipFile('/excluded-note-after.docx','w') as z:
    for name,data in entries.items():z.writestr(name,data)
   after='/excluded-note-after.docx'
  else:after=case['after']
  generate_tracked_document(case['before'],after,'/excluded-note.docx','notes',False,True,False)
  accept_tracked_document('/excluded-note.docx','/excluded-accepted.docx')
  assert reachable('/excluded-accepted.docx',kind)==reachable(after,kind)
  with zipfile.ZipFile('/excluded-note.docx') as source,zipfile.ZipFile('/excluded-rejected.docx','w') as output:
   for entry in source.infolist():output.writestr(entry,_serialize_xml(reject_note(_qname_safe_parse(source.read(entry.filename)))[0]) if entry.filename=='word/document.xml' else source.read(entry.filename))
  # Excluded references retain revised IDs/content; anchored glyph cursor may
  # project through reverted body text, so assert target events independently.
  assert [row['events'] for row in reachable('/excluded-rejected.docx',kind)]==[row['events'] for row in reachable(after,kind)]
  with zipfile.ZipFile('/excluded-note.docx') as x,zipfile.ZipFile(after) as y:assert x.read('word/'+kind+'s.xml')==y.read('word/'+kind+'s.xml')
`);
console.log('4 excluded-note reference/content preservation targets passed');
py.runPython(`
for kind in ['footnote','endnote']:
 before=paragraph(run('Deleted anchor')+reference(kind,1))+paragraph(run('Kept anchor')+reference(kind,2))
 after=paragraph(run('Deleted anchor'))+paragraph(run('Kept anchor')+reference(kind,1))
 package('/collision-before.docx',before,[note(1,'Deleted note',kind),note(2,'Kept note',kind)],kind)
 package('/collision-after.docx',after,[note(1,'Kept note',kind)],kind)
 generate_tracked_document('/collision-before.docx','/collision-after.docx','/collision-out.docx','notes',False,True,True)
 accept_tracked_document('/collision-out.docx','/collision-accepted.docx')
 with zipfile.ZipFile('/collision-out.docx') as source,zipfile.ZipFile('/collision-rejected.docx','w') as output:
  for entry in source.infolist():output.writestr(entry,_serialize_xml(reject_note(_qname_safe_parse(source.read(entry.filename)))[0]) if entry.filename in ['word/document.xml','word/'+kind+'s.xml'] else source.read(entry.filename))
 assert reachable('/collision-accepted.docx',kind)==[{'anchor':[1,11,0],'events':[['text','Kept note']]}]
 assert reachable('/collision-rejected.docx',kind)==[{'anchor':[0,14,0],'events':[['text','Deleted note']]},{'anchor':[1,11,0],'events':[['text','Kept note']]}]
 for variant in ['before','after','out','accepted','rejected']:shutil.copyfile('/collision-'+variant+'.docx','/note-packages/'+kind+'-allocated-collision-'+variant+'.docx')
`);
console.log('2 before-only allocated-ID collision with paired surviving note targets passed');
py.runPython(`
# Shared named-style policy witness: raw pStyle is restored on a wholly
# deleted paragraph, but excluded shared style definitions remain revised.
for formatting in [False,True]:
 for kind in ['footnote','endnote']:
  paths=['/named-before.docx','/named-after.docx']
  for side,path in zip(['before','after'],paths):
   payload=note(1,'Deleted note',kind).replace('<w:p>','<w:p><w:pPr><w:pStyle w:val="NoteStyle"/></w:pPr>')
   package(path,paragraph(run('Anchor')+(reference(kind,1) if side=='before' else '')),[payload] if side=='before' else [],kind)
   with zipfile.ZipFile(path) as z:entries={n:z.read(n) for n in z.namelist()}
   entries['word/styles.xml']=('<w:styles xmlns:w="'+WNS+'"><w:style w:type="paragraph" w:styleId="NoteStyle"><w:name w:val="NoteStyle"/><w:rPr><w:sz w:val="'+('20' if side=='before' else '40')+'"/></w:rPr></w:style></w:styles>').encode()
   with zipfile.ZipFile(path,'w') as z:
    for n,data in entries.items():z.writestr(n,data)
  generate_tracked_document(paths[0],paths[1],'/named-out.docx','notes',formatting,True,True)
  accept_tracked_document('/named-out.docx','/named-accepted.docx')
  assert reachable('/named-accepted.docx',kind)==[]
  with zipfile.ZipFile('/named-out.docx') as z:
   root=ET.fromstring(z.read('word/'+kind+'s.xml'));p=root.find(W+kind+'/'+W+'p')
   assert p.find(W+'pPr/'+W+'pStyle').get(W+'val')=='NoteStyle'
   styles=ET.fromstring(z.read('word/styles.xml'));properties=styles.find(W+'style/'+W+'rPr');history=properties.find(W+'rPrChange')
   assert properties.find(W+'sz').get(W+'val')=='40'
   assert (history is not None)==formatting
   if formatting:assert history.find(W+'rPr/'+W+'sz').get(W+'val')=='20'
  for variant,path in [('before',paths[0]),('after',paths[1]),('out','/named-out.docx'),('accepted','/named-accepted.docx')]:shutil.copyfile(path,'/note-packages/'+kind+'-inherited-style-'+str(formatting)+'-'+variant+'.docx')
`);
console.log('4 named-style raw paragraph/shared-style policy witnesses passed');
py.runPython(`
for case in [case for case in validate_fixtures() if '-absent-part-' in case['name']]:
 generate_tracked_document(case['before'],case['after'],'/absent-excluded.docx','notes',False,True,False)
 accept_tracked_document('/absent-excluded.docx','/absent-excluded-accepted.docx')
 assert reachable('/absent-excluded-accepted.docx',case['kind'])==expected(case,'after')
 with zipfile.ZipFile('/absent-excluded.docx') as x,zipfile.ZipFile(case['after']) as y:
  part='word/'+case['kind']+'s.xml'
  assert (part in x.namelist())==(part in y.namelist())
  if part in y.namelist():assert x.read(part)==y.read(part)
  assert x.read('word/_rels/document.xml.rels')==y.read('word/_rels/document.xml.rels')
`);
console.log('8 metadata-excluded absent-part targets retain revised presence, bytes and relationships');
py.runPython(`
case=next(case for case in validate_fixtures() if case['name']=='footnote-absent-part-before')
for defect in ['wrong-type','duplicate-type','dangling-main-rel']:
 with zipfile.ZipFile(case['after']) as z:entries={n:z.read(n) for n in z.namelist()}
 types=ET.fromstring(entries['[Content_Types].xml'])
 if defect=='dangling-main-rel':
  rels=ET.fromstring(entries['word/_rels/document.xml.rels']);ET.SubElement(rels,PR+'Relationship',{'Id':'dangling','Type':RNS+'/footnotes','Target':'missing.xml'});entries['word/_rels/document.xml.rels']=_serialize_xml(rels)
 else:
  for i in range(2 if defect=='duplicate-type' else 1):ET.SubElement(types,CT+'Override',{'PartName':'/word/footnotes.xml','ContentType':'application/wrong' if defect=='wrong-type' else 'application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml'})
 entries['[Content_Types].xml']=_serialize_xml(types)
 with zipfile.ZipFile('/bad-absent-after.docx','w') as z:
  for n,data in entries.items():z.writestr(n,data)
 if os.path.exists('/bad-absent-out.docx'):os.unlink('/bad-absent-out.docx')
 try:generate_tracked_document(case['before'],'/bad-absent-after.docx','/bad-absent-out.docx','notes',False,True,True);raise AssertionError(defect+' accepted')
 except ValueError:assert not os.path.exists('/bad-absent-out.docx')
`);
console.log('3 conflicting note-part declarations/relationship controls fail without output');
py.runPython(`
def special_graph(path,kind):
 with zipfile.ZipFile(path) as z:
  part='word/'+kind+'s.xml';relpath='word/_rels/'+kind+'s.xml.rels'
  rels={r.get('Id'):r for r in ET.fromstring(z.read(relpath))} if relpath in z.namelist() else {}
  def fact(n):
   attrs=[]
   for k,v in sorted(n.attrib.items()):
    if n.tag.endswith('}docPr') and k=='id':continue # nonsemantic drawing allocation
    if k.startswith(R):
     rel=rels[v];target=rel.get('Target')
     v=target if rel.get('TargetMode')=='External' else hashlib.sha256(z.read(posixpath.normpath(posixpath.join('word',target)))).hexdigest()
    attrs.append([k,v])
   return [n.tag,attrs,n.text or '',[fact(c) for c in n]]
  return [fact(n) for n in ET.fromstring(z.read(part)) if n.get(W+'type','normal')!='normal']
for kind in ['footnote','endnote']:
 for special_type in ['separator','continuationSeparator','continuationNotice']:
  for formatting in [False,True]:
   case=next(c for c in validate_fixtures() if c['name']==kind+'-absent-part-before-resources')
   with zipfile.ZipFile(case['before']) as z:entries={n:z.read(n) for n in z.namelist()}
   root=ET.fromstring(entries['word/'+kind+'s.xml'])
   payload='<w:'+kind+' xmlns:w="'+WNS+'" xmlns:r="'+RNS+'" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" w:id="1" w:type="'+special_type+'"><w:p><w:pPr><w:jc w:val="center"/></w:pPr><w:r><w:rPr><w:sz w:val="26"/></w:rPr><w:t>CUSTOM SEPARATOR</w:t>'+('' if special_type=='continuationNotice' else '<w:'+special_type+'/>')+'</w:r><w:hyperlink r:id="rIdShared">'+run('Link')+'</w:hyperlink><w:r>'+drawing()+'</w:r></w:p></w:'+kind+'>'
   root.append(ET.fromstring(payload));entries['word/'+kind+'s.xml']=_serialize_xml(root)
   with zipfile.ZipFile('/special-before.docx','w') as z:
    for n,data in entries.items():z.writestr(n,data)
   generate_tracked_document('/special-before.docx',case['after'],'/special-out.docx','notes',formatting,True,True)
   accept_tracked_document('/special-out.docx','/special-accepted.docx')
   with zipfile.ZipFile('/special-out.docx') as source,zipfile.ZipFile('/special-rejected.docx','w') as output:
    for entry in source.infolist():output.writestr(entry,_serialize_xml(reject_note(_qname_safe_parse(source.read(entry.filename)))[0]) if entry.filename in ['word/document.xml','word/'+kind+'s.xml'] else source.read(entry.filename))
   assert reachable('/special-accepted.docx',kind)==[]
   assert reachable('/special-rejected.docx',kind)==reachable('/special-before.docx',kind)
   assert special_graph('/special-out.docx',kind)==special_graph('/special-before.docx',kind)
   assert special_graph('/special-rejected.docx',kind)==special_graph('/special-before.docx',kind)
   with zipfile.ZipFile('/special-out.docx') as z:
    notes=ET.fromstring(z.read('word/'+kind+'s.xml'));assert len({n.get(W+'id') for n in notes})==len(notes),'special ID collides with allocated ordinary note'
   a=extract_document_model(open('/special-before.docx','rb').read(),True,True,'en');b=extract_document_model(open(case['after'],'rb').read(),True,True,'en');manifest=json.loads(worklazyComparisonManifestJson(a,b,formatting,True,True))
   for defect in ['omit','duplicate','source','coverage']:
    bad=copy.deepcopy(manifest)
    action=bad['noteProjection']['partActions'][0]
    if defect=='omit':action['specials']=[]
    elif defect=='duplicate':action['specials']*=2
    elif defect=='source':action['specials'][0]['source']['path']=[999]
    else:
     for scope in bad['coverage']['before']:
      if scope['disposition']=='note-special':scope['disposition']='preserve-after'
    if os.path.exists('/bad-special.docx'):os.unlink('/bad-special.docx')
    try:generate_tracked_document('/special-before.docx',case['after'],'/bad-special.docx','notes',formatting,True,True,json.dumps(bad));raise AssertionError(defect+' accepted')
    except ValueError:assert not os.path.exists('/bad-special.docx')
   for variant,path in [('before','/special-before.docx'),('out','/special-out.docx'),('accepted','/special-accepted.docx'),('rejected','/special-rejected.docx')]:shutil.copyfile(path,'/note-packages/'+kind+'-'+special_type+'-'+str(formatting)+'-'+variant+'.docx')
`);
console.log('12 custom separator/continuation separator/notice property and resource roundtrips +48 action/coverage negatives passed');
py.runPython(`
for defect in ['duplicate-id','duplicate-type','unknown-type','numbering','missing-style','internal-link']:
 with zipfile.ZipFile('/special-before.docx') as z:entries={n:z.read(n) for n in z.namelist()}
 part='word/endnotes.xml';root=ET.fromstring(entries[part]);special=next(n for n in root if n.get(W+'type','normal')!='normal')
 if defect in ['duplicate-id','duplicate-type']:
  extra=copy.deepcopy(special);extra.set(W+'id','1' if defect=='duplicate-id' else '99');extra.set(W+'type','separator' if defect=='duplicate-id' else special.get(W+'type'));root.append(extra)
 elif defect=='unknown-type':special.set(W+'type','custom')
 elif defect=='numbering':ET.SubElement(special.find(W+'p/'+W+'pPr'),W+'numPr')
 elif defect=='missing-style':ET.SubElement(special.find(W+'p/'+W+'pPr'),W+'pStyle',{W+'val':'Missing'})
 else:special.find(W+'p/'+W+'hyperlink').set(W+'anchor','MissingBookmark')
 entries[part]=_serialize_xml(root)
 with zipfile.ZipFile('/unsupported-special.docx','w') as z:
  for n,data in entries.items():z.writestr(n,data)
 if os.path.exists('/unsupported-special-out.docx'):os.unlink('/unsupported-special-out.docx')
 try:generate_tracked_document('/unsupported-special.docx',case['after'],'/unsupported-special-out.docx','notes',True,True,True);raise AssertionError(defect+' accepted')
 except ValueError:assert not os.path.exists('/unsupported-special-out.docx')
`);
console.log('6 unsupported/ambiguous special dependency gates fail without output');
fs.mkdirSync('docs/jobs/todo/diffchecker-port-20261023/note-packages',{recursive:true});
for(const name of py.FS.readdir('/note-packages').filter(name=>name.endsWith('.docx')))fs.writeFileSync('docs/jobs/todo/diffchecker-port-20261023/note-packages/'+name,py.FS.readFile('/note-packages/'+name));
console.log('11 forged note source/anchor/container/coverage controls passed');
console.log(JSON.stringify(results,null,2));
assert.equal(results.filter(r=>r.status==='fail').length,0,'Required note graph behavior is not implemented');
