import assert from'node:assert/strict';import fs from'node:fs';import{loadPyodide}from'pyodide';import{compareDocumentModels,diffText}from'../src/features/document-compare/documentComparison.ts';
let requested,forge=false;const manifests=[];globalThis.worklazyDrawingMask=json=>{requested=JSON.parse(json)};globalThis.worklazyDiffJson=(a,b)=>JSON.stringify(diffText(a,b));globalThis.worklazyComparisonManifestJson=(a,b,formatting,tables,metadata)=>{const left=JSON.parse(a),right=JSON.parse(b);if(forge)for(const model of[left,right])for(const ref of model.sourceInventory){if(ref.objectEvent)ref.objectEvent.supported=true;if('objectEventsSupported'in ref)ref.objectEventsSupported=true;}const manifest=compareDocumentModels('before','after',left,right,{formatting,tables,metadata,formattingMask:requested},'en').manifest;manifests.push(manifest);return JSON.stringify(manifest)};
const py=await loadPyodide();py.globals.set('WORKLAZY_FORMATTING_POLICY_JSON',fs.readFileSync('src/features/word-compare/formatting-policy.json','utf8'));for(const n of['compare','accept_revisions','tracked_docx'])py.runPython(fs.readFileSync(`src/features/word-compare/${n}.py`,'utf8'));
const events=fs.readFileSync('tests/word-package-events.mjs','utf8');py.runPython(events.slice(events.indexOf('registry=dict(ET._namespace_map)'),events.indexOf('checks=[]')));py.runPython(fs.readFileSync('tests/word-future-resource-fixtures.py','utf8').replace("if __name__=='__main__':","if False:"));
console.log(py.runPython(String.raw`
case=next(c for c in build_fixtures('/tmp/bookmarks')if c['name']=='anchor-collision')
assert reachable(case['before'])==case['expectedRejectGraph'];assert reachable(case['after'])==case['expectedAcceptGraph']
def project(before,after,stem,formatting=False):
 output=stem+'-tracked.docx';accepted=stem+'-accepted.docx';rejected=stem+'-rejected.docx'
 generate_tracked_document(before,after,output,'events',formatting,True,True);accept_tracked_document(output,accepted)
 with zipfile.ZipFile(output)as source,zipfile.ZipFile(rejected,'w')as out:
  for entry in source.infolist():
   data=source.read(entry.filename)
   if entry.filename.endswith('.xml')and entry.filename!='[Content_Types].xml':
    root=ET.fromstring(data)
    if root.tag.startswith(W):data=ET.tostring(reject(root)[0],encoding='utf-8',xml_declaration=True)
   out.writestr(entry,data)
 for path in [output,accepted,rejected]:assert validate_source(path)
 assert reachable(accepted)==reachable(after);assert reachable(rejected)==reachable(before)
 return output,accepted,rejected
positive=[]
for formatting in [False,True]:
 result=project(case['before'],case['after'],'/tmp/bookmarks/literal-'+str(formatting),formatting);positive.append('literal formatting '+str(formatting))
 assert reachable(result[1])==case['expectedAcceptGraph'];assert reachable(result[2])==case['expectedRejectGraph']
def mutate(source,path,change):
 with zipfile.ZipFile(source)as z:entries={n:z.read(n)for n in z.namelist()}
 root=ET.fromstring(entries['word/document.xml']);change(root);entries['word/document.xml']=ET.tostring(root)
 with zipfile.ZipFile(path,'w')as z:
  for name,data in entries.items():z.writestr(name,data)
 return path
def rename_ids(root):root.find('.//'+W+'bookmarkStart').set(W+'id','91');root.find('.//'+W+'bookmarkEnd').set(W+'id','91')
renamed=mutate(case['after'],'/tmp/bookmarks/id-renamed.docx',rename_ids)
with zipfile.ZipFile(renamed)as z:entries={n:z.read(n)for n in z.namelist()}
entries['word/document.xml']=entries['word/document.xml'].replace(b'w:',b'alias:').replace(b'xmlns:w=',b'xmlns:alias=').replace(b'ns0:',b'alias:').replace(b'xmlns:ns0=',b'xmlns:alias=')
assert b'alias:document' in entries['word/document.xml']
with zipfile.ZipFile(renamed,'w')as z:
 for name,data in entries.items():z.writestr(name,data)
result=project(case['before'],renamed,'/tmp/bookmarks/id-alias')
for path in result:
 with zipfile.ZipFile(path)as z:
  root=ET.fromstring(z.read('word/document.xml'));assert root.find('.//'+W+'bookmarkStart').get(W+'id')==root.find('.//'+W+'bookmarkEnd').get(W+'id')=='91'
positive.append('volatile IDs/namespace aliases')
def change(root,mode):
 body=root.find(W+'body');host=body[0];link=root.find('.//'+W+'hyperlink');start=host.find(W+'bookmarkStart');end=host.find(W+'bookmarkEnd')
 if mode=='partial':host.remove(start);host.insert(1,start)
 elif mode=='cross-paragraph':host.remove(end);body[1].append(end)
 elif mode=='moved':body.remove(host);body.insert(1,host)
 elif mode=='renamed':start.set(W+'name','Renamed');link.set(W+'anchor','Renamed')
 elif mode=='added':
  host.remove(start);host.remove(end);jump=body[1];jump.remove(link);jump.extend(list(link))
 elif mode=='deleted':
  host.remove(start);host.remove(end);jump=body[1];jump.remove(link);jump.extend(list(link))
 elif mode=='duplicate':body.insert(1,copy.deepcopy(host))
 elif mode=='changed-jump':link.find('.//'+W+'t').text='different jump'
 elif mode=='dangling-id':end.set(W+'id','8')
 elif mode=='namespace-spoof':start.tag='{urn:fake}bookmarkStart'
 elif mode=='styled-host':ET.SubElement(host[1],W+'rPr')
 elif mode=='table-host':body.remove(host);ET.SubElement(ET.SubElement(ET.SubElement(body,W+'tbl'),W+'tr'),W+'tc').append(host)
negative=[]
for mode in ['partial','cross-paragraph','moved','renamed','added','deleted','duplicate','changed-jump','dangling-id','namespace-spoof','styled-host','table-host']:
 source=case['before']if mode=='added'else case['after'];path=mutate(source,'/tmp/bookmarks/'+mode+'.docx',lambda root:change(root,mode));before=path if mode=='added'else case['before'];after=case['after']if mode=='added'else path;output='/tmp/bookmarks/'+mode+'-output.docx'
 try:generate_tracked_document(before,after,output,'events',False,True,True)
 except ValueError as error:assert str(error)=='UNSUPPORTED_TRACKED_SOURCE_BOOKMARK_RANGE',(mode,str(error))
 else:raise AssertionError('unsupported bookmark context admitted: '+mode)
 assert not os.path.exists(output);negative.append(mode)
# Paired ordinary-note bookmarks are outside the admitted plain-body context.
for side in ['before','after']:
 payload='<w:bookmarkStart w:id="7" w:name="SharedAnchor"/>'+text(side+' note')+'<w:bookmarkEnd w:id="7"/>'
 package('/tmp/bookmarks/note-'+side+'.docx',p(text('Note')+note_ref()),side,notes=payload)
try:generate_tracked_document('/tmp/bookmarks/note-before.docx','/tmp/bookmarks/note-after.docx','/tmp/bookmarks/note-output.docx','events',False,True,True)
except ValueError as error:assert str(error)=='UNSUPPORTED_TRACKED_SOURCE_BOOKMARK_RANGE',str(error)
else:raise AssertionError('nonbody bookmark admitted')
assert not os.path.exists('/tmp/bookmarks/note-output.docx');negative.append('nonbody note host')
json.dumps({'positiveCases':positive,'literalTerminalGraphs':6,'unsupportedNoOutput':negative})
`));
assert(manifests.some(m=>m.decisions.some(d=>d.objectEvents?.unchangedLinks.length===1&&d.objectEvents.changed===false)));
forge=true;console.log(py.runPython(String.raw`
output='/tmp/bookmarks/forged-output.docx'
try:generate_tracked_document(case['before'],'/tmp/bookmarks/partial.docx',output,'events',False,True,True)
except ValueError as error:assert str(error)=='INVALID_COMPARISON_MANIFEST_SOURCE_INVENTORY',str(error)
else:raise AssertionError('forged source admitted')
assert not os.path.exists(output)
json.dumps({'forgedInventory':'rejected','partialOutput':False})
`));
if(process.env.WORD_BOOKMARK_ARTIFACT_DIR){fs.mkdirSync(process.env.WORD_BOOKMARK_ARTIFACT_DIR,{recursive:true});for(const n of py.FS.readdir('/tmp/bookmarks').filter(n=>n.endsWith('.docx')))fs.writeFileSync(process.env.WORD_BOOKMARK_ARTIFACT_DIR+'/'+n,py.FS.readFile('/tmp/bookmarks/'+n));}
