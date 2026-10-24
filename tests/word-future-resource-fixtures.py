"""Fixture-only future Word resource families. No producer/alignment implementation.
Literal semantic graph expectations are independent of producer output and reject IDs as identity.
"""
import copy,hashlib,json,os,posixpath,struct,zipfile,zlib
import xml.etree.ElementTree as ET
WNS='http://schemas.openxmlformats.org/wordprocessingml/2006/main';RNS='http://schemas.openxmlformats.org/officeDocument/2006/relationships';PNS='http://schemas.openxmlformats.org/package/2006/relationships';CTNS='http://schemas.openxmlformats.org/package/2006/content-types'
W='{'+WNS+'}';R='{'+RNS+'}';A='{http://schemas.openxmlformats.org/drawingml/2006/main}';V='{urn:schemas-microsoft-com:vml}';WP='{http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing}'
NS=' xmlns:w="'+WNS+'" xmlns:r="'+RNS+'" xmlns:a="'+A[1:-1]+'" xmlns:v="'+V[1:-1]+'" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:wp="'+WP[1:-1]+'"'
def digest(data):return hashlib.sha256(data).hexdigest()
def text(s):return '<w:r><w:t xml:space="preserve">'+s+'</w:t></w:r>'
def p(s):return '<w:p>'+s+'</w:p>'
def png(side):
 def chunk(k,d):return struct.pack('>I',len(d))+k+d+struct.pack('>I',zlib.crc32(k+d)&0xffffffff)
 rgb=b'\xff\x00\x00'if side=='before'else b'\x00\x00\xff'
 return b'\x89PNG\r\n\x1a\n'+chunk(b'IHDR',struct.pack('>IIBBBBB',1,1,8,2,0,0,0))+chunk(b'IDAT',zlib.compress(b'\x00'+rgb))+chunk(b'IEND',b'')
def image(vml=False,click=False):
 if vml:return '<w:r><w:pict><v:shapetype id="_x0000_t75" coordsize="21600,21600" o:spt="75" path="m0,0l21600,0,21600,21600,0,21600xe"/><v:shape id="_x0000_i1025" type="#_x0000_t75" style="width:72pt;height:72pt"><v:imagedata r:id="rImage" o:title="Fixture"/></v:shape></w:pict></w:r>'
 return '<w:r><w:drawing><wp:inline><wp:extent cx="914400" cy="914400"/><wp:docPr id="1" name="Fixture">'+('<a:hlinkClick r:id="rClick"/>'if click else'')+'</wp:docPr><wp:cNvGraphicFramePr/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="0" name="Fixture"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rImage"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="914400" cy="914400"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>'
