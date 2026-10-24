import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadPyodide} from 'pyodide';
import {compareDocumentModels,diffText} from '../src/features/document-compare/documentComparison.ts';
let last;
globalThis.worklazyDiffJson=(a,b)=>JSON.stringify(diffText(a,b));
globalThis.worklazyComparisonManifestJson=(a,b,formatting,tables,metadata)=>{last=compareDocumentModels('before','after',JSON.parse(a),JSON.parse(b),{formatting,tables,metadata},'en');return JSON.stringify(last.manifest)};
const py=await loadPyodide();
py.globals.set('WORKLAZY_FORMATTING_POLICY_JSON',fs.readFileSync('src/features/word-compare/formatting-policy.json','utf8'));
for(const name of ['compare','accept_revisions','tracked_docx'])py.runPython(fs.readFileSync(`src/features/word-compare/${name}.py`,'utf8'));
py.runPython(fs.readFileSync('tests/word-note-fixtures.py','utf8').replace("if __name__=='__main__':","if False:"));
const harness=fs.readFileSync('tests/word-package-events.mjs','utf8');py.runPython(harness.slice(harness.indexOf('def reject(node):'),harness.indexOf('def view(')));
const result=JSON.parse(py.runPython(`
import os,shutil
os.makedirs('/boundary-order',exist_ok=True)
results=[]
def ordered_graph(path,kind):
 rows=reachable(path,kind)
 for row in rows:
  events=[]
  for event in row['events']:
   if event[0]=='text' and events and events[-1][0]=='text':events[-1][1]+=event[1]
   else:events.append(event)
  row['events']=events
 return rows
for kind in ['footnote','endnote']:
 for axis in ['split','merge']:
  for mode in ['both','delete','insert']:
   for formatting in [False,True]:
    text='First sentence. Second sentence.'
    old=paragraph(run(text[:16])+reference(kind,7)+(reference(kind,17) if mode!='insert' else '')+run(text[16:]))
    new=paragraph(run(text[:16])+reference(kind,9))+paragraph((reference(kind,19) if mode!='delete' else '')+run(text[16:]))
    oldnotes=[note(7,'First',kind)]+([note(17,'Second',kind)] if mode!='insert' else [])
    newnotes=[note(9,'First revised',kind)]+([note(19,'Second revised',kind)] if mode!='delete' else [])
    one=[{'anchor':[0,16,0],'events':[['text','First']]}]+([{'anchor':[0,16,1],'events':[['text','Second']]}] if mode!='insert' else [])
    two=[{'anchor':[0,16,0],'events':[['text','First revised']]}]+([{'anchor':[1,0,0],'events':[['text','Second revised']]}] if mode!='delete' else [])
    if axis=='merge':old,new=new,old;oldnotes,newnotes=newnotes,oldnotes;one,two=two,one
    package('/order-before.docx',old,oldnotes,kind);package('/order-after.docx',new,newnotes,kind)
    assert ordered_graph('/order-before.docx',kind)==one and ordered_graph('/order-after.docx',kind)==two
    name=kind+'-'+axis+'-'+mode+'-'+str(formatting)
    if os.path.exists('/order-out.docx'):os.unlink('/order-out.docx')
    try:
     generate_tracked_document('/order-before.docx','/order-after.docx','/order-out.docx','events',formatting,True,True)
     accept_tracked_document('/order-out.docx','/order-accepted.docx')
     with zipfile.ZipFile('/order-out.docx') as src,zipfile.ZipFile('/order-rejected.docx','w') as dst:
      for entry in src.infolist():dst.writestr(entry,_serialize_xml(reject(_qname_safe_parse(src.read(entry.filename)))[0]) if entry.filename in ['word/document.xml','word/'+kind+'s.xml'] else src.read(entry.filename))
     assert ordered_graph('/order-accepted.docx',kind)==two,('accept ordered graph',name)
     assert ordered_graph('/order-rejected.docx',kind)==one,('reject ordered graph',name)
     results.append({'name':name,'status':'export-ordered-graph-pass'})
    except ValueError as error:raise AssertionError((name,str(error))) from error
    if axis=='split' and mode=='both':
     a=extract_document_model(open('/order-before.docx','rb').read(),True,True,'en');b=extract_document_model(open('/order-after.docx','rb').read(),True,True,'en');manifest=json.loads(worklazyComparisonManifestJson(a,b,formatting,True,True))
     source=next(d for d in manifest['decisions'] if len(d['before'])==1 and len(d['after'])==2)
     contexts=source['objectEvents']['contexts'];assert [len(c['before']) for c in contexts]==[1,1]
     assert contexts[0]['before'][0]['source']['path']<contexts[1]['before'][0]['source']['path']
     for defect in ['old-right-only','swapped-order','omit-context-ref','swap-note-pair']:
      bad=copy.deepcopy(manifest);decision=next(d for d in bad['decisions'] if d['id']==source['id']);left,right=decision['objectEvents']['contexts']
      if defect=='old-right-only':
       event=left['before'].pop();event['start']=event['end']=0;right['before'].insert(0,event)
      elif defect=='swapped-order':left['before'][0]['source'],right['before'][0]['source']=right['before'][0]['source'],left['before'][0]['source']
      elif defect=='omit-context-ref':left['before']=[]
      else:
       refs=bad['noteProjection']['references'];refs[0]['noteId'],refs[1]['noteId']=refs[1]['noteId'],refs[0]['noteId']
      if os.path.exists('/bad-order.docx'):os.unlink('/bad-order.docx')
      try:generate_tracked_document('/order-before.docx','/order-after.docx','/bad-order.docx','events',formatting,True,True,json.dumps(bad));raise AssertionError(defect+' exported')
      except ValueError:assert not os.path.exists('/bad-order.docx')
    for variant in ['before','after','out','accepted','rejected']:shutil.copyfile('/order-'+variant+'.docx','/boundary-order/'+name+'-'+variant+'.docx')
# A non-bijective boundary ordinal remains an explicit refusal, never a guess.
for kind in ['footnote','endnote']:
 text='First sentence. Second sentence.'
 package('/order-before.docx',paragraph(run(text[:16])+reference(kind,7)+reference(kind,17)+run(text[16:])),[note(7,'First',kind),note(17,'Second',kind)],kind)
 package('/order-after.docx',paragraph(run(text[:16])+reference(kind,9))+paragraph(reference(kind,19)+reference(kind,29)+run(text[16:])),[note(9,'One',kind),note(19,'Two',kind),note(29,'Three',kind)],kind)
 if os.path.exists('/order-guard.docx'):os.unlink('/order-guard.docx')
 try:generate_tracked_document('/order-before.docx','/order-after.docx','/order-guard.docx','events',True,True,True);raise AssertionError('incomplete ordinal exported')
 except ValueError as error:assert str(error)=='UNSUPPORTED_TRACKED_SOURCE_NOTE_ORDER' and not os.path.exists('/order-guard.docx')
 for side in ['before','after']:shutil.copyfile('/order-'+side+'.docx','/boundary-order/'+kind+'-incomplete-'+side+'.docx')
 results.append({'name':kind+'-incomplete','status':'incomplete-ordinal-refused'})
for kind in ['footnote','endnote']:
 text='First sentence. Second sentence.'
 package('/order-before.docx',paragraph(run(text[:16])+reference(kind,7)+reference(kind,17)+run(text[16:])),[note(7,'Before first',kind),note(17,'Before second',kind)],kind)
 package('/order-after.docx',paragraph(run(text[:16])+reference(kind,9))+paragraph(reference(kind,19)+run(text[16:])),[note(9,'After first',kind),note(19,'After second',kind)],kind)
 generate_tracked_document('/order-before.docx','/order-after.docx','/order-out.docx','events',True,True,False)
 accept_tracked_document('/order-out.docx','/order-accepted.docx')
 with zipfile.ZipFile('/order-out.docx') as src,zipfile.ZipFile('/order-rejected.docx','w') as dst:
  for entry in src.infolist():dst.writestr(entry,_serialize_xml(reject(_qname_safe_parse(src.read(entry.filename)))[0]) if entry.filename=='word/document.xml' else src.read(entry.filename))
 assert ordered_graph('/order-accepted.docx',kind)==[{'anchor':[0,16,0],'events':[['text','After first']]},{'anchor':[1,0,0],'events':[['text','After second']]}]
 assert ordered_graph('/order-rejected.docx',kind)==[{'anchor':[0,16,0],'events':[['text','After first']]},{'anchor':[0,16,1],'events':[['text','After second']]}]
 with zipfile.ZipFile('/order-out.docx') as out,zipfile.ZipFile('/order-after.docx') as after:assert out.read('word/'+kind+'s.xml')==after.read('word/'+kind+'s.xml')
 for variant in ['before','after','out','accepted','rejected']:shutil.copyfile('/order-'+variant+'.docx','/boundary-order/'+kind+'-excluded-'+variant+'.docx')
 results.append({'name':kind+'-excluded','status':'metadata-excluded-after-graph-pass'})
json.dumps(results)
`));
assert.equal(result.filter(row=>row.status==='export-ordered-graph-pass').length,24);
// Four previously refused source pairs now pass with ordered endpoint graphs.
assert.equal(result.filter(row=>row.status==='incomplete-ordinal-refused').length,2);
console.log('16 forged source-order/context/note-pair actions refused');
assert.equal(result.filter(row=>row.status==='metadata-excluded-after-graph-pass').length,2);
console.log(JSON.stringify(result,null,2));
fs.mkdirSync('docs/jobs/todo/diffchecker-port-20261023/note-boundary-order',{recursive:true});
for(const name of py.FS.readdir('/boundary-order').filter(name=>name.endsWith('.docx')))fs.writeFileSync('docs/jobs/todo/diffchecker-port-20261023/note-boundary-order/'+name,py.FS.readFile('/boundary-order/'+name));
