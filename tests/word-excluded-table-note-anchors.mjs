import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadPyodide} from 'pyodide';
import {compareDocumentModels,diffText} from '../src/features/document-compare/documentComparison.ts';
let last;
globalThis.worklazyDiffJson=(a,b)=>JSON.stringify(diffText(a,b));
globalThis.worklazyComparisonManifestJson=(a,b,formatting,tables,metadata)=>{last=compareDocumentModels('before','after',JSON.parse(a),JSON.parse(b),{formatting,tables,metadata},'en');return JSON.stringify(last.manifest)};
const py=await loadPyodide();py.globals.set('WORKLAZY_FORMATTING_POLICY_JSON',fs.readFileSync('src/features/word-compare/formatting-policy.json','utf8'));
for(const name of ['compare','accept_revisions','tracked_docx'])py.runPython(fs.readFileSync(`src/features/word-compare/${name}.py`,'utf8'));
py.runPython(fs.readFileSync('tests/word-note-fixtures.py','utf8').replace("if __name__=='__main__':","if False:"));
const harness=fs.readFileSync('tests/word-package-events.mjs','utf8');py.runPython(harness.slice(harness.indexOf('def reject(node):'),harness.indexOf('def view(')));
const results=JSON.parse(py.runPython(`
import os,shutil
os.makedirs('/excluded-anchors',exist_ok=True);rows=[]
raw_reachable=reachable
def reachable(path,kind):
 result=raw_reachable(path,kind)
 for row in result:
  events=[]
  for event in row['events']:
   if event[0]=='text' and events and events[-1][0]=='text':events[-1][1]+=event[1]
   else:events.append(event)
  row['events']=events
 return result
for kind in ['footnote','endnote']:
 for shared in [False,True]:
  name=kind+('-shared' if shared else '-table-only')
  for side,identity in [('before',7),('after',19)]:
   table='<w:tbl><w:tblPr/><w:tblGrid><w:gridCol w:w="2000"/></w:tblGrid><w:tr><w:tc><w:tcPr><w:tcW w:w="2000" w:type="dxa"/></w:tcPr>'+paragraph(run(side+' table ')+reference(kind,identity))+'</w:tc></w:tr></w:tbl>'
   body=paragraph(run('Anchor')+(reference(kind,identity) if shared else ''))+table+paragraph(run('End'))
   special=note(identity,side+' note ',kind).replace('</w:p>','<w:r>'+drawing()+'</w:r><w:hyperlink r:id="rIdShared">'+run('link')+'</w:hyperlink></w:p>')
   package('/'+side+'.docx',body,[special],kind,resources=True)
   shutil.copyfile('/'+side+'.docx','/excluded-anchors/'+name+'-'+side+'.docx')
  a=json.loads(extract_document_model(open('/before.docx','rb').read(),True,True,'en'));b=json.loads(extract_document_model(open('/after.docx','rb').read(),True,True,'en'))
  def table_snapshot(path):
   with zipfile.ZipFile(path) as z:
    def canonical(n):return (n.tag,sorted(n.attrib.items()),n.text or '',[canonical(c) for c in n])
    return canonical(ET.fromstring(z.read('word/document.xml')).find('.//'+W+'tbl'))
  def graph(side,anchors):
   events=[['text',side+' note '],['image',hashlib.sha256(image_bytes(side)).hexdigest()],['link','https://note.example/','link']]
   return [{'anchor':anchor,'events':events} for anchor in anchors]
  for side in ['before','after']:
   anchors=([[0,6,0]] if shared else [])+[[1,len(side+' table '),0]]
   assert reachable('/'+side+'.docx',kind)==graph(side,anchors),(name,side,'source graph')
  scopes=[(False,True,False),(True,True,False),(True,True,True),(True,False,False)] if shared else [(False,True,False),(True,True,False),(True,True,True),(True,False,False)]
  for formatting,metadata,tables in scopes:
   label=name+'-'+str(formatting)+'-'+str(metadata)+'-'+str(tables)
   manifest=json.loads(worklazyComparisonManifestJson(json.dumps(a),json.dumps(b),formatting,tables,metadata))
   guarded=not shared and not tables and metadata
   if not tables:assert not any(d['type']=='table' for d in manifest['decisions'])
   if os.path.exists('/excluded.docx'):os.unlink('/excluded.docx')
   try:generate_tracked_document('/before.docx','/after.docx','/excluded.docx','events',formatting,tables,metadata)
   except ValueError as error:
    assert guarded and str(error)=='UNSUPPORTED_TRACKED_SOURCE_NOTE' and not os.path.exists('/excluded.docx'),(label,str(error))
    assert len(manifest['noteProjection']['pairs'])==0 and 'excluded-table-note-anchor' in manifest['noteProjection']['reasons']
    rows.append({'name':label,'status':'table-only-no-authority-refused'});continue
   assert not guarded,label+' unsafe export'
   accept_tracked_document('/excluded.docx','/accepted.docx')
   with zipfile.ZipFile('/excluded.docx') as src,zipfile.ZipFile('/rejected.docx','w') as dst:
    for entry in src.infolist():dst.writestr(entry,_serialize_xml(reject(_qname_safe_parse(src.read(entry.filename)))[0]) if entry.filename in ['word/document.xml','word/'+kind+'s.xml'] else src.read(entry.filename))
   anchors=([[0,6,0]] if shared else [])+[[1,len('after table '),0]]
   assert reachable('/accepted.docx',kind)==graph('after',anchors),(label,'accept',reachable('/accepted.docx',kind),graph('after',anchors))
   reject_side='before' if metadata else 'after'
   reject_anchors=([[0,6,0]] if shared else [])+[[1,len(('before' if tables else 'after')+' table '),0]]
   assert reachable('/rejected.docx',kind)==graph(reject_side,reject_anchors),(label,'reject',reachable('/rejected.docx',kind),graph(reject_side,reject_anchors))
   if not tables:
    for variant in ['/excluded.docx','/accepted.docx','/rejected.docx']:assert table_snapshot(variant)==table_snapshot('/after.docx'),(label,'revised table/anchor modified')
   if not metadata:
    with zipfile.ZipFile('/excluded.docx') as out,zipfile.ZipFile('/after.docx') as revised:assert out.read('word/'+kind+'s.xml')==revised.read('word/'+kind+'s.xml')
   if shared and not tables and metadata:
    assert len(manifest['noteProjection']['pairs'])==1
    assert all(len(manifest['noteProjection']['excludedReferences'][side])==1 for side in ['before','after'])
    for defect in ['omit','duplicate','source','pair','body-authority','extra-field','non-object']:
     bad=copy.deepcopy(manifest);excluded=bad['noteProjection']['excludedReferences']
     if defect=='omit':excluded['before']=[]
     elif defect=='duplicate':excluded['after'].append(copy.deepcopy(excluded['after'][0]))
     elif defect=='source':excluded['before'][0]['source']['path']=[999]
     elif defect=='pair':excluded['after'][0]['noteId']='forged'
     elif defect=='body-authority':bad['noteProjection']['references']=[]
     elif defect=='extra-field':excluded['before'][0]['decisionId']='forged'
     else:excluded['before'][0]=None
     if os.path.exists('/bad-excluded.docx'):os.unlink('/bad-excluded.docx')
     try:generate_tracked_document('/before.docx','/after.docx','/bad-excluded.docx','events',formatting,tables,metadata,json.dumps(bad));raise AssertionError(defect+' exported')
     except ValueError:assert not os.path.exists('/bad-excluded.docx')
   for variant,path in [('out','/excluded.docx'),('accepted','/accepted.docx'),('rejected','/rejected.docx')]:shutil.copyfile(path,'/excluded-anchors/'+label+'-'+variant+'.docx')
   rows.append({'name':label,'status':'mixed-policy-graph-pass'})
json.dumps(rows)
`));
console.log(JSON.stringify(results,null,2));
assert.equal(results.filter(row=>row.status==='mixed-policy-graph-pass').length,12);
assert.equal(results.filter(row=>row.status==='table-only-no-authority-refused').length,4);
console.log('28 forged excluded references refused');
fs.mkdirSync('docs/jobs/todo/diffchecker-port-20261023/excluded-table-anchors',{recursive:true});
for(const name of py.FS.readdir('/excluded-anchors').filter(n=>n.endsWith('.docx')))fs.writeFileSync('docs/jobs/todo/diffchecker-port-20261023/excluded-table-anchors/'+name,py.FS.readFile('/excluded-anchors/'+name));