def link(s,anchor=False):return '<w:hyperlink '+('w:anchor="SharedAnchor"'if anchor else'r:id="rLink"')+'>'+text(s)+'</w:hyperlink>'
def note_ref():return '<w:r><w:footnoteReference w:id="7"/></w:r>'
def cell(s):return '<w:tc><w:tcPr><w:tcW w:w="2400" w:type="dxa"/></w:tcPr>'+p(s)+'</w:tc>'
def row(cells):return '<w:tr>'+''.join(cell(c)for c in cells)+'</w:tr>'
def table(rows):return '<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/></w:tblPr><w:tblGrid>'+''.join('<w:gridCol w:w="2400"/>'for _ in range(max(map(len,rows))))+'</w:tblGrid>'+''.join(row(r)for r in rows)+'</w:tbl>'
def relationships(rows):return '<Relationships xmlns="'+PNS+'">'+''.join('<Relationship Id="'+i+'" Type="'+RNS+'/'+kind+'" Target="'+target+'"'+(' TargetMode="External"'if external else'')+'/>'for i,kind,target,external in rows)+'</Relationships>'
def package(path,body,side,notes=None,internal=False,own_rels=False):
 rel=[('rStyles','styles','styles.xml',False),('rImage','image','media/image1.png',False),('rLink','hyperlink','target.xml'if internal else'https://'+side+'.example/body',not internal),('rClick','hyperlink','https://'+side+'.example/click',True)]
 entries={'word/document.xml':'<w:document'+NS+'><w:body>'+body+'<w:sectPr/></w:body></w:document>','_rels/.rels':relationships([('main','officeDocument','word/document.xml',False)]),'word/styles.xml':'<w:styles'+NS+'><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style></w:styles>','word/media/image1.png':png(side),'word/target.xml':'<fixture>'+side+' internal target</fixture>'}
 overrides=[('document.xml','document.main'),('styles.xml','styles')]
 if notes is not None:
  rel.append(('rNotes','footnotes','footnotes.xml',False));overrides.append(('footnotes.xml','footnotes'))
  special='<w:footnote w:type="separator" w:id="-1">'+p('<w:r><w:separator/></w:r>')+'</w:footnote><w:footnote w:type="continuationSeparator" w:id="0">'+p('<w:r><w:continuationSeparator/></w:r>')+'</w:footnote>'
  entries['word/footnotes.xml']='<w:footnotes'+NS+'>'+special+('<w:footnote w:id="7">'+p(notes)+'</w:footnote>'if notes else'')+'</w:footnotes>'
  entries['word/_rels/footnotes.xml.rels']=relationships([('rImage','image','media/image1.png',False),('rLink','hyperlink','https://'+side+'.example/note',True)])
 if own_rels:entries['word/media/_rels/image1.png.rels']=relationships([('owned','hyperlink','https://'+side+'.example/image-owned',True)])
 entries['word/_rels/document.xml.rels']=relationships(rel)
 entries['[Content_Types].xml']='<Types xmlns="'+CTNS+'"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/>'+''.join('<Override PartName="/word/'+name+'" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.'+kind+'+xml"/>'for name,kind in overrides)+'</Types>'
 with zipfile.ZipFile(path,'w')as z:
  for name,data in sorted(entries.items()):
   info=zipfile.ZipInfo(name,(2026,10,24,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;z.writestr(info,data)
def T(s):return {'text':s}
def I(side,vml=False):return {'image':{'sha256':digest(png(side)),'mime':'image/png','kind':'vml'if vml else'drawing'}}
def L(side,note=False):return {'hyperlink':{'text':'link','target':'https://'+side+'.example/'+('note'if note else'body')}}
def P(events):return {'paragraph':events}
def TAB(rows):return {'table':[[[P(e)]for e in cells]for cells in rows]}
def resources(side):return [T(side+' row '),I(side),L(side),{'footnote':[P([T(side+' note')])]}]
def validate_source(path):
 """Primary invariants only, not a full OpenXML XSD/native Word validation."""
 with zipfile.ZipFile(path)as z:
  names=z.namelist();assert len(names)==len(set(names));types=ET.fromstring(z.read('[Content_Types].xml'));defaults={n.get('Extension'):n.get('ContentType')for n in types if n.tag.endswith('Default')};overrides={n.get('PartName'):n.get('ContentType')for n in types if n.tag.endswith('Override')}
  for name in names:
   assert overrides.get('/'+name)or defaults.get(name.rsplit('.',1)[-1]),('missing content type',name)
   if name.endswith(('.xml','.rels')):ET.fromstring(z.read(name))
   if not name.endswith('.rels'):continue
   rels=ET.fromstring(z.read(name));ids=[r.get('Id')for r in rels];assert len(ids)==len(set(ids)),name
   owner=''if name=='_rels/.rels'else posixpath.join(posixpath.dirname(posixpath.dirname(name)),posixpath.basename(name)[:-5])
   for rel in rels:
    if rel.get('TargetMode')!='External':assert posixpath.normpath(posixpath.join(posixpath.dirname(owner),rel.get('Target').split('#')[0]))in names,(name,rel.attrib)
  for part in ['word/document.xml','word/footnotes.xml']:
   if part not in names:continue
   root=ET.fromstring(z.read(part));rels_path=posixpath.join(posixpath.dirname(part),'_rels',posixpath.basename(part)+'.rels');rels={r.get('Id'):r for r in ET.fromstring(z.read(rels_path))}
   starts={};ends=[];shape_ids=[];type_names=[n.get('id')for n in root.iter(V+'shapetype')];assert len(type_names)==len(set(type_names)),('duplicate VML type IDs',part);types_ids=set(type_names);doc_ids=[n.get('id')for n in root.iter(WP+'docPr')];assert len(doc_ids)==len(set(doc_ids)),('duplicate drawing IDs',part)
   for node in root.iter():
    for attr,value in node.attrib.items():
     if attr.startswith(R):assert value in rels,(part,attr,value)
    if node.tag==W+'bookmarkStart':assert node.get(W+'id')not in starts,('duplicate bookmark ID',part,node.attrib);starts[node.get(W+'id')]=node.get(W+'name')
    if node.tag==W+'bookmarkEnd':ends.append(node.get(W+'id'))
    if node.tag==W+'hyperlink'and node.get(W+'anchor'):assert node.get(W+'anchor')in [n.get(W+'name')for n in root.iter(W+'bookmarkStart')]
    if node.tag==V+'shape':shape_ids.append(node.get('id'));assert node.get('type','')[1:]in types_ids
    if node.tag==W+'tc':assert any(n.tag in [W+'p',W+'tbl']for n in node)
   assert len(shape_ids)==len(set(shape_ids));assert sorted(starts)==sorted(ends),('bookmark boundary mismatch',part,starts,ends);assert len(starts.values())==len(set(starts.values())),('duplicate bookmark names',part)
 return True
def reachable(path):
 """Resolve selected body/row/cell/note objects, not all package ZIP names or arbitrary rId spelling."""
 with zipfile.ZipFile(path)as z:
  def root(part):return ET.fromstring(z.read(part))
  def rels(part):return {n.get('Id'):n for n in root(posixpath.join(posixpath.dirname(part),'_rels',posixpath.basename(part)+'.rels'))}
  def resource(part,rid):
   rel=rels(part)[rid]
   if rel.get('TargetMode')=='External':return rel.get('Target')
   target=posixpath.normpath(posixpath.join(posixpath.dirname(part),rel.get('Target')));data=z.read(target)
   return {'sha256':digest(data),'mime':'image/png'if target.endswith('.png')else'application/xml'}
  def paragraph(node,part):
   result=[]
   def emit(value):
    if 'text'in value and result and 'text'in result[-1]:result[-1]['text']+=value['text']
    else:result.append(value)
   def walk(n):
    if n.tag==W+'t':emit(T(n.text or''));return
    if n.tag==W+'hyperlink':
     if n.get(W+'anchor'):
      anchor=n.get(W+'anchor');whole=root(part);candidates=[b for b in whole.iter(W+'bookmarkStart')if b.get(W+'name')==anchor];assert len(candidates)==1,('anchor must resolve one bookmark',part,anchor,len(candidates));start=candidates[0];ident=start.get(W+'id');active=False;value=''
      for b in whole.iter():
       if b is start:active=True
       elif b.tag==W+'bookmarkEnd'and b.get(W+'id')==ident:active=False
       elif active and b.tag==W+'t':value+=b.text or''
      emit({'anchor':{'text':''.join(n.itertext()),'targetText':value}})
     else:emit({'hyperlink':{'text':''.join(n.itertext()),'target':resource(part,n.get(R+'id'))}})
     return
    if n.tag in [A+'blip',V+'imagedata']:
     r=resource(part,n.get(R+'embed')or n.get(R+'id'));emit({'image':{'sha256':r['sha256'],'mime':r['mime'],'kind':'vml'if n.tag==V+'imagedata'else'drawing'}});return
    if n.tag==A+'hlinkClick':emit({'drawingClick':resource(part,n.get(R+'id'))});return
    if n.tag==W+'footnoteReference':
     notes=[x for x in root('word/footnotes.xml')if x.get(W+'id')==n.get(W+'id')];assert len(notes)==1,('note must resolve one target',part,n.get(W+'id'),len(notes));note=notes[0];emit({'footnote':blocks(note,'word/footnotes.xml')});return
    for c in n:walk(c)
   walk(node);return P(result)
  def blocks(container,part):
   out=[]
   for n in container:
    if n.tag==W+'p':out.append(paragraph(n,part))
    elif n.tag==W+'tbl':out.append({'table':[[blocks(c,part)for c in tr if c.tag==W+'tc']for tr in n if tr.tag==W+'tr']})
   return out
  return blocks(root('word/document.xml').find(W+'body'),'word/document.xml')
def build_fixtures(directory):
 os.makedirs(directory,exist_ok=True);cases=[]
 def add(name,before,after,expected_before,expected_after,**options):
  paths=[]
  for side,body in [('before',before),('after',after)]:
   f=posixpath.join(directory,name+'-'+side+'.docx');package(f,body,side,notes=options.get('notes',{}).get(side),internal=options.get('internal',False),own_rels=options.get('own_rels',False));validate_source(f);paths.append(f)
  case={'name':name,'before':paths[0],'after':paths[1],'expectedRejectGraph':expected_before,'expectedAcceptGraph':expected_after,'validity':'primary invariants verified; full XSD/native Word unverified','futureStrictRequired':not options.get('own_rels',False),'specUnknown':bool(options.get('own_rels',False))}
  for side,expected in [('before',expected_before),('after',expected_after)]:assert reachable(case[side])==expected,(name,side,reachable(case[side]),expected)
  cases.append(case)
 add('vml-body',p(text('Before VML ')+image(True)),p(text('After VML ')+image(True)),[P([T('Before VML '),I('before',True)])],[P([T('After VML '),I('after',True)])])
 add('vml-before-note',p(text('Retired note')+note_ref()),p(text('Stable')), [P([T('Retired note'),{'footnote':[P([T('VML note '),I('before',True)])]}])],[P([T('Stable')])],notes={'before':text('VML note ')+image(True),'after':''})
 def bookmark(side):return p('<w:bookmarkStart w:id="7" w:name="SharedAnchor"/>'+text(side+' destination')+'<w:bookmarkEnd w:id="7"/>')+p(link('jump',True))
 add('anchor-collision',bookmark('Before'),bookmark('After'),[P([T('Before destination')]),P([{'anchor':{'text':'jump','targetText':'Before destination'}}])],[P([T('After destination')]),P([{'anchor':{'text':'jump','targetText':'After destination'}}])])
 target=lambda side:{'sha256':digest(('<fixture>'+side+' internal target</fixture>').encode()),'mime':'application/xml'}
 add('internal-part-link',p(link('internal')),p(link('internal')),[P([{'hyperlink':{'text':'internal','target':target('before')}}])],[P([{'hyperlink':{'text':'internal','target':target('after')}}])],internal=True)
 for own in [False,True]:add('drawing-own-resource-rels'if own else'drawing-nested-click',p(text('Before click ')+image(click=True)),p(text('After click ')+image(click=True)),[P([T('Before click '),{'drawingClick':'https://before.example/click'},I('before')])],[P([T('After click '),{'drawingClick':'https://after.example/click'},I('after')])],own_rels=own)
 for axis in ['row','cell']:
  for action in ['insert','delete']:
   bodies={};graphs={};notes={}
   for side in ['before','after']:
    has=(side=='after')==(action=='insert');raw=text(side+' row ')+image()+link('link')+note_ref()
    matrix=[[text('Stable')],[raw]]if axis=='row'and has else[[text('Stable'),raw]]if has else[[text('Stable')]]
    bodies[side]=table(matrix)+p(text('End'));facts=[[ [T('Stable')] ],[resources(side)]]if axis=='row'and has else[[[T('Stable')],resources(side)]]if has else[[[T('Stable')]]]
    graphs[side]=[TAB(facts),P([T('End')])];notes[side]=text(side+' note')if has else''
   add('table-'+axis+'-'+action,bodies['before'],bodies['after'],graphs['before'],graphs['after'],notes=notes)
 return cases
if __name__=='__main__':
 import sys
 directory=sys.argv[1]if len(sys.argv)>1 else'/tmp/word-future-resources';cases=build_fixtures(directory)
 for c in cases:
  c['sources']={}
  for side in ['before','after']:
   with zipfile.ZipFile(c[side])as z:c['sources'][side]={'sha256':digest(open(c[side],'rb').read()),'parts':{n:digest(z.read(n))for n in z.namelist()},'relationships':{n:z.read(n).decode()for n in z.namelist()if n.endswith('.rels')}}
 print(json.dumps(cases,indent=2))
