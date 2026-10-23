"""Independent reachable-note oracle. Numeric IDs identify records within ONE package only.
Pairing expectations use body paragraph/raw text cursor + reference ordinal.
No assertion of inherited style/theme/numbering equivalence is made.
"""
import copy, hashlib, json, posixpath, zipfile
import xml.etree.ElementTree as ET
WNS='http://schemas.openxmlformats.org/wordprocessingml/2006/main'
RNS='http://schemas.openxmlformats.org/officeDocument/2006/relationships'
PNS='http://schemas.openxmlformats.org/package/2006/relationships'
W='{'+WNS+'}'; R='{'+RNS+'}'
def run(s): return '<w:r><w:t>'+s+'</w:t></w:r>'
def paragraph(s): return '<w:p>'+s+'</w:p>'
def reference(kind,n): return '<w:r><w:'+kind+'Reference w:id="'+str(n)+'"/></w:r>'
def image_bytes(side):
 import struct,zlib
 def chunk(k,d):return struct.pack('>I',len(d))+k+d+struct.pack('>I',zlib.crc32(k+d)&0xffffffff)
 return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',1,1,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(b'\x00'+(b'\xff\x00\x00' if side=='before' else b'\x00\x00\xff')))+chunk(b'IEND',b'')
def drawing():
 return '<w:drawing><wp:inline xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"><wp:extent cx="914400" cy="914400"/><wp:docPr id="1" name="Note image"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="0" name="Note"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdImage"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="914400"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing>'
def note(n,text,kind='footnote',type=None):
 return '<w:'+kind+' w:id="'+str(n)+'"'+(' w:type="'+type+'"' if type else '')+'>'+paragraph(run(text))+'</w:'+kind+'>'
def package(path,body,notes,kind='footnote',resources=False,comments=None):
 ns=' xmlns:w="'+WNS+'" xmlns:r="'+RNS+'" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"'
 part='word/'+kind+'s.xml'
 rel=lambda rows:'<Relationships xmlns="'+PNS+'">'+''.join('<Relationship Id="'+i+'" Type="'+RNS+'/'+t+'" Target="'+v+'"'+(' TargetMode="External"' if external else '')+'/>' for i,t,v,external in rows)+'</Relationships>'
 with zipfile.ZipFile(path,'w') as z:
  z.writestr('_rels/.rels',rel([('main','officeDocument','word/document.xml',False)]))
  z.writestr('word/document.xml','<w:document'+ns+'><w:body>'+body+'</w:body></w:document>')
  z.writestr(part,'<w:'+kind+'s'+ns+'>'+''.join(notes)+'</w:'+kind+'s>')
  z.writestr('word/_rels/document.xml.rels',rel([('notes',kind+'s',kind+'s.xml',False),('rIdShared','hyperlink','https://body.example/',True)]+([('comments','comments','comments.xml',False)] if comments is not None else [])))
  if resources:
   z.writestr('word/_rels/'+kind+'s.xml.rels',rel([('rIdShared','hyperlink','https://note.example/',True),('rIdImage','image','media/note.png',False)]))
   z.writestr('word/media/note.png',image_bytes('before' if 'before' in path else 'after'))
  if comments is not None:z.writestr('word/comments.xml',comments)
  overrides=[('/word/document.xml','document.main'),('/'+part,kind+'s')]+([('/word/comments.xml','comments')] if comments is not None else [])
  z.writestr('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="png" ContentType="image/png"/>'+''.join('<Override PartName="'+p+'" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.'+t+'+xml"/>' for p,t in overrides)+'</Types>')
