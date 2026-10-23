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
for mutation in ['facts','missing','duplicate','container','id','reference','coverage','decisions']:
 bad=copy.deepcopy(value)
 if mutation=='facts':bad['noteFacts']['before']['containers'][0]['id']='invalid'
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
fs.mkdirSync('docs/jobs/todo/diffchecker-port-20261023/note-packages',{recursive:true});
for(const name of py.FS.readdir('/note-packages').filter(name=>name.endsWith('.docx')))fs.writeFileSync('docs/jobs/todo/diffchecker-port-20261023/note-packages/'+name,py.FS.readFile('/note-packages/'+name));
console.log('8 forged note source/anchor/container/coverage controls passed');
console.log(JSON.stringify(results,null,2));
assert.equal(results.filter(r=>r.status==='fail').length,0,'Required note graph behavior is not implemented');
