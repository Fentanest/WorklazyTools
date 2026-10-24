import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadPyodide} from 'pyodide';
import {compareDocumentModels,diffText} from '../src/features/document-compare/documentComparison.ts';
let result,requested;
globalThis.worklazyDiffJson=(a,b)=>JSON.stringify(diffText(a,b));
globalThis.worklazyComparisonManifestJson=(a,b,formatting,tables,metadata)=>{result=compareDocumentModels('before','after',JSON.parse(a),JSON.parse(b),{formatting,tables,metadata,formattingMask:requested},'en');return JSON.stringify(result.manifest)};
const py=await loadPyodide();py.globals.set('WORKLAZY_FORMATTING_POLICY_JSON',fs.readFileSync('src/features/word-compare/formatting-policy.json','utf8'));
for(const name of ['compare','accept_revisions','tracked_docx'])py.runPython(fs.readFileSync(`src/features/word-compare/${name}.py`,'utf8'));
const harness=fs.readFileSync('tests/word-package-events.mjs','utf8');py.runPython(harness.slice(harness.indexOf('def reject(node):'),harness.indexOf('def view(')));
py.runPython(fs.readFileSync('tests/word-future-resource-fixtures.py','utf8').replace("if __name__=='__main__':","if False:"));
py.globals.set('set_mask',enabled=>{requested={fontFamily:true,size:true,style:true,color:true,paragraph:enabled,numbering:true}});
py.globals.set('screen_grid',()=>JSON.stringify({labels:result.views.document.flatMap(v=>v.formattingLabels??[]),actions:result.manifest.propertyActions.filter(a=>a.property==='tblGrid').length}));
const checks=JSON.parse(py.runPython(`
import shutil
os.makedirs('/grid-packages',exist_ok=True)
legacy_reject=reject
source_ids=set()
def reject(node):
 if node.tag==W+'tr' and node.find(W+'trPr/'+W+'ins') is not None:return []
 if node.tag==W+'tc' and node.find(W+'tcPr/'+W+'cellIns') is not None:return []
 if node.tag==W+'cellDel':return []
 if node.tag==W+'tblGrid':
  change=node.find(W+'tblGridChange')
  if change is not None and change.get(W+'id') not in source_ids:return [copy.deepcopy(change.find(W+'tblGrid'))]
 return legacy_reject(node)
def grid(path):
 with zipfile.ZipFile(path) as z:
  root=ET.fromstring(z.read('word/document.xml'));return [[n.get(W+'w') for n in tbl.find(W+'tblGrid').findall(W+'gridCol')] for tbl in root.iter(W+'tbl')]
def source(path,widths,history=False,alias=False):
 body=table([[text('Stable '+str(i)) for i in range(len(widths))]])+p(text('End'))
 package(path,body,'before' if 'before' in path else 'after')
 with zipfile.ZipFile(path) as z:entries={n:z.read(n) for n in z.namelist()}
 root=ET.fromstring(entries['word/document.xml']);tbl=root.find('.//'+W+'tbl');props=tbl.find(W+'tblPr');props.find(W+'tblW').set(W+'w',str(sum(int(w) for w in widths)));props.find(W+'tblW').set(W+'type','dxa');borders=ET.SubElement(props,W+'tblBorders');
 for edge in ['top','left','bottom','right','insideH','insideV']:ET.SubElement(borders,W+edge,{W+'val':'single',W+'sz':'8',W+'color':'000000'})
 ET.SubElement(props,W+'tblLayout',{W+'type':'fixed'})
 for cell,width in zip(tbl.findall(W+'tr/'+W+'tc'),widths):cell.find(W+'tcPr/'+W+'tcW').set(W+'w',str(int(width)))
 g=tbl.find(W+'tblGrid');g[:]=[ET.Element(W+'gridCol',{W+'w':value}) for value in widths]
 if history:
  change=ET.SubElement(g,W+'tblGridChange',{W+'id':'900'});previous=ET.SubElement(change,W+'tblGrid');ET.SubElement(previous,W+'gridCol',{W+'w':'800'})
 data=_serialize_xml(root)
 if alias:data=data.replace(b'xmlns:w=',b'xmlns:wx=').replace(b'<w:',b'<wx:').replace(b'</w:',b'</wx:').replace(b' w:',b' wx:')
 entries['word/document.xml']=data
 with zipfile.ZipFile(path,'w') as z:
  for n,data in entries.items():z.writestr(n,data)
checks=[]
for name,old,new in [('width',['1000','2000'],['1800','3200']),('insert-column',['1800'],['2500','3200']),('delete-column',['1800','3200'],['2500']),('delete-middle',['1000','2000','3000'],['1500','3500'])]:
 for formatting,layout,tables in [(True,True,True),(True,False,True),(False,True,True),(True,True,False)]:
  set_mask(layout);mask={key:True for key in ['fontFamily','size','style','color','paragraph','numbering']};mask['paragraph']=layout
  source('/grid-before.docx',old);source('/grid-after.docx',new)
  if name=='delete-middle':
   with zipfile.ZipFile('/grid-after.docx') as z:entries={n:z.read(n) for n in z.namelist()}
   entries['word/document.xml']=entries['word/document.xml'].replace(b'Stable 1',b'Stable 2')
   with zipfile.ZipFile('/grid-after.docx','w') as z:
    for n,data in entries.items():z.writestr(n,data)
  source_ids=set()
  generate_tracked_document('/grid-before.docx','/grid-after.docx','/grid-out.docx','events',formatting,tables,True,formatting_mask_json=json.dumps(mask))
  screen=json.loads(screen_grid());included=formatting and layout and tables
  assert screen['actions']==(1 if included else 0)
  if included:assert 'Table column widths and layout' in screen['labels']
  accept_tracked_document('/grid-out.docx','/grid-accepted.docx')
  with zipfile.ZipFile('/grid-out.docx') as src,zipfile.ZipFile('/grid-rejected.docx','w') as out:
   for entry in src.infolist():out.writestr(entry,_serialize_xml(reject(_qname_safe_parse(src.read(entry.filename)))[0]) if entry.filename=='word/document.xml' else src.read(entry.filename))
  assert grid('/grid-accepted.docx')==[new]
  target=old if included else [new[0],old[1],new[1]] if tables and name=='delete-middle' else [new[0]] if tables and name=='insert-column' else [new[0],old[1]] if tables and name=='delete-column' else new
  assert grid('/grid-rejected.docx')==[target],(name,formatting,layout,grid('/grid-rejected.docx'),target)
  with zipfile.ZipFile('/grid-out.docx') as z:
   root=ET.fromstring(z.read('word/document.xml'));changes=list(root.iter(W+'tblGridChange'));assert len(changes)==(1 if tables and (included or name!='width') else 0)
   for change in changes:
    assert set(change.attrib)=={W+'id'} # CT_TblGridChange is CT_Markup, not CT_TrackChange
    assert [c.tag for c in change]==[W+'tblGrid'] and all(c.tag==W+'gridCol' for c in change[0])
   tbl=root.find('.//'+W+'tbl');assert [c.tag for c in list(tbl)[:2]]==[W+'tblPr',W+'tblGrid']
  a=extract_document_model(open('/grid-before.docx','rb').read(),True,True,'en');b=extract_document_model(open('/grid-after.docx','rb').read(),True,True,'en');manifest=json.loads(worklazyComparisonManifestJson(a,b,formatting,tables,True))
  if included:
   for defect in ['missing-action','fact','scope','restore-pair','families']:
    bad=copy.deepcopy(manifest);action=next(a for a in bad['propertyActions'] if a['property']=='tblGrid');scope=next(s for s in bad['formattingScopes'] if s['id']==action['scopeId'])
    if defect=='missing-action':bad['propertyActions'].remove(action)
    elif defect=='fact':scope['beforeFact']['supported']={}
    elif defect=='scope':bad['formattingScopes'].remove(scope)
    elif defect=='restore-pair':bad['restorePropertyPairs']=[p for p in bad['restorePropertyPairs'] if p['property']!='tblGrid']
    else:action['families']=[]
    if os.path.exists('/bad-grid.docx'):os.unlink('/bad-grid.docx')
    try:generate_tracked_document('/grid-before.docx','/grid-after.docx','/bad-grid.docx','events',formatting,tables,True,json.dumps(bad),json.dumps(mask));raise AssertionError(defect+' accepted')
    except ValueError:assert not os.path.exists('/bad-grid.docx')
  if tables:
   for defect in ['projection-missing','projection-source','projection-count','projection-changed']:
    bad=copy.deepcopy(manifest);decision=next(d for d in bad['decisions'] if d['type']=='table')
    if defect=='projection-missing':del decision['gridProjection']
    elif defect=='projection-source':decision['gridProjection']['restore'][0]['index']=999
    elif defect=='projection-count':decision['gridProjection']['beforeCount']+=1
    else:decision['gridProjection']['changed']=not decision['gridProjection']['changed']
    if os.path.exists('/bad-grid.docx'):os.unlink('/bad-grid.docx')
    try:generate_tracked_document('/grid-before.docx','/grid-after.docx','/bad-grid.docx','events',formatting,tables,True,json.dumps(bad),json.dumps(mask));raise AssertionError(defect+' accepted')
    except ValueError:assert not os.path.exists('/bad-grid.docx')
  label=name+'-'+str(formatting)+'-'+str(layout)+'-'+str(tables)
  for variant in ['before','after','out','accepted','rejected']:shutil.copyfile('/grid-'+variant+'.docx','/grid-packages/'+label+'-'+variant+'.docx')
  checks.append(label)
# Renamed namespace prefixes and integer lexical zeroes do not create actions.
set_mask(True)
source('/grid-before.docx',['01000','+2000'],alias=True);source('/grid-after.docx',['1000','2000'])
generate_tracked_document('/grid-before.docx','/grid-after.docx','/grid-out.docx','events',True,True,True)
assert json.loads(screen_grid())['actions']==0
# Existing un-attributed grid history remains revised-owned and its IDs reserved.
source('/grid-before.docx',['1000']);source('/grid-after.docx',['2000'],history=True)
source_ids={'900'}
generate_tracked_document('/grid-before.docx','/grid-after.docx','/grid-out.docx','events',True,True,True)
with zipfile.ZipFile('/grid-out.docx') as z:
 changes=list(ET.fromstring(z.read('word/document.xml')).iter(W+'tblGridChange'));assert len(changes)==1 and changes[0].get(W+'id')=='900' and set(changes[0].attrib)=={W+'id'}
checks.append('namespace-alias/numeric-lexical');checks.append('existing-grid-history')
# Unpaired whole-table geometry remains source-owned. Full container absence is
# an existing separately documented boundary; these are geometry-only proofs.
for kind in ['before','after']:
 source('/own-before.docx',['1000','2000']);source('/own-after.docx',['2500'])
 absent='/own-after.docx' if kind=='before' else '/own-before.docx'
 with zipfile.ZipFile(absent) as z:entries={n:z.read(n) for n in z.namelist()}
 root=ET.fromstring(entries['word/document.xml']);body=root.find(W+'body');body.remove(body.find(W+'tbl'));entries['word/document.xml']=_serialize_xml(root)
 with zipfile.ZipFile(absent,'w') as z:
  for n,data in entries.items():z.writestr(n,data)
 generate_tracked_document('/own-before.docx','/own-after.docx','/own-out.docx','events',False,True,True)
 assert grid('/own-out.docx')==[['1000','2000'] if kind=='before' else ['2500']]
 checks.append(kind+'-unpaired-source-geometry-only')
# Included merged/offset geometry and colliding prior grid history fail closed.
for case in ['span','offset','history-structure']:
 source('/guard-before.docx',['1000','2000']);source('/guard-after.docx',['2500'],history=case=='history-structure')
 if case in ['span','offset']:
  with zipfile.ZipFile('/guard-before.docx') as z:entries={n:z.read(n) for n in z.namelist()}
  root=ET.fromstring(entries['word/document.xml'])
  if case=='span':ET.SubElement(root.find('.//'+W+'tcPr'),W+'gridSpan',{W+'val':'2'})
  else:
   source_row=root.find('.//'+W+'tr');props=ET.Element(W+'trPr');source_row.insert(0,props);ET.SubElement(props,W+'gridBefore',{W+'val':'1'})
  entries['word/document.xml']=_serialize_xml(root)
  with zipfile.ZipFile('/guard-before.docx','w') as z:
   for n,data in entries.items():z.writestr(n,data)
 for layout in [False,True]:
  set_mask(layout);mask={key:True for key in ['fontFamily','size','style','color','paragraph','numbering']};mask['paragraph']=layout
  if os.path.exists('/guard-out.docx'):os.unlink('/guard-out.docx')
  try:generate_tracked_document('/guard-before.docx','/guard-after.docx','/guard-out.docx','events',True,True,True,formatting_mask_json=json.dumps(mask));raise AssertionError(case+' emitted')
  except ValueError as error:assert str(error)=='UNSUPPORTED_TRACKED_SOURCE_GRID_GEOMETRY' and not os.path.exists('/guard-out.docx'),str(error)
 checks.append(case+'-geometry-refusal')

json.dumps(checks)
`));
assert.equal(checks.length,23);console.log(JSON.stringify(checks));
fs.mkdirSync('docs/jobs/todo/diffchecker-port-20261023/grid-packages',{recursive:true});
for(const name of py.FS.readdir('/grid-packages').filter(name=>name.endsWith('.docx')))fs.writeFileSync('docs/jobs/todo/diffchecker-port-20261023/grid-packages/'+name,py.FS.readFile('/grid-packages/'+name));