def reachable(path,kind='footnote'):
 """Follow references, reject ambiguous/dangling IDs, resolve each owner independently."""
 with zipfile.ZipFile(path) as z:
  part='word/'+kind+'s.xml'; notes={}
  for node in ET.fromstring(z.read(part)) if part in z.namelist() else []:
   if node.get(W+'type','normal')!='normal':continue
   ident=node.get(W+'id')
   if ident is None or ident in notes:raise ValueError('ambiguous ordinary note ID')
   notes[ident]=node
  relations={}
  relpart='word/_rels/'+kind+'s.xml.rels'
  if relpart in z.namelist():relations={r.get('Id'):r for r in ET.fromstring(z.read(relpart))}
  result=[]
  for pi,p in enumerate(ET.fromstring(z.read('word/document.xml')).iter(W+'p')):
   cursor=0; ordinal=0
   for node in p.iter():
    if node.tag==W+'t':cursor+=len(node.text or '')
    if node.tag!=W+kind+'Reference':continue
    ident=node.get(W+'id')
    if ident not in notes:raise ValueError('missing ordinary note ID')
    events=[]
    def walk(n):
     if n.tag==W+'hyperlink':
      value=''.join(n.itertext())
      if value:events.append(['link',relations[n.get(R+'id')].get('Target'),value])
      return
     if n.tag=='{http://schemas.openxmlformats.org/drawingml/2006/main}blip':
      rel=relations[n.get(R+'embed')];target=posixpath.normpath(posixpath.join('word',rel.get('Target')));events.append(['image',hashlib.sha256(z.read(target)).hexdigest()]);return
     if n.tag==W+'t':events.append(['text',n.text or ''])
     for child in n:walk(child)
    walk(notes[ident]);result.append({'anchor':[pi,cursor,ordinal],'events':events});ordinal+=1
  return result

def fixtures(root='/tmp/word-note-fixtures'):
 import os
 os.makedirs(root,exist_ok=True);cases=[]
 for kind in ['footnote','endnote']:
  anchor=lambda n:paragraph(run('Anchor')+reference(kind,n))
  scenarios=[
   ('same-id-different-content',anchor(1),[note(1,'Old',kind)],anchor(1),[note(1,'New',kind)]),
   ('different-id-same-note',anchor(1),[note(1,'Same',kind)],anchor(9),[note(9,'Same',kind)]),
   ('reordered-containers',anchor(1)+anchor(2),[note(1,'One',kind),note(2,'Two',kind)],anchor(1)+anchor(2),[note(2,'Two',kind),note(1,'One',kind)]),
   ('before-only-reference',anchor(1),[note(1,'Old',kind)],paragraph(run('Anchor')),[]),
   ('after-only-reference',paragraph(run('Anchor')),[],anchor(2),[note(2,'New',kind)]),
   ('typed-separator-positive-id',anchor(1),[note(77,'Separator',kind,'separator'),note(1,'Old',kind)],anchor(1),[note(1,'New',kind),note(88,'Separator',kind,'continuationSeparator')]),
   ('owner-relationship-collisions',anchor(1),[note(1,'Old',kind).replace('</w:p>','<w:hyperlink r:id="rIdShared">'+run('Link')+'</w:hyperlink><w:r>'+drawing()+'</w:r></w:p>')],anchor(1),[note(1,'New',kind).replace('</w:p>','<w:hyperlink r:id="rIdShared">'+run('Link')+'</w:hyperlink><w:r>'+drawing()+'</w:r></w:p>')]),
   ('duplicate-id',anchor(1),[note(1,'One',kind),note(1,'Two',kind)],anchor(1),[note(1,'New',kind)]),
   ('missing-id',anchor(2),[note(1,'One',kind)],anchor(1),[note(1,'New',kind)])]
  for name,b,bn,a,an in scenarios:
   paths=[root+'/'+kind+'-'+name+'-'+side+'.docx' for side in ['before','after']]
   package(paths[0],b,bn,kind,resources=name=='owner-relationship-collisions');package(paths[1],a,an,kind,resources=name=='owner-relationship-collisions')
   cases.append({'name':kind+'-'+name,'kind':kind,'before':paths[0],'after':paths[1],'invalid':name in ['duplicate-id','missing-id']})
 # A genuinely absent part has no main relationship or content-type declaration.
 for kind in ['footnote','endnote']:
  for direction in ['before','after']:
   for resource in [False,True]:
    name=kind+'-absent-part-'+direction+('-resources' if resource else '')
    paths=[root+'/'+name+'-'+side+'.docx' for side in ['before','after']]
    for side,path in zip(['before','after'],paths):
     present=side==direction
     payload=note(7,'Old' if side=='before' else 'New',kind)
     if resource:payload=payload.replace('</w:p>','<w:hyperlink r:id="rIdShared">'+run('Link')+'</w:hyperlink><w:r>'+drawing()+'</w:r></w:p>')
     package(path,paragraph(run('Anchor')+(reference(kind,7) if present else '')),[payload] if present else [],kind,resources=resource and present)
     if not present:
      with zipfile.ZipFile(path) as z:entries={n:z.read(n) for n in z.namelist() if n!='word/'+kind+'s.xml'}
      rels=ET.fromstring(entries['word/_rels/document.xml.rels'])
      for n in list(rels):
       if n.get('Type')==RNS+'/'+kind+'s':rels.remove(n)
      types=ET.fromstring(entries['[Content_Types].xml'])
      for n in list(types):
       if n.get('PartName')=='/word/'+kind+'s.xml':types.remove(n)
      entries['word/_rels/document.xml.rels']=ET.tostring(rels);entries['[Content_Types].xml']=ET.tostring(types)
      with zipfile.ZipFile(path,'w') as z:
       for n,data in entries.items():z.writestr(n,data)
    cases.append({'name':name,'kind':kind,'before':paths[0],'after':paths[1],'invalid':False})
 # E4: comments are after-owned byte artifacts, including absence. Old body
 # comment ID 4 must never acquire the unrelated revised comment with ID 4.
 for state in ['present','absent']:
  kind='footnote';name='comments-'+state
  old_comment=('<w:comments xmlns:w="'+WNS+'"><w:comment w:id="4" w:author="Old">'+paragraph(run('Old comment'))+'</w:comment></w:comments>').encode()
  new_comment=old_comment.replace(b'Old',b'Revised unrelated') if state=='present' else None
  oldbody=paragraph(run('Anchor')+'<w:commentRangeStart w:id="4"/>'+reference(kind,1)+'<w:commentRangeEnd w:id="4"/><w:r><w:commentReference w:id="4"/></w:r>')
  newbody=paragraph(run('Anchor')+reference(kind,1))
  paths=[root+'/'+name+'-'+side+'.docx' for side in ['before','after']]
  package(paths[0],oldbody,[note(1,'Old')],comments=old_comment);package(paths[1],newbody,[note(1,'New')],comments=new_comment)
  cases.append({'name':'footnote-'+name,'kind':kind,'before':paths[0],'after':paths[1],'invalid':False,'comments':state})
 return cases

