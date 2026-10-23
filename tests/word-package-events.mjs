import assert from 'node:assert/strict';import fs from 'node:fs';import {loadPyodide} from 'pyodide';
import {compareDocumentModels,diffText} from '../src/features/document-compare/documentComparison.ts';
const all=[];let last;globalThis.worklazyDiffJson=(a,b)=>JSON.stringify(diffText(a,b));globalThis.worklazyComparisonManifestJson=(a,b,formatting,tables,metadata)=>{last=compareDocumentModels('before','after',JSON.parse(a),JSON.parse(b),{formatting,tables,metadata},'en');all.push(last);return JSON.stringify(last.manifest)};
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
 if node.tag==W+'p' and node.find(W+'pPr/'+W+'rPr/'+W+'ins') is not None:return []
 if node.tag==W+'ins' and node.get(W+'author')=='events':return []
 children=[]
 for child in node:children.extend(reject(child))
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

# Object-only run formatting has no text span. Until an explicit run-property
# projection is declared, excluded changes must not leak into restored images.
for side,size in [('before','20'),('after','40')]:
 with zipfile.ZipFile('/p-packages/flowed-image-boundary-'+side+'.docx') as source,zipfile.ZipFile('/styled-'+side+'.docx','w') as output:
  for entry in source.infolist():
   data=source.read(entry.filename)
   if entry.filename=='word/document.xml':
    root=ET.fromstring(data);run=next(node for node in root.iter(W+'r') if node.find(W+'drawing') is not None);properties=ET.Element(W+'rPr');ET.SubElement(properties,W+'sz',{W+'val':size});run.insert(0,properties);data=ET.tostring(root)
   output.writestr(entry,data)
a=extract_document_model(open('/styled-before.docx','rb').read(),True,True,'en');b=extract_document_model(open('/styled-after.docx','rb').read(),True,True,'en');value=json.loads(worklazyComparisonManifestJson(a,b,False,True,True));assert any(not d['objectEvents']['propertiesSupported'] for d in value['decisions'] if d.get('objectEvents'))
enabled=json.loads(worklazyComparisonManifestJson(a,b,True,True,True));assert any(not d['objectEvents']['propertiesSupported'] for d in enabled['decisions'] if d.get('objectEvents'))
for forged in [False,True]:
 bad=copy.deepcopy(value)
 if forged:
  for d in bad['decisions']:
   if d.get('objectEvents'):d['objectEvents']['propertiesSupported']=True
 try:
  generate_tracked_document('/styled-before.docx','/styled-after.docx','/bad.docx','events',False,True,True,json.dumps(bad));raise AssertionError('unsupported image formatting accepted')
 except ValueError as error:assert ('INVALID_COMPARISON_MANIFEST_OBJECT_PROPERTIES' if forged else 'UNSUPPORTED_TRACKED_SOURCE_OBJECT_PROPERTIES') in str(error)

`);
fs.mkdirSync('docs/jobs/todo/diffchecker-port-20261023/word-p-packages',{recursive:true});
for(const name of py.FS.readdir('/p-packages').filter(name=>name.endsWith('.docx')))fs.writeFileSync('docs/jobs/todo/diffchecker-port-20261023/word-p-packages/'+name,py.FS.readFile('/p-packages/'+name));
console.log(JSON.stringify(py.globals.get('checks').toJs()));
assert.ok(all.some(result=>result.manifest.decisions.some(decision=>decision.beforeText==='Old clause' && decision.afterText==='New clause' && decision.objectEvents?.unchangedLinks.length===1)),'TS must declare the unchanged hyperlink envelope');

assert.ok(all.some(result=>result.tables[0]?.kind==='changed' && result.tables[0].beforeKinds[0][0]==='changed' && result.summary.changed>0),'table object events must reach screen');
