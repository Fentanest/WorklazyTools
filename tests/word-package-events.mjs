import assert from 'node:assert/strict';import fs from 'node:fs';import {createHash} from 'node:crypto';import {loadPyodide} from 'pyodide';
import {compareDocumentModels,diffText} from '../src/features/document-compare/documentComparison.ts';
const all=[];let last,requested;globalThis.worklazyDrawingMask=json=>{requested=JSON.parse(json)};globalThis.worklazyDiffJson=(a,b)=>JSON.stringify(diffText(a,b));globalThis.worklazyComparisonManifestJson=(a,b,formatting,tables,metadata)=>{last=compareDocumentModels('before','after',JSON.parse(a),JSON.parse(b),{formatting,tables,metadata,formattingMask:requested},'en');all.push(last);return JSON.stringify(last.manifest)};
const py=await loadPyodide();py.globals.set('WORKLAZY_FORMATTING_POLICY_JSON',fs.readFileSync('src/features/word-compare/formatting-policy.json','utf8'));
for(const name of ['compare','accept_revisions','tracked_docx'])py.runPython(fs.readFileSync(`src/features/word-compare/${name}.py`,'utf8'));
py.runPython(String.raw`
registry=dict(ET._namespace_map);_qname_safe_parse(('<x:p xmlns:x="'+WORD_NS+'" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:hint="urn:test" mc:Ignorable="hint"/>').encode(),False);assert ET._namespace_map==registry
REL='http://schemas.openxmlformats.org/officeDocument/2006/relationships/'
NS=' xmlns:w="'+WORD_NS+'" xmlns:r="'+REL[:-1]+'" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"'
def text(value):return '<w:r><w:t xml:space="preserve">'+value+'</w:t></w:r>'
def image():return '<w:drawing><wp:inline><wp:extent cx="914400" cy="914400"/><wp:docPr id="1" name="Sample"/><wp:cNvGraphicFramePr/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="0" name="Image"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdImage"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="914400"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>'
import struct,zlib
def png(rgb):
    def chunk(kind,data):return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
    return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',1,1,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(b'\x00'+bytes(rgb)))+chunk(b'IEND',b'')
OLDPNG=png((255,0,0));NEWPNG=png((0,0,255))
def link(value):return '<w:hyperlink r:id="rIdLink">'+text(value)+'</w:hyperlink>'
def p(value):return '<w:p>'+value+'</w:p>'
def package(path,body,media,url,header=None,external=False):
 with zipfile.ZipFile(path,'w') as z:
  z.writestr('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'+('<Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>' if header is not None else '')+'</Types>')
  z.writestr('word/document.xml','<w:document'+NS+'><w:body>'+body+('<w:sectPr><w:headerReference w:type="default" r:id="rIdHeader"/></w:sectPr>' if header is not None else '')+'</w:body></w:document>')
  z.writestr('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdMain" Type="'+REL+'officeDocument" Target="word/document.xml"/></Relationships>')
  parts=['document.xml']
  if header is not None:z.writestr('word/header1.xml','<w:hdr'+NS+'>'+header+'</w:hdr>');parts.append('header1.xml')
  for part in parts:z.writestr('word/_rels/'+part+'.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rIdImage" Type="'+REL+'image" Target="'+(url if external else 'media/image1.png')+'"'+(' TargetMode="External"' if external else '')+'/><Relationship Id="rIdLink" Type="'+REL+'hyperlink" Target="'+url+'" TargetMode="External"/>'+('<Relationship Id="rIdHeader" Type="'+REL+'header" Target="header1.xml"/>' if part=='document.xml' and header is not None else '')+'</Relationships>')
  z.writestr('word/media/image1.png',media)
def reject(node):
 # Independent author-scoped paragraph-mark semantics: rejecting an inserted
 # break joins its surviving content with the next paragraph. A wholly new
 # paragraph has no surviving content and disappears. Property changes restore
 # their explicit before snapshots, independently of the production codec.
 if node.tag in [W+'rPr',W+'pPr',W+'tblPr',W+'trPr',W+'tcPr']:
  change=node.find(node.tag+'Change')
  if change is not None and change.get(W+'author')=='events':return reject(copy.deepcopy(change.find(node.tag)))
 if node.tag==W+'ins' and node.get(W+'author')=='events':return []
 children=[];pending=None
 for child in node:
  marker=child.find(W+'pPr/'+W+'rPr/'+W+'ins') if child.tag==W+'p' else None
  inserted=marker is not None and marker.get(W+'author')=='events'
  values=reject(child)
  for value in values:
   if pending is not None:
    if value.tag==W+'p':
     pending.extend(item for item in value if item.tag!=W+'pPr');value=pending;pending=None
    else:children.append(pending);pending=None
   if inserted:
    if any(item.tag!=W+'pPr' for item in value):pending=value
   else:children.append(value)
 if pending is not None:children.append(pending)
 node[:]=children
 if node.tag==W+'del' and node.get(W+'author')=='events':return children
 if node.tag==W+'delText':node.tag=W+'t'
 return [node]
def view(path,rejected=False):
 with zipfile.ZipFile(path) as z:
  results={}
  for part in ['word/document.xml','word/header1.xml']:
   if part not in z.namelist():continue
   root=ET.fromstring(z.read(part))
   if rejected:root=reject(root)[0]
   relations={n.get('Id'):n for n in ET.fromstring(z.read('word/_rels/'+part.split('/')[-1]+'.rels'))}
   def events(node):
    if node.tag==W+'hyperlink':
     relationship=relations[node.get(R+'id')];value=''.join(n.text or '' for n in node.iter(W+'t'));return [('link',relationship.get('Target'),value)] if value else []
    if node.tag==W+'drawing':
     blip=node.find('.//{http://schemas.openxmlformats.org/drawingml/2006/main}blip');relationship=relations[blip.get(R+'embed') or blip.get(R+'link')]
     if relationship.get('TargetMode')=='External':return [('external-image',relationship.get('Target'))]
     target=posixpath.normpath(posixpath.join(posixpath.dirname(part),relationship.get('Target')))
     click=node.find('.//{http://schemas.openxmlformats.org/drawingml/2006/main}hlinkClick');return [('image',hashlib.sha256(z.read(target)).hexdigest(),relations[click.get(R+'id')].get('Target') if click is not None else None)]
    if node.tag==W+'t':return [('text',node.text or '')]
    return [value for child in node for value in events(child)]
   def coalesce(values):
    out=[]
    for value in values:
     if value[0]=='text' and out and out[-1][0]=='text':out[-1]=('text',out[-1][1]+value[1])
     elif value[0]=='link' and out and out[-1][:2]==value[:2]:out[-1]=('link',value[1],out[-1][2]+value[2])
     else:out.append(value)
    return out
   results[part]=[coalesce(events(paragraph)) for paragraph in root.iter(W+'p')]
  return results
def check(name,before,after,old=OLDPNG,new=NEWPNG,oldurl='https://before.example/a',newurl='https://after.example/b',headers=None,external=False,setup=None):
 package('/before.docx',before,old,oldurl,headers[0] if headers else None,external);package('/after.docx',after,new,newurl,headers[1] if headers else None,external)
 if setup:setup()
 generate_tracked_document('/before.docx','/after.docx','/out.docx','events',False,True,True)
 accept_tracked_document('/out.docx','/accepted.docx')
 with zipfile.ZipFile('/out.docx') as source,zipfile.ZipFile('/rejected.docx','w') as output:
  for entry in source.infolist():
   data=source.read(entry.filename)
   if entry.filename in ['word/document.xml','word/header1.xml']:
    data=_serialize_xml(reject(_qname_safe_parse(data))[0])
   output.writestr(entry,data)
 import shutil
 os.makedirs('/p-packages',exist_ok=True)
 for variant in ['before','after','out','accepted','rejected']:shutil.copyfile('/'+variant+'.docx','/p-packages/'+name.replace(' ','-')+'-'+variant+'.docx')

 assert view('/accepted.docx')==view('/after.docx'),(name,'accept',view('/accepted.docx'),view('/after.docx'))
 assert view('/rejected.docx')==view('/before.docx'),(name,'reject',view('/out.docx',True),view('/before.docx'))
 return name
checks=[]
checks.append(check('mixed run image collision',p('<w:r><w:t>Old </w:t>'+image()+'<w:t> clause</w:t></w:r>'),p('<w:r><w:t>New </w:t>'+image()+'<w:t> clause</w:t></w:r>')))
checks.append(check('same words changed URL',p(link('Same label')),p(link('Same label'))))
checks.append(check('linked changed words',p(link('Old clause')),p(link('New clause')),oldurl='https://same.example/link',newurl='https://same.example/link'))
checks.append(check('linked to plain',p(link('Same label')),p(text('Same label'))))
checks.append(check('before image paragraph',p('<w:r>'+image()+'</w:r>')+p(text('Stable anchor')),p(text('Stable anchor'))))
checks.append(check('final image paragraph',p(text('Stable anchor'))+p('<w:r>'+image()+'</w:r>'),p(text('Stable anchor'))))
checks.append(check('final linked paragraph',p(text('Stable anchor'))+p(link('Deleted link')),p(text('Stable anchor'))))
checks.append(check('moved image paragraph',p('<w:r>'+image()+'</w:r>')+p(text('First anchor unique'))+p(text('Second anchor unique')),p(text('First anchor unique'))+p(text('Second anchor unique'))+p('<w:r>'+image()+'</w:r>'),new=OLDPNG))
checks.append(check('part scoped collisions',p(link('Body old')),p(link('Body new')),headers=(p(text('Header old ')+link('label')+'<w:r>'+image()+'</w:r>'),p(text('Header new ')+link('label')+'<w:r>'+image()+'</w:r>'))))
MC='http://schemas.openxmlformats.org/markup-compatibility/2006'
alternate='<mc:AlternateContent xmlns:mc="'+MC+'"><mc:Choice xmlns:feature="urn:before-feature" Requires="feature">'+image()+'</mc:Choice><mc:Fallback>'+image()+'</mc:Fallback></mc:AlternateContent>'
NS+=' xmlns:feature="urn:after-feature"'
def inherited_mc():
 with zipfile.ZipFile('/before.docx') as source:entries={name:source.read(name) for name in source.namelist()}
 entries['word/document.xml']=entries['word/document.xml'].replace(b'xmlns:feature="urn:after-feature"',b'xmlns:feature="urn:before-feature" xmlns:compat="http://schemas.openxmlformats.org/markup-compatibility/2006" compat:Ignorable="feature"')
 with zipfile.ZipFile('/before.docx','w') as output:
  for name,data in entries.items():output.writestr(name,data)
checks.append(check('QName shadowed alternate content',p('<w:r>'+alternate+'</w:r>'),p('<w:r>'+image()+'</w:r>'),setup=inherited_mc))
for path in ['/out.docx','/rejected.docx']:
 with zipfile.ZipFile(path) as z:
  pending={};contexts=[];seen=0
  for event,node in ET.iterparse(io.BytesIO(z.read('word/document.xml')),events=('start-ns','start','end')):
   if event=='start-ns':pending[node[0] or '']=node[1]
   elif event=='start':
    context=dict(contexts[-1]) if contexts else {};context.update(pending);pending.clear();contexts.append(context)
    if node.get('{'+MC+'}Ignorable'):
     assert all(context[prefix]=='urn:before-feature' for prefix in node.get('{'+MC+'}Ignorable').split())
    if node.tag=='{'+MC+'}Choice':
     assert all(context[prefix]=='urn:before-feature' for prefix in node.get('Requires').split());seen+=1
   else:contexts.pop()
  assert seen==1
# Same cached image under aliased namespace prefixes has the same semantic event.
checks.append(check('namespace aliases',p('<w:r>'+image().replace('a:','old:').replace('<w:drawing>','<w:drawing xmlns:old="http://schemas.openxmlformats.org/drawingml/2006/main">')+'</w:r>'),p('<w:r>'+image()+'</w:r>'),new=OLDPNG))
clickable=image().replace('<wp:docPr id="1" name="Sample"/>','<wp:docPr id="1" name="Sample"><a:hlinkClick r:id="rIdLink"/></wp:docPr>')
checks.append(check('drawing click relationships',p('<w:r>'+clickable+'</w:r>'),p('<w:r>'+clickable+'</w:r>')))
checks.append(check('table cell URL collision','<w:tbl><w:tr><w:tc>'+p(link('Same label'))+'</w:tc></w:tr></w:tbl>','<w:tbl><w:tr><w:tc>'+p(link('Same label'))+'</w:tc></w:tr></w:tbl>'))
checks.append(check('external image declarations',p('<w:r>'+image().replace('r:embed=','r:link=')+'</w:r>'),p('<w:r>'+image().replace('r:embed=','r:link=')+'</w:r>'),external=True))
checks.append(check('flowed image boundary',p(text('😀 old ' )+'<w:r>'+image()+'</w:r>'),p(text('😀 longer prefix ' )+'<w:r>'+image()+'</w:r>'),new=OLDPNG))
assert not next(d['objectEvents']['changed'] for d in json.loads(worklazyComparisonManifestJson(extract_document_model(open('/before.docx','rb').read(),True,True,'en'),extract_document_model(open('/after.docx','rb').read(),True,True,'en'),False,True,True))['decisions'] if d.get('objectEvents'))
def add_numbering():
 with zipfile.ZipFile('/before.docx') as source:entries={name:source.read(name) for name in source.namelist()}
 root=ET.fromstring(entries['word/document.xml']);paragraph=root.find('.//'+W+'p');properties=ET.Element(W+'pPr');number=ET.SubElement(properties,W+'numPr');ET.SubElement(number,W+'numId',{W+'val':'1'});paragraph.insert(0,properties);entries['word/document.xml']=ET.tostring(root)
 entries['word/numbering.xml']=('<w:numbering xmlns:w="'+WORD_NS+'"><w:abstractNum w:abstractNumId="1"><w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/></w:lvl></w:abstractNum><w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num></w:numbering>').encode()
 rels=ET.fromstring(entries['word/_rels/document.xml.rels']);ET.SubElement(rels,PR+'Relationship',{'Id':'rIdNumbering','Type':REL+'numbering','Target':'numbering.xml'});entries['word/_rels/document.xml.rels']=ET.tostring(rels)
 types=ET.fromstring(entries['[Content_Types].xml']);ET.SubElement(types,CT+'Override',{'PartName':'/word/numbering.xml','ContentType':'application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml'});entries['[Content_Types].xml']=ET.tostring(types)
 with zipfile.ZipFile('/before.docx','w') as output:
  for name,data in entries.items():output.writestr(name,data)
checks.append(check('numbering merge resource relationship',p('<w:r>'+image()+'</w:r>')+p(text('Stable anchor')),p(text('Stable anchor')),setup=add_numbering))
with zipfile.ZipFile('/out.docx') as output:
 assert 'word/numbering.xml' in output.namelist();assert any(node.get('Type')==REL+'numbering' for node in ET.fromstring(output.read('word/_rels/document.xml.rels')))
# Interior before events must interrupt equal-text coalescing.
witness=p('<w:r><w:t>Same</w:t>'+image()+'<w:t xml:space="preserve"> text</w:t></w:r>')
plain=p(text('Same text'))
checks.append(check('inline deleted start',p('<w:r>'+image()+'<w:t>Same text</w:t></w:r>'),plain))
checks.append(check('inline deleted middle',witness,plain))
checks.append(check('inline deleted end',p('<w:r><w:t>Same text</w:t>'+image()+'</w:r>'),plain))
second=image().replace('id="1" name="Sample"','id="2" name="Second"')
adjacent=p('<w:r><w:t>Same</w:t>'+image()+second+'<w:t xml:space="preserve"> text</w:t></w:r>')
checks.append(check('adjacent deleted objects',adjacent,plain))
checks.append(check('adjacent one retained',adjacent,witness,new=OLDPNG))
checks.append(check('inline shifted middle',witness,p(text('Same text')+'<w:r>'+image()+'</w:r>'),new=OLDPNG))
checks.append(check('matched full copy once',witness,witness,new=OLDPNG))
checks.append(check('matched cell inline deletion','<w:tbl><w:tr><w:tc>'+witness+'</w:tc></w:tr></w:tbl>','<w:tbl><w:tr><w:tc>'+plain+'</w:tc></w:tr></w:tbl>'))
checks.append(check('header inline deletion',p(text('Stable body')),p(text('Stable body')),headers=(witness,plain)))
# Fault injection keeps declarations valid but removes or duplicates actual
# emission. The codec must fail closed before writing any package.
for variant in ['before','after']:__import__('shutil').copyfile('/p-packages/inline-shifted-middle-'+variant+'.docx','/'+variant+'.docx')
original_tokens=_styled_tokens;original_drawing=_drawing_revision
for fault in ['omitted-before-event','duplicate-before-event','omitted-after-event','duplicate-after-event']:
 def tokens_with_missing_event(paragraph,collect_events=False):
  result=original_tokens(paragraph,collect_events)
  if collect_events and _MANIFEST_NODE_KEYS.get(paragraph,('unknown',))[0]==('before' if 'before' in fault else 'after'):return result[0],{offset:[node for node in nodes if not _is_drawing_event(node)] for offset,nodes in result[1].items()}
  return result
 def drawing_with_duplicate(source,kind,writer):
  result=original_drawing(source,kind,writer)
  if kind==('del' if 'before' in fault else 'ins'):_consume_object(source)
  return result
 _styled_tokens=tokens_with_missing_event if fault.startswith('omitted') else original_tokens
 _drawing_revision=drawing_with_duplicate if fault.startswith('duplicate') else original_drawing
 if os.path.exists('/fault.docx'):os.unlink('/fault.docx')
 try:
  generate_tracked_document('/before.docx','/after.docx','/fault.docx','events',False,True,True);raise AssertionError(fault+' accepted')
 except ValueError as error:assert ('OBJECT_CONSUMPTION' if fault.startswith('omitted') else 'OBJECT_EMISSION') in str(error)
 finally:_styled_tokens=original_tokens;_drawing_revision=original_drawing
 assert not os.path.exists('/fault.docx')
for variant in ['before','after']:__import__('shutil').copyfile('/p-packages/numbering-merge-resource-relationship-'+variant+'.docx','/'+variant+'.docx')
# No image wrapper can escape revision schema, and every used resource resolves.
for filename in os.listdir('/p-packages'):
 if not filename.endswith(('-out.docx','-accepted.docx','-rejected.docx')):continue
 with zipfile.ZipFile('/p-packages/'+filename) as z:
  types=ET.fromstring(z.read('[Content_Types].xml'))
  for part in ['word/document.xml','word/header1.xml']:
   if part not in z.namelist():continue
   root=ET.fromstring(z.read(part));rels={n.get('Id'):n for n in ET.fromstring(z.read('word/_rels/'+part.split('/')[-1]+'.rels'))}
   for revision in root.iter():
    if revision.tag in {W+'ins',W+'del'}:assert revision.find(W+'hyperlink') is None
    for name,rid in revision.attrib.items():
     if not name.startswith(R):continue
     relationship=rels[rid]
     if relationship.get('TargetMode')=='External':continue
     target=relationship.get('Target');target=target.lstrip('/') if target.startswith('/') else posixpath.normpath(posixpath.join(posixpath.dirname(part),target))
     assert target in z.namelist(),(filename,part,target)
     assert any(n.get('PartName')=='/'+target or n.get('Extension')==target.rsplit('.',1)[-1] for n in types)
# Package-local IDs are addresses, never semantic image changes.
import shutil
def volatile_ids():
 with zipfile.ZipFile('/after.docx') as source:entries={name:source.read(name) for name in source.namelist()}
 entries['word/document.xml']=entries['word/document.xml'].replace(b'rIdImage',b'rIdRenamed').replace(b'docPr id="1"',b'docPr id="999"')
 entries['word/_rels/document.xml.rels']=entries['word/_rels/document.xml.rels'].replace(b'rIdImage',b'rIdRenamed')
 with zipfile.ZipFile('/after.docx','w') as output:
  for name,data in entries.items():output.writestr(name,data)
checks.append(check('volatile relationship identifiers',p(text('Volatile stable')+'<w:r>'+image()+'</w:r>'),p(text('Volatile stable')+'<w:r>'+image()+'</w:r>'),new=OLDPNG,setup=volatile_ids))
volatile_manifest=json.loads(worklazyComparisonManifestJson(extract_document_model(open('/before.docx','rb').read(),True,True,'en'),extract_document_model(open('/after.docx','rb').read(),True,True,'en'),False,True,True))
assert not any(d.get('objectEvents',{}).get('changed') for d in volatile_manifest['decisions'])
# Restore the original independent negative-fixture scope.
for side in ['before','after']:shutil.copyfile('/p-packages/numbering-merge-resource-relationship-'+side+'.docx','/'+side+'.docx')
# Source-bound negative controls, including real but unrelated valid event refs.
a=extract_document_model(open('/before.docx','rb').read(),True,True,'en');b=extract_document_model(open('/after.docx','rb').read(),True,True,'en');value=json.loads(worklazyComparisonManifestJson(a,b,False,True,True))
for mutation in ['missing','duplicate','changed-flag','wrong-position']:
 bad=copy.deepcopy(value);decision=next(d for d in bad['decisions'] if d.get('objectEvents'))
 if mutation=='missing':del decision['objectEvents']
 elif mutation=='duplicate':decision['objectEvents']['before']*=2
 elif mutation=='changed-flag':decision['objectEvents']['changed']=not decision['objectEvents']['changed']
 else:decision['objectEvents']['before'][0]['objectEvent']['start']+=1
 if os.path.exists('/bad.docx'):os.unlink('/bad.docx')
 try:
  generate_tracked_document('/before.docx','/after.docx','/bad.docx','events',False,True,True,json.dumps(bad));raise AssertionError(mutation+' accepted')
 except ValueError as error:assert 'COMPARISON_MANIFEST' in str(error)
 assert not os.path.exists('/bad.docx')
for mutation in ['missing-image','missing-mime','duplicate-relationship','undefined-qname','wrong-type']:
 for side in ['before','after']:
  with zipfile.ZipFile('/'+side+'.docx') as source,zipfile.ZipFile('/tampered-'+side+'.docx','w') as out:
   for entry in source.infolist():
    if mutation=='missing-image' and entry.filename=='word/media/image1.png':continue
    data=source.read(entry.filename)
    if mutation=='missing-mime' and entry.filename=='[Content_Types].xml':
     root=ET.fromstring(data)
     for child in list(root):
      if child.get('Extension')=='png':root.remove(child)
     data=ET.tostring(root)
    if mutation=='duplicate-relationship' and entry.filename=='word/_rels/document.xml.rels':
     root=ET.fromstring(data);root.append(copy.deepcopy(root[0]));data=ET.tostring(root)
    if mutation=='wrong-type' and entry.filename=='word/_rels/document.xml.rels':data=data.replace((REL+'image').encode(),b'urn:other:image')
    if mutation=='undefined-qname' and entry.filename=='word/document.xml':data=data.replace(b'<wp:inline>',b'<wp:inline xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="undefined:Shape">')
    out.writestr(entry,data)
 if os.path.exists('/bad.docx'):os.unlink('/bad.docx')
 try:
  generate_tracked_document('/tampered-before.docx','/tampered-after.docx','/bad.docx','events',False,True,True);raise AssertionError(mutation+' accepted')
 except ValueError as error:assert 'UNSUPPORTED_TRACKED_SOURCE' in str(error)
 assert not os.path.exists('/bad.docx')


`);
// P2: independent package/style targets replace P1's temporary size opt-out.
for(const [formatting,sizeEnabled,colorEnabled,sameImage,fontEnabled,styleEnabled] of [[true,true,true,false,true,true],[true,false,true,false,true,true],[false,true,true,false,true,true],[true,true,true,true,true,true],[true,false,false,true,true,true],[true,true,true,false,false,false],[true,false,false,true,false,false]]) {
 requested={fontFamily:fontEnabled,size:sizeEnabled,style:styleEnabled,color:colorEnabled,paragraph:true,numbering:true};
 py.globals.set('requested_json',JSON.stringify(requested));py.globals.set('formatting',formatting);py.globals.set('same_image',sameImage);
 py.runPython(String.raw`
import shutil
for context in ['body','header','cell','adjacent','object-only','flowed','mixed-run']:
 def styled(size,color,font,bold,language):return '<w:r><w:rPr><w:rFonts w:ascii="'+font+'"/><w:b w:val="'+bold+'"/><w:color w:val="'+color+'"/><w:sz w:val="'+size+'"/><w:lang w:val="'+language+'"/></w:rPr>'+image()+'</w:r>'
 for side,size,color,font,bold,language in [('before','20','FF0000','Arial','0','en-US'),('after','40','0000FF','Calibri','1','ko-KR')]:
  paragraph=p(('' if context=='object-only' else text(('😀 old ' if side=='before' else '😀 longer prefix ') if context=='flowed' else 'Same '))+styled(size,color,font,bold,language)+(styled(str(int(size)+10),color,font,bold,language) if context=='adjacent' else '')+('' if context in ['object-only','flowed'] else text(' text')))
  if context=='mixed-run':paragraph=p(styled(size,color,font,bold,language).replace(image(),'<w:t>Same </w:t>'+image()+'<w:t> text</w:t>'))
  package('/style-'+side+'.docx',p(text('Stable body')) if context=='header' else '<w:tbl><w:tr><w:tc>'+paragraph+'</w:tc></w:tr></w:tbl>' if context=='cell' else paragraph,OLDPNG if side=='before' or same_image else NEWPNG,'https://same.example',paragraph if context=='header' else None)
 a=extract_document_model(open('/style-before.docx','rb').read(),True,True,'en');b=extract_document_model(open('/style-after.docx','rb').read(),True,True,'en')
 manifest=worklazyComparisonManifestJson(a,b,formatting,True,True)
 generate_tracked_document('/style-before.docx','/style-after.docx','/style-out.docx','events',formatting,True,True,manifest,requested_json)
 accept_tracked_document('/style-out.docx','/style-accepted.docx')
 with zipfile.ZipFile('/style-out.docx') as source,zipfile.ZipFile('/style-rejected.docx','w') as output:
  for entry in source.infolist():output.writestr(entry,_serialize_xml(reject(_qname_safe_parse(source.read(entry.filename)))[0]) if entry.filename in ['word/document.xml','word/header1.xml'] else source.read(entry.filename))
 def styles(path):
  with zipfile.ZipFile(path) as z:
   values=[]
   for part in ['word/document.xml','word/header1.xml']:
    if part not in z.namelist():continue
    for run in ET.fromstring(z.read(part)).iter(W+'r'):
     if run.find(W+'drawing') is not None:
      props=run.find(W+'rPr');values.append(tuple(props.find(W+name).get(W+attribute) for name,attribute in [('rFonts','ascii'),('b','val'),('color','val'),('sz','val'),('lang','val')]))
   return values
 count=2 if context=='adjacent' else 1
 expected_after=[('Calibri','1','0000FF',str(40+10*i),'ko-KR') for i in range(count)]
 mask=json.loads(requested_json)
 expected_reject=[('Arial' if formatting and mask['fontFamily'] else 'Calibri','0' if formatting and mask['style'] else '1','FF0000' if formatting and mask['color'] else '0000FF',str((20 if formatting and mask['size'] else 40)+10*i),'ko-KR') for i in range(count)]
 assert styles('/style-accepted.docx')==expected_after,(context,'accept',styles('/style-accepted.docx'))
 assert styles('/style-rejected.docx')==expected_reject,(context,'reject',styles('/style-rejected.docx'),expected_reject)
 assert view('/style-accepted.docx')==view('/style-after.docx')
 assert view('/style-rejected.docx')==view('/style-before.docx')
 name='properties-'+context+'-'+str(formatting)+'-'+str(mask['size'])+'-'+str(mask['color'])+'-'+str(same_image)+'-'+str(mask['fontFamily'])+'-'+str(mask['style'])
 for variant in ['before','after','out','accepted','rejected']:shutil.copyfile('/style-'+variant+'.docx','/p-packages/'+name+'-'+variant+'.docx')
 # Missing/extra/forged scope facts cannot be recovered or repaired by Python.
 value=json.loads(manifest)
 for mutation in ['missing','duplicate','source','family','fact','unrelated']:
  bad=copy.deepcopy(value)
  def descendants(items):return [d for item in items for d in [item]+descendants(item.get('children',[]))]
  decision=next(d for d in descendants(bad['decisions']) if d.get('objectEvents',{}).get('drawingProperties'));pairs=decision['objectEvents']['drawingProperties']
  if mutation=='unrelated':
   if len(pairs)<2:continue
   pairs[0]['before']=copy.deepcopy(pairs[1]['before'])
  elif mutation=='missing':pairs.clear()
  elif mutation=='duplicate':pairs.append(copy.deepcopy(pairs[0]))
  elif mutation=='source':pairs[0]['before']['path'].append(0)
  elif mutation=='family':pairs[0]['families'].append(W+'lang')
  else:pairs[0]['beforeFact']['history']=not pairs[0]['beforeFact']['history']
  if os.path.exists('/bad.docx'):os.unlink('/bad.docx')
  try:generate_tracked_document('/style-before.docx','/style-after.docx','/bad.docx','events',formatting,True,True,json.dumps(bad),requested_json);raise AssertionError(mutation+' accepted')
  except ValueError as error:assert 'INVALID_COMPARISON_MANIFEST_OBJECT_PROPERTIES' in str(error)
  assert not os.path.exists('/bad.docx')
`);
 if(sameImage)assert.equal(last.summary.format>0,formatting&&(fontEnabled||styleEnabled||sizeEnabled||colorEnabled),'image-only run formatting must follow the same selected scope on screen');
}
requested={fontFamily:true,size:true,style:true,color:true,paragraph:true,numbering:true};
py.globals.set('requested_json',JSON.stringify(requested));
py.runPython(String.raw`
# Master scope and metadata scope are independent: excluded stories remain
# exactly the revised package bytes even when their drawing styles differ.
for formatting in [False,True]:
 for side,size,media in [('before','20',OLDPNG),('after','40',NEWPNG)]:package('/scope-'+side+'.docx',p(text('Stable body')),media,'https://same.example',p('<w:r><w:rPr><w:sz w:val="'+size+'"/></w:rPr>'+image()+'</w:r>'))
 a=extract_document_model(open('/scope-before.docx','rb').read(),True,True,'en');b=extract_document_model(open('/scope-after.docx','rb').read(),True,True,'en');manifest=worklazyComparisonManifestJson(a,b,formatting,True,False)
 generate_tracked_document('/scope-before.docx','/scope-after.docx','/scope-out.docx','events',formatting,True,False,manifest,requested_json)
 accept_tracked_document('/scope-out.docx','/scope-accepted.docx')
 with zipfile.ZipFile('/scope-out.docx') as output,zipfile.ZipFile('/scope-after.docx') as after:
  for part in ['word/header1.xml','word/_rels/header1.xml.rels']:assert output.read(part)==after.read(part)
 assert view('/scope-out.docx',True)==view('/scope-after.docx')
 assert view('/scope-accepted.docx')==view('/scope-after.docx')
 for variant in ['before','after','out','accepted']:shutil.copyfile('/scope-'+variant+'.docx','/p-packages/properties-excluded-metadata-'+str(formatting)+'-'+variant+'.docx')
# Absent explicit run properties project to revised defaults when formatting is
# excluded, and included absent families are genuinely removed on reject.
for original_has_properties in [False,True]:
 for side in ['before','after']:
  props='<w:rPr><w:sz w:val="20"/></w:rPr>' if (side=='before')==original_has_properties else ''
  package('/absence-'+side+'.docx',p(text('Same ' )+'<w:r>'+props+image()+'</w:r>'),OLDPNG if side=='before' else NEWPNG,'https://same.example')
 for formatting in [False,True]:
  a=extract_document_model(open('/absence-before.docx','rb').read(),True,True,'en');b=extract_document_model(open('/absence-after.docx','rb').read(),True,True,'en');manifest=worklazyComparisonManifestJson(a,b,formatting,True,True)
  generate_tracked_document('/absence-before.docx','/absence-after.docx','/absence-out.docx','events',formatting,True,True,manifest,requested_json)
  accept_tracked_document('/absence-out.docx','/absence-accepted.docx')
  with zipfile.ZipFile('/absence-out.docx') as output:
   root=reject(ET.fromstring(output.read('word/document.xml')))[0];size=root.find('.//'+W+'r/'+W+'rPr/'+W+'sz')
   assert (size is not None)==(original_has_properties if formatting else not original_has_properties)
   if size is not None:assert size.get(W+'val')=='20'
  assert view('/absence-accepted.docx')==view('/absence-after.docx')
  assert view('/absence-out.docx',True)==view('/absence-before.docx')
  for variant in ['before','after','out','accepted']:shutil.copyfile('/absence-'+variant+'.docx','/p-packages/properties-absence-'+str(original_has_properties)+'-'+str(formatting)+'-'+variant+'.docx')
# Existing revised property history remains on the inserted source event; the
# restored deleted event uses revised effective properties, as declared by TS.
for side,size,media in [('before','20',OLDPNG),('after','40',NEWPNG)]:
 history='<w:rPrChange w:id="77" w:author="Original author"><w:rPr><w:sz w:val="30"/></w:rPr></w:rPrChange>' if side=='after' else ''
 package('/history-'+side+'.docx',p('<w:r><w:rPr><w:sz w:val="'+size+'"/>'+history+'</w:rPr>'+image()+'</w:r>'),media,'https://same.example')
for formatting in [False,True]:
 a=extract_document_model(open('/history-before.docx','rb').read(),True,True,'en');b=extract_document_model(open('/history-after.docx','rb').read(),True,True,'en');manifest=worklazyComparisonManifestJson(a,b,formatting,True,True)
 value=json.loads(manifest);pair=next(d['objectEvents']['drawingProperties'][0] for d in value['decisions'] if d.get('objectEvents'))
 assert pair['representation']=='preserve-after-history'
 generate_tracked_document('/history-before.docx','/history-after.docx','/history-out.docx','events',formatting,True,True,manifest,requested_json)
 accept_tracked_document('/history-out.docx','/history-accepted.docx')
 with zipfile.ZipFile('/history-out.docx') as output:
  root=ET.fromstring(output.read('word/document.xml'))
  assert root.find('.//'+W+'ins/'+W+'r/'+W+'rPr/'+W+'rPrChange').get(W+'author')=='Original author'
  restored=reject(root)[0]
  assert restored.find('.//'+W+'rPr/'+W+'sz').get(W+'val')=='40'
 assert view('/history-accepted.docx')==view('/history-after.docx')
 assert view('/history-out.docx',True)==view('/history-before.docx')
 for variant in ['before','after','out','accepted']:shutil.copyfile('/history-'+variant+'.docx','/p-packages/properties-history-'+str(formatting)+'-'+variant+'.docx')

# The new narrow property-history allowance must not accept malformed payloads.
with zipfile.ZipFile('/history-after.docx') as source:entries={name:source.read(name) for name in source.namelist()}
entries['word/document.xml']=entries['word/document.xml'].replace(b'</w:rPrChange>',b'<w:rPr/></w:rPrChange>')
with zipfile.ZipFile('/malformed-history.docx','w') as output:
 for name,data in entries.items():output.writestr(name,data)
for formatting in [False,True]:
 if os.path.exists('/bad.docx'):os.unlink('/bad.docx')
 try:generate_tracked_document('/history-before.docx','/malformed-history.docx','/bad.docx','events',formatting,True,True);raise AssertionError('malformed property history accepted')
 except ValueError as error:assert 'UNSUPPORTED_TRACKED_SOURCE' in str(error)
 assert not os.path.exists('/bad.docx')

`);
// W1 unmatched drawing restoration: use revised text styles, never vacuous
// "all revised drawings match" when the revised paragraph has no drawing.
for(const [formatting,sizeEnabled,colorEnabled] of [[false,true,true],[true,true,true],[true,false,false]]) {
 requested={fontFamily:true,size:sizeEnabled,style:true,color:colorEnabled,paragraph:true,numbering:true};
 py.globals.set('requested_json',JSON.stringify(requested));py.globals.set('formatting',formatting);
 py.runPython(String.raw`
mask=json.loads(requested_json)
def image_run(size,font,color,language):return '<w:r><w:rPr><w:rFonts w:ascii="'+font+'"/><w:color w:val="'+color+'"/><w:sz w:val="'+size+'"/><w:lang w:val="'+language+'"/></w:rPr>'+image()+'</w:r>'
def revised_text(value,size,font):return '<w:r><w:rPr><w:rFonts w:ascii="'+font+'"/><w:color w:val="0000FF"/><w:sz w:val="'+size+'"/><w:lang w:val="ko-KR"/></w:rPr><w:t xml:space="preserve">'+value+'</w:t></w:r>'
def drawing_styles(path):
 with zipfile.ZipFile(path) as z:
  result=[]
  for part in ['word/document.xml','word/header1.xml']:
   if part not in z.namelist():continue
   for run in ET.fromstring(z.read(part)).iter(W+'r'):
    if run.find(W+'drawing') is None:continue
    props=run.find(W+'rPr')
    result.append(tuple(props.find(W+name).get(W+attribute) if props is not None and props.find(W+name) is not None else None for name,attribute in [('rFonts','ascii'),('color','val'),('sz','val'),('lang','val')]))
  return result
for context in ['start','middle','end','header','cell','whole','default','inserted']:
 location={'start':0,'middle':1,'end':2}.get(context,1)
 original=p((text('AB'[:location]) if location else '')+image_run('20','Arial','FF0000','en-US')+(text('AB'[location:]) if location<2 else ''))
 revised=p(revised_text('A','40','CalibriA')+(revised_text('X','60','CalibriX') if context=='inserted' else '')+revised_text('B','50','CalibriB'))
 if context=='inserted':original=p(text('A')+image_run('20','Arial','FF0000','en-US')+text(' B'));revised=p(revised_text('A','40','CalibriA')+revised_text(' X','60','CalibriX')+revised_text(' B','50','CalibriB'))
 if context=='whole':original=p(image_run('20','Arial','FF0000','en-US'))+p(text('Stable body'));revised=p(text('Stable body'))
 if context=='default':original=p(image_run('20','Arial','FF0000','en-US')+image_run('30','Arial2','FF0000','en-US'));revised=p(image_run('40','Calibri','0000FF','ko-KR'))
 for side,body in [('before',original),('after',revised)]:
  if context=='cell':body='<w:tbl><w:tr><w:tc>'+body+'</w:tc></w:tr></w:tbl>'
  package('/deleted-'+side+'.docx',p(text('Stable body')) if context=='header' else body,OLDPNG,'https://same.example',body if context=='header' else None)
 a=extract_document_model(open('/deleted-before.docx','rb').read(),True,True,'en');b=extract_document_model(open('/deleted-after.docx','rb').read(),True,True,'en');manifest=worklazyComparisonManifestJson(a,b,formatting,True,True)
 generate_tracked_document('/deleted-before.docx','/deleted-after.docx','/deleted-out.docx','events',formatting,True,True,manifest,requested_json)
 accept_tracked_document('/deleted-out.docx','/deleted-accepted.docx')
 with zipfile.ZipFile('/deleted-out.docx') as source,zipfile.ZipFile('/deleted-rejected.docx','w') as output:
  for entry in source.infolist():output.writestr(entry,_serialize_xml(reject(_qname_safe_parse(source.read(entry.filename)))[0]) if entry.filename in ['word/document.xml','word/header1.xml'] else source.read(entry.filename))
 if context=='whole':target=[('Arial','FF0000','20','en-US')]
 elif context=='default':target=[('Arial' if formatting else 'Calibri','FF0000' if formatting and mask['color'] else '0000FF','20' if formatting and mask['size'] else '40','ko-KR'),('Arial2' if formatting else None,'FF0000' if formatting and mask['color'] else None,'30' if formatting and mask['size'] else None,None)]
 else:target=[('Arial' if formatting else 'CalibriA' if location==0 else 'CalibriX' if context=='inserted' else 'CalibriB','FF0000' if formatting and mask['color'] else '0000FF','20' if formatting and mask['size'] else '40' if location==0 else '60' if context=='inserted' else '50','ko-KR')]
 assert drawing_styles('/deleted-rejected.docx')==target,(context,formatting,mask,drawing_styles('/deleted-rejected.docx'),target)
 assert view('/deleted-accepted.docx')==view('/deleted-after.docx'),(context,'accept',view('/deleted-accepted.docx'),view('/deleted-after.docx'))
 assert view('/deleted-rejected.docx')==view('/deleted-before.docx'),(context,'reject',view('/deleted-rejected.docx'),view('/deleted-before.docx'))
 name='unpaired-'+context+'-'+str(formatting)+'-'+str(mask['size'])
 for variant in ['before','after','out','accepted','rejected']:shutil.copyfile('/deleted-'+variant+'.docx','/p-packages/'+name+'-'+variant+'.docx')
 value=json.loads(manifest)
 for mutation in ['missing','duplicate','source','scope','policy','family','fact','extra']:
  bad=copy.deepcopy(value)
  def descendants(items):return [d for item in items for d in [item]+descendants(item.get('children',[]))]
  decision=next(d for d in descendants(bad['decisions']) if d.get('objectEvents',{}).get('deletedDrawingStyles'));entries=decision['objectEvents']['deletedDrawingStyles'];entry=entries[0]
  if mutation=='missing':entries.clear()
  elif mutation=='duplicate':entries.append(copy.deepcopy(entry))
  elif mutation=='source':entry['source']=next(ref for ref in bad['sources']['after'] if ref['kind']=='r')
  elif mutation=='scope':entry['afterParagraph']=bad['sources']['after'][0]
  elif mutation=='policy':entry['policy']='copy-revised-run' if entry['policy']=='restore-before-unpaired' else 'restore-before-unpaired'
  elif mutation=='family':entry['families']=[W+'lang']
  elif mutation=='fact':entry['beforeFact']['history']=not entry['beforeFact']['history']
  else:entry['ignored']=1
  # Source forgery must change a valid field even if the first run happened to
  # be the real start-cursor source in this particular fixture.
  if mutation=='source' and entry==value['decisions'][0].get('objectEvents',{}).get('deletedDrawingStyles',[None])[0]:entry['source']=bad['sources']['after'][0]
  if os.path.exists('/bad.docx'):os.unlink('/bad.docx')
  try:generate_tracked_document('/deleted-before.docx','/deleted-after.docx','/bad.docx','events',formatting,True,True,json.dumps(bad),requested_json);raise AssertionError((context,mutation,'accepted'))
  except ValueError as error:assert 'INVALID_COMPARISON_MANIFEST_DRAWING_RESTORE' in str(error),(context,mutation,str(error))
  assert not os.path.exists('/bad.docx')
`);
}
console.log('24 unpaired drawing scope projections +192 source/policy negatives passed');
// Split image source events stay bound to the declared TS paragraph slices.
for(const [formatting,sizeEnabled,sameResource] of [[false,true,false],[true,true,false],[true,false,false],[false,true,true]]) {
 requested={fontFamily:true,size:sizeEnabled,style:true,color:true,paragraph:true,numbering:true};
 py.globals.set('requested_json',JSON.stringify(requested));py.globals.set('formatting',formatting);py.globals.set('same_resource',sameResource);
 py.runPython(String.raw`
for context in ['body','cell','header','nested SDT']:
 for placement in ['first','boundary','second','end','deleted','adjacent','both']:
  first='First sentence. ';second='Second sentence.'
  obj=image_run('20','Arial','FF0000','en-US')
  old_first=text(first[:6])+obj+text(first[6:]) if placement in ['first','both'] else text(first)
  old_second=(obj if placement in ['boundary','deleted','adjacent'] else '')+(image_run('30','Arial2','FF0000','en-US').replace('docPr id="1"','docPr id="2"') if placement=='adjacent' else '')+text(second[:6])+(obj.replace('docPr id="1"','docPr id="2"') if placement=='both' else obj if placement=='second' else '')+text(second[6:])+(obj if placement=='end' else '')
  before=p(old_first+old_second)
  revised_obj=image_run('40','Calibri','0000FF','ko-KR')
  new_first=text(first[:6])+revised_obj+text(first[6:]) if placement in ['first','both'] else text(first)
  new_second=(revised_obj if placement in ['boundary','adjacent'] else '')+(image_run('50','Calibri2','0000FF','ko-KR').replace('docPr id="1"','docPr id="2"') if placement=='adjacent' else '')+text(second[:6])+(revised_obj.replace('docPr id="1"','docPr id="2"') if placement=='both' else revised_obj if placement=='second' else '')+text(second[6:])+(revised_obj if placement=='end' else '')
  after=p(new_first)+p(new_second)
  for side,body,media in [('before',before,OLDPNG),('after',after,OLDPNG if same_resource else NEWPNG)]:
   if context=='nested SDT':body='<w:sdt><w:sdtPr><w:tag w:val="stable"/></w:sdtPr><w:sdtContent><w:sdt><w:sdtPr/><w:sdtContent>'+body+'</w:sdtContent></w:sdt></w:sdtContent></w:sdt>'
   package('/split-'+side+'.docx',p(text('Stable body')) if context=='header' else '<w:tbl><w:tr><w:tc>'+body+'</w:tc></w:tr></w:tbl>' if context=='cell' else body,media,'https://same.example',body if context=='header' else None)
  a=extract_document_model(open('/split-before.docx','rb').read(),True,True,'en');b=extract_document_model(open('/split-after.docx','rb').read(),True,True,'en');manifest=worklazyComparisonManifestJson(a,b,formatting,True,True)
  def descendants(items):return [d for item in items for d in [item]+descendants(item.get('children',[]))]
  value=json.loads(manifest);decision=next(d for d in descendants(value['decisions']) if len(d['before'])==1 and len(d['after'])==2)
  assert len(decision['objectEvents']['contexts'])==2
  try:generate_tracked_document('/split-before.docx','/split-after.docx','/split-out.docx','events',formatting,True,True,manifest,requested_json)
  except ValueError as error:raise AssertionError((context,placement,formatting,same_resource,str(error),[(ref['part'],ref['path']) for ref in decision['before']],[(ref['part'],ref['path']) for ref in decision['after']]))
  accept_tracked_document('/split-out.docx','/split-accepted.docx')
  with zipfile.ZipFile('/split-out.docx') as source,zipfile.ZipFile('/split-rejected.docx','w') as output:
   for entry in source.infolist():output.writestr(entry,_serialize_xml(reject(_qname_safe_parse(source.read(entry.filename)))[0]) if entry.filename in ['word/document.xml','word/header1.xml'] else source.read(entry.filename))
  assert view('/split-accepted.docx')==view('/split-after.docx'),(context,placement,'accept',view('/split-accepted.docx'),view('/split-after.docx'))
  assert view('/split-rejected.docx')==view('/split-before.docx'),(context,placement,'reject',view('/split-rejected.docx'),view('/split-before.docx'))
  actual=drawing_styles('/split-rejected.docx')
  if placement=='deleted':expected=[('Arial' if formatting else None,'FF0000' if formatting else None,'20' if formatting and json.loads(requested_json)['size'] else None,None)]
  else:expected=[('Arial' if formatting else 'Calibri','FF0000' if formatting else '0000FF','20' if formatting and json.loads(requested_json)['size'] else '40','ko-KR')]+([('Arial2' if formatting else 'Calibri2','FF0000' if formatting else '0000FF','30' if formatting and json.loads(requested_json)['size'] else '50','ko-KR')] if placement=='adjacent' else [])
  if placement=='both':expected*=2
  assert actual==expected,(context,placement,'scope',actual,expected)
  if same_resource:
   with zipfile.ZipFile('/split-out.docx') as z:assert sum(len(list(ET.fromstring(z.read(part)).iter(W+'drawing'))) for part in ['word/document.xml','word/header1.xml'] if part in z.namelist())==len(drawing_styles('/split-before.docx'))
  name='split-'+context+'-'+placement+'-'+str(formatting)+'-'+str(json.loads(requested_json)['size'])+'-'+str(same_resource)
  for variant in ['before','after','out','accepted','rejected']:shutil.copyfile('/split-'+variant+'.docx','/p-packages/'+name+'-'+variant+'.docx')
  for mutation in ['missing','duplicate','position','context','paragraph']:
   bad=copy.deepcopy(value);d=next(d for d in descendants(bad['decisions']) if d['id']==decision['id']);contexts=d['objectEvents']['contexts']
   if mutation=='missing':contexts.pop()
   elif mutation=='duplicate':contexts.append(copy.deepcopy(contexts[0]))
   elif mutation=='position':next(item for c in contexts for item in c['before'])['start']+=1
   elif mutation=='context':contexts[1]['comparisonIndex']=0
   else:contexts[1]['afterParagraph']=contexts[0]['afterParagraph']
   if os.path.exists('/bad.docx'):os.unlink('/bad.docx')
   try:generate_tracked_document('/split-before.docx','/split-after.docx','/bad.docx','events',formatting,True,True,json.dumps(bad),requested_json);raise AssertionError(mutation+' accepted')
   except ValueError as error:assert 'INVALID_COMPARISON_MANIFEST_OBJECT_CONTEXTS' in str(error)
   assert not os.path.exists('/bad.docx')
`);
}
console.log('112 split drawing source/resource/style package targets +560 context negatives passed');
py.runPython(String.raw`
# Split support is source-bounded: do not silently discard other markers or
# redistribute leaves between distinct content-control envelopes.
for unsupported in ['bookmark','before-envelope','after-envelopes','hyperlink','paragraph-history']:
 first='First sentence. ';second='Second sentence.'
 before=p(text(first)+image_run('20','Arial','FF0000','en-US')+text(second));after=p(text(first))+p(image_run('40','Calibri','0000FF','ko-KR')+text(second))
 if unsupported=='bookmark':before=before.replace('<w:p>','<w:p><w:bookmarkStart w:id="7" w:name="Kept"/>').replace('</w:p>','<w:bookmarkEnd w:id="7"/></w:p>')
 if unsupported=='before-envelope':before='<w:sdt><w:sdtPr/><w:sdtContent>'+before+'</w:sdtContent></w:sdt>'
 if unsupported=='after-envelopes':after='<w:sdt><w:sdtPr/><w:sdtContent>'+p(text(first))+'</w:sdtContent></w:sdt>'+p(image_run('40','Calibri','0000FF','ko-KR')+text(second))
 if unsupported=='paragraph-history':after=after.replace('<w:p>','<w:p><w:pPr><w:rPr><w:ins w:id="17" w:author="Original author"/></w:rPr></w:pPr>',1)
 if unsupported=='hyperlink':before=p(link(first)+image_run('20','Arial','FF0000','en-US')+text(second))
 for side,body in [('before',before),('after',after)]:package('/unsafe-split-'+side+'.docx',body,OLDPNG,'https://same.example')
 if os.path.exists('/bad.docx'):os.unlink('/bad.docx')
 try:generate_tracked_document('/unsafe-split-before.docx','/unsafe-split-after.docx','/bad.docx','events',False,True,True,None,requested_json);raise AssertionError(unsupported+' accepted')
 except ValueError as error:assert 'UNSUPPORTED_TRACKED_SOURCE_SPLIT_ENVELOPE' in str(error),(unsupported,str(error))
 assert not os.path.exists('/bad.docx')
`);
py.runPython(String.raw`
# The complete SDT ancestor envelope, not merely the immediate parent tag,
# must remain representable. These are real source changes, not forged refs.
def control(body,tag='stable',attrs='',content_attrs=''):
 return '<w:sdt'+attrs+'><w:sdtPr><w:tag w:val="'+tag+'"/></w:sdtPr><w:sdtContent'+content_attrs+'>'+body+'</w:sdtContent></w:sdt>'
for mutation in ['tag','alias','lock','outer-tag','sdt-attribute','content-attribute','end-properties']:
 original=p(text('First sentence. ')+image_run('20','Arial','FF0000','en-US')+text('Second sentence.'))
 revised=p(text('First sentence. '))+p(image_run('40','Calibri','0000FF','ko-KR')+text('Second sentence.'))
 old=control(original);new=control(revised)
 if mutation=='tag':old=control(original,'original-control');new=control(revised,'revised-control')
 elif mutation=='alias':old=old.replace('<w:sdtPr>','<w:sdtPr><w:alias w:val="original-alias"/>');new=new.replace('<w:sdtPr>','<w:sdtPr><w:alias w:val="revised-alias"/>')
 elif mutation=='lock':old=old.replace('<w:sdtPr>','<w:sdtPr><w:lock w:val="contentLocked"/>');new=new.replace('<w:sdtPr>','<w:sdtPr><w:lock w:val="sdtLocked"/>')
 elif mutation=='outer-tag':old=control(old,'outer-original');new=control(new,'outer-revised')
 elif mutation=='sdt-attribute':old=control(original,attrs=' xmlns:test="urn:source-envelope" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="test" test:state="original"');new=control(revised,attrs=' xmlns:test="urn:source-envelope" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="test" test:state="revised"')
 elif mutation=='content-attribute':old=control(original,content_attrs=' xmlns:test="urn:source-envelope" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="test" test:state="original"');new=control(revised,content_attrs=' xmlns:test="urn:source-envelope" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" mc:Ignorable="test" test:state="revised"')
 else:old=old.replace('<w:sdtContent>','<w:sdtEndPr><w:rPr><w:b/></w:rPr></w:sdtEndPr><w:sdtContent>')
 for side,body in [('before',old),('after',new)]:package('/envelope-'+side+'.docx',body,OLDPNG,'https://same.example')
 for formatting in [False,True]:
  if os.path.exists('/bad.docx'):os.unlink('/bad.docx')
  try:generate_tracked_document('/envelope-before.docx','/envelope-after.docx','/bad.docx','events',formatting,True,True,None,requested_json);raise AssertionError((mutation,'accepted'))
  except ValueError as error:assert 'UNSUPPORTED_TRACKED_SOURCE_SPLIT_ENVELOPE' in str(error),(mutation,str(error))
  assert not os.path.exists('/bad.docx')
 # Save actual reviewer/source regressions independently of the invalid result.
 for side in ['before','after']:shutil.copyfile('/envelope-'+side+'.docx','/p-packages/envelope-'+mutation+'-'+side+'.docx')
`);
py.runPython(String.raw`
# Prefix aliases and attribute order do not make an equal envelope unequal.
old=control(p(text('First sentence. ')+image_run('20','Arial','FF0000','en-US')+text('Second sentence.')),attrs=' xmlns:left="urn:source-envelope" xmlns:mc="'+MC+'" mc:Ignorable="left" left:a="A" left:b="B"')
new=control(p(text('First sentence. '))+p(image_run('40','Calibri','0000FF','ko-KR')+text('Second sentence.')),attrs=' xmlns:right="urn:source-envelope" xmlns:mc="'+MC+'" right:b="B" right:a="A" mc:Ignorable="right"')
for side,body in [('before',old),('after',new)]:package('/equal-envelope-'+side+'.docx',body,OLDPNG,'https://same.example')
generate_tracked_document('/equal-envelope-before.docx','/equal-envelope-after.docx','/equal-envelope-out.docx','events',False,True,True,None,requested_json)
accept_tracked_document('/equal-envelope-out.docx','/equal-envelope-accepted.docx')
assert view('/equal-envelope-accepted.docx')==view('/equal-envelope-after.docx')
assert view('/equal-envelope-out.docx',True)==view('/equal-envelope-before.docx')
for path in ['/equal-envelope-out.docx','/equal-envelope-accepted.docx']:
 with zipfile.ZipFile(path) as z:
  for root in [ET.fromstring(z.read('word/document.xml')),reject(ET.fromstring(z.read('word/document.xml')))[0]]:
   controls=list(root.iter(W+'sdt'));assert len(controls)==1
   assert controls[0].get('{urn:source-envelope}a')=='A' and controls[0].get('{urn:source-envelope}b')=='B'
   assert controls[0].find(W+'sdtPr/'+W+'tag').get(W+'val')=='stable'
for variant in ['before','after','out','accepted']:shutil.copyfile('/equal-envelope-'+variant+'.docx','/p-packages/equal-envelope-'+variant+'.docx')
`);
console.log('Equal SDT namespace-alias/attribute-order envelope exports and roundtrips');
console.log('14 unequal SDT ancestor/property/attribute envelope gates passed');
console.log('5 source-envelope/anchor/hyperlink/paragraph-history split capability gates passed');
// Merge output uses the same parent text decision; its before boundary and
// resource ownership must reconstruct two populated original paragraphs.
for(const [formatting,sizeEnabled,paragraphEnabled,sameResource] of [[false,true,true,false],[true,true,true,false],[true,false,false,false],[false,true,true,true]]) {
 requested={fontFamily:true,size:sizeEnabled,style:true,color:true,paragraph:paragraphEnabled,numbering:true};
 py.globals.set('requested_json',JSON.stringify(requested));py.globals.set('formatting',formatting);py.globals.set('same_resource',sameResource);
 py.runPython(String.raw`
def styled_word(value,size,font,color):return '<w:r><w:rPr><w:rFonts w:ascii="'+font+'"/><w:color w:val="'+color+'"/><w:sz w:val="'+size+'"/><w:lang w:val="ko-KR"/></w:rPr><w:t xml:space="preserve">'+value+'</w:t></w:r>'
def para(value,alignment):return '<w:p><w:pPr><w:jc w:val="'+alignment+'"/></w:pPr>'+value+'</w:p>'
def paragraph_alignment(path):
 with zipfile.ZipFile(path) as z:return [node.find(W+'pPr/'+W+'jc').get(W+'val') if node.find(W+'pPr/'+W+'jc') is not None else None for part in ['word/document.xml','word/header1.xml'] if part in z.namelist() for node in ET.fromstring(z.read(part)).iter(W+'p') if ''.join(n.text or '' for n in node.iter(W+'t'))!='Stable body']
for context in ['body','cell','header','nested SDT']:
 for placement in ['plain','first','first-end','second-start','second','second-end','boundary-both','both','deleted-first','deleted-second','inserted','changed-text']:
  texts=['First sentence. ','Second sentence.'];new_texts=['Revised first sentence. ','Revised second sentence.'] if placement=='changed-text' else texts
  old=[];new=[];old_indices=[]
  for i in [0,1]:
   position=6 if placement in ['first','second','both','deleted-first','deleted-second','changed-text'] else len(texts[i]) if placement in ['first-end','second-end'] else 0
   old_image=placement in (['first','first-end','both','boundary-both','deleted-first','changed-text'] if i==0 else ['second-start','second','second-end','boundary-both','both','deleted-second','changed-text'])
   if placement=='boundary-both':position=len(texts[0]) if i==0 else 0
   new_image=old_image and not placement.startswith('deleted') or placement=='inserted' and i==1
   if old_image:old_indices.append(i)
   after_index=0 if placement=='changed-text' else i
   old_run=lambda value:styled_word(value,str(20+10*i),'Arial'+str(i),'FF0000') if value else ''
   new_run=lambda value:styled_word(value,str(40+10*after_index),'Calibri'+str(after_index),'0000FF') if value else ''
   old_picture=image_run(str(20+10*i),'Arial'+str(i),'FF0000','ko-KR').replace('docPr id="1"','docPr id="'+str(i+1)+'"') if old_image else ''
   new_picture=image_run(str(40+10*after_index),'Calibri'+str(after_index),'0000FF','ko-KR').replace('docPr id="1"','docPr id="'+str(i+1)+'"') if new_image else ''
   old.append(para(old_run(texts[i][:position])+old_picture+old_run(texts[i][position:]),['left','right'][i]))
   new.append(new_run(new_texts[i][:position])+new_picture+new_run(new_texts[i][position:]))
  before=''.join(old);after=para(''.join(new),'center')
  for side,body,media in [('before',before,OLDPNG),('after',after,OLDPNG if same_resource else NEWPNG)]:
   if context=='cell':body='<w:tbl><w:tr><w:tc>'+body+'</w:tc></w:tr></w:tbl>'
   if context=='nested SDT':body=control(control(body))
   package('/merge-'+side+'.docx',p(text('Stable body')) if context=='header' else body,media,'https://same.example',body if context=='header' else None)
  a=extract_document_model(open('/merge-before.docx','rb').read(),True,True,'en');b=extract_document_model(open('/merge-after.docx','rb').read(),True,True,'en');manifest=worklazyComparisonManifestJson(a,b,formatting,True,True)
  def descendants(items):return [d for item in items for d in [item]+descendants(item.get('children',[]))]
  value=json.loads(manifest);decision=next(d for d in descendants(value['decisions']) if d.get('mergeProjection'))
  generate_tracked_document('/merge-before.docx','/merge-after.docx','/merge-out.docx','events',formatting,True,True,manifest,requested_json)
  accept_tracked_document('/merge-out.docx','/merge-accepted.docx')
  with zipfile.ZipFile('/merge-out.docx') as source,zipfile.ZipFile('/merge-rejected.docx','w') as output:
   for entry in source.infolist():output.writestr(entry,_serialize_xml(reject(_qname_safe_parse(source.read(entry.filename)))[0]) if entry.filename in ['word/document.xml','word/header1.xml'] else source.read(entry.filename))
  assert view('/merge-accepted.docx')==view('/merge-after.docx'),(context,placement,'accept',view('/merge-accepted.docx'),view('/merge-after.docx'))
  assert view('/merge-rejected.docx')==view('/merge-before.docx'),(context,placement,'reject',view('/merge-rejected.docx'),view('/merge-before.docx'))
  assert paragraph_alignment('/merge-accepted.docx')==['center']
  assert paragraph_alignment('/merge-rejected.docx')==(['left','right'] if formatting and json.loads(requested_json)['paragraph'] else ['center','center'])
  # Every restored glyph keeps its own before run or the declared revised run.
  with zipfile.ZipFile('/merge-rejected.docx') as z:
   part='word/header1.xml' if context=='header' else 'word/document.xml'
   for index,node in enumerate(ET.fromstring(z.read(part)).iter(W+'p')):
    for run in node.iter(W+'r'):
     if run.find(W+'t') is None:continue
     prop=run.find(W+'rPr');after_index=0 if placement=='changed-text' else index
     assert prop.find(W+'rFonts').get(W+'ascii')==('Arial'+str(index) if formatting else 'Calibri'+str(after_index)),(context,placement,index,'font',ET.tostring(run))
     assert prop.find(W+'sz').get(W+'val')==str(20+10*index if formatting and json.loads(requested_json)['size'] else 40+10*after_index)
  expected_images=[('Arial'+str(i) if formatting else 'Calibri'+str(0 if placement=='changed-text' else i),'FF0000' if formatting else '0000FF',str(20+10*i if formatting and json.loads(requested_json)['size'] else 40+10*(0 if placement=='changed-text' else i)),'ko-KR') for i in old_indices]
  assert drawing_styles('/merge-rejected.docx')==expected_images,(context,placement,'image-scope',drawing_styles('/merge-rejected.docx'),expected_images)
  if same_resource and not decision.get('objectEvents',{}).get('changed',False):
   with zipfile.ZipFile('/merge-out.docx') as z:assert sum(len(list(ET.fromstring(z.read(part)).iter(W+'drawing'))) for part in ['word/document.xml','word/header1.xml'] if part in z.namelist())==len(drawing_styles('/merge-before.docx')),(context,placement,'physical matched events')
  name='merge-'+context+'-'+placement+'-'+str(formatting)+'-'+str(json.loads(requested_json)['size'])+'-'+str(same_resource)
  for variant in ['before','after','out','accepted','rejected']:shutil.copyfile('/merge-'+variant+'.docx','/p-packages/'+name+'-'+variant+'.docx')
  for mutation in ['missing','before-boundary','after-boundary','source','fact','family','role','extra']:
   bad=copy.deepcopy(value);d=next(d for d in descendants(bad['decisions']) if d['id']==decision['id']);projection=d['mergeProjection']
   if mutation=='missing':del d['mergeProjection']
   elif mutation=='before-boundary':projection['beforeBoundary']+=1
   elif mutation=='after-boundary':projection['afterBoundary']+=1
   elif mutation=='source':projection['properties'][1]['before']=projection['properties'][0]['before']
   elif mutation=='fact':projection['properties'][1]['beforeFact']['history']=not projection['properties'][1]['beforeFact']['history']
   elif mutation=='family':projection['properties'][1]['families'].append(W+'lang')
   elif mutation=='role':
    if projection['beforeEvents']:projection['beforeEvents'][0]['side']=not projection['beforeEvents'][0]['side']
    else:projection['beforeBoundary']=True
   else:projection['ignored']=1
   if os.path.exists('/bad.docx'):os.unlink('/bad.docx')
   try:generate_tracked_document('/merge-before.docx','/merge-after.docx','/bad.docx','events',formatting,True,True,json.dumps(bad),requested_json);raise AssertionError(mutation+' accepted')
   except ValueError as error:assert 'INVALID_COMPARISON_MANIFEST_MERGE_PROJECTION' in str(error),(mutation,str(error))
   assert not os.path.exists('/bad.docx')
`);
}
console.log('192 populated-paragraph merge text/image/property/resource targets +1536 projection negatives passed');
py.runPython(String.raw`
for unsafe in ['unequal-control','outer-control','separate-controls','bookmark','paragraph-history','hyperlink','paragraph-attribute']:
 first='First sentence. ';second='Second sentence.'
 before=para(text(first)+image_run('20','Arial','FF0000','ko-KR'),'left')+para(text(second),'right')
 after=para(text(first)+image_run('40','Calibri','0000FF','ko-KR')+text(second),'center')
 if unsafe=='unequal-control':before=control(before,'original');after=control(after,'revised')
 elif unsafe=='outer-control':before=control(control(before),'original');after=control(control(after),'revised')
 elif unsafe=='separate-controls':before=control(para(text(first)+image_run('20','Arial','FF0000','ko-KR'),'left'))+control(para(text(second),'right'));after=control(after)
 elif unsafe=='bookmark':before=before.replace('<w:p>','<w:p><w:bookmarkStart w:id="7" w:name="Anchor"/>',1).replace('</w:p>','<w:bookmarkEnd w:id="7"/></w:p>',1)
 elif unsafe=='paragraph-history':after=after.replace('<w:pPr>','<w:pPr><w:rPr><w:ins w:id="31" w:author="Original author"/></w:rPr>',1)
 elif unsafe=='hyperlink':before=para(link(first)+image_run('20','Arial','FF0000','ko-KR'),'left')+para(text(second),'right')
 else:
  before=before.replace('<w:p>','<w:p xmlns:test="urn:paragraph" xmlns:mc="'+MC+'" mc:Ignorable="test" test:state="original">')
  after=after.replace('<w:p>','<w:p xmlns:test="urn:paragraph" xmlns:mc="'+MC+'" mc:Ignorable="test" test:state="revised">')
 for side,body in [('before',before),('after',after)]:package('/unsafe-merge-'+side+'.docx',body,OLDPNG,'https://same.example')
 if os.path.exists('/bad.docx'):os.unlink('/bad.docx')
 try:generate_tracked_document('/unsafe-merge-before.docx','/unsafe-merge-after.docx','/bad.docx','events',False,True,True,None,requested_json);raise AssertionError(unsafe+' accepted')
 except ValueError as error:assert 'UNSUPPORTED_TRACKED_SOURCE_MERGE_ENVELOPE' in str(error),(unsafe,str(error))
 assert not os.path.exists('/bad.docx')
# Missing routing and missing matched-event consumption cannot silently emit.
before=para(text('First sentence. ')+image_run('20','Arial','FF0000','ko-KR'),'left')+para(text('Second sentence.'),'right')
after=para(text('First sentence. ')+image_run('40','Calibri','0000FF','ko-KR')+text('Second sentence.'),'center')
for side,body in [('before',before),('after',after)]:package('/fault-merge-'+side+'.docx',body,OLDPNG,'https://same.example')
a=extract_document_model(open('/fault-merge-before.docx','rb').read(),True,True,'en');b=extract_document_model(open('/fault-merge-after.docx','rb').read(),True,True,'en');manifest=worklazyComparisonManifestJson(a,b,False,True,True)
saved_revision=_paragraph_revision;saved_consume=_consume_object
for fault in ['routing','matched-consumption']:
 def missing_route(*args):
  result=saved_revision(*args)
  for child in result:
   if child.tag!=W+'pPr':_MANIFEST_MERGE_SIDES.pop(child,None);break
  return result
 def missing_before_event(source,positions=None):
  if _MANIFEST_NODE_KEYS.get(source,('after',))[0]=='before':return
  return saved_consume(source,positions)
 if fault=='routing':_paragraph_revision=missing_route
 else:_consume_object=missing_before_event
 if os.path.exists('/bad.docx'):os.unlink('/bad.docx')
 try:
  try:generate_tracked_document('/fault-merge-before.docx','/fault-merge-after.docx','/bad.docx','events',False,True,True,manifest,requested_json);raise AssertionError(fault+' accepted')
  except ValueError as error:assert ('MERGE_EMISSION' if fault=='routing' else 'OBJECT_CONSUMPTION') in str(error)
  assert not os.path.exists('/bad.docx')
 finally:_paragraph_revision=saved_revision;_consume_object=saved_consume
`);
console.log('7 actual merge source-envelope gates +2 emission/consumption fault controls passed');
requested=undefined;
console.log('49 paired image property package projections +252 source/family/fact negatives +2 metadata exclusions +4 absent-property targets +2 existing-history targets +2 malformed-history gates passed');
fs.mkdirSync('docs/jobs/todo/diffchecker-port-20261023/word-p-packages',{recursive:true});
for(const name of py.FS.readdir('/p-packages').filter(name=>name.endsWith('.docx')))fs.writeFileSync('docs/jobs/todo/diffchecker-port-20261023/word-p-packages/'+name,py.FS.readFile('/p-packages/'+name));
const artifacts=py.FS.readdir('/p-packages').filter(name=>name.endsWith('.docx')).sort().map(name=>{const data=py.FS.readFile('/p-packages/'+name);return {name,bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')};});
fs.writeFileSync('docs/jobs/todo/diffchecker-port-20261023/word-merge-package-artifacts.json',JSON.stringify({count:artifacts.length,artifacts},null,2)+'\n');
console.log(JSON.stringify(py.globals.get('checks').toJs()));
assert.ok(all.some(result=>result.manifest.decisions.some(decision=>decision.beforeText==='Old clause' && decision.afterText==='New clause' && decision.objectEvents?.unchangedLinks.length===1)),'TS must declare the unchanged hyperlink envelope');

assert.ok(all.some(result=>result.tables[0]?.kind==='changed' && result.tables[0].beforeKinds[0][0]==='changed' && result.summary.changed>0),'table object events must reach screen');

assert.ok(all.some(result=>result.views.document.some(view=>view.before==='Same text'&&view.after==='Same text'&&view.kind==='changed'&&view.objectLabels?.length)),'object-only deletions must remain visible');
assert.ok(all.some(result=>result.views.headerFooter.some(view=>view.before==='Same text'&&view.after==='Same text'&&view.kind==='changed'&&view.objectLabels?.length)),'header object-only deletions must remain visible');