def expected(case,side):
 name=case['name'].removeprefix(case['kind']+'-')
 def event(text,pi=0):return {'anchor':[pi,6,0],'events':[['text',text]]}
 if name.startswith('absent-part-'):
  present=side==('before' if name.startswith('absent-part-before') else 'after')
  if not present:return []
  value=event('Old' if side=='before' else 'New')
  if name.endswith('-resources'):value['events'] += [['link','https://note.example/','Link'],['image',{'before':'b1ff9c8ea3a780bad09b346c423d2d0e46815926879b18e841d928376a946640','after':'fce481932ea5d07a91c7991c09fdadb4bf78f9b4cc8f927188384231f9d12679'}[side]]]
  return [value]
 if name=='owner-relationship-collisions':
  value=event('Old' if side=='before' else 'New');value['events'] += [['link','https://note.example/','Link'],['image',{'before':'b1ff9c8ea3a780bad09b346c423d2d0e46815926879b18e841d928376a946640','after':'fce481932ea5d07a91c7991c09fdadb4bf78f9b4cc8f927188384231f9d12679'}[side]]];return [value]
 if name=='reordered-containers':return [event('One'),event('Two',1)]
 if name=='different-id-same-note':return [event('Same')]
 if name=='before-only-reference':return [event('Old')] if side=='before' else []
 if name=='after-only-reference':return [] if side=='before' else [event('New')]
 return [event('Old' if side=='before' else 'New')]

def validate_fixtures():
 cases=fixtures()
 for case in cases:
  if case['invalid']:
   try:reachable(case['before'],case['kind'])
   except ValueError:pass
   else:raise AssertionError(case['name'])
  else:
   for side in ['before','after']:assert reachable(case[side],case['kind'])==expected(case,side),case['name']
 return cases
if __name__=='__main__':
 cases=validate_fixtures();print(json.dumps({'fixtures':len(cases),'valid':sum(not c['invalid'] for c in cases),'invalid':sum(c['invalid'] for c in cases)}))
