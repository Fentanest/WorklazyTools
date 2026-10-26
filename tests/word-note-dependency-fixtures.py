"""Four input-only source pairs: decimal note dependency and relationship-owned paths.
Literal RAW source oracles, no note pairing/producer/accept-reject policy.
IDs and owner paths are package-local facts; output rebinding belongs to the owner.
"""
import argparse,hashlib,importlib.util,json,pathlib,posixpath,shutil,subprocess,tempfile,zipfile
import xml.etree.ElementTree as ET
ROOT=pathlib.Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('note_fixture',ROOT/'word-note-fixtures.py');helper=importlib.util.module_from_spec(spec);spec.loader.exec_module(helper)
WNS=helper.WNS;RNS=helper.RNS;PNS=helper.PNS;W=helper.W;R=helper.R;CT='{http://schemas.openxmlformats.org/package/2006/content-types}'
NS=f' xmlns:w="{WNS}" xmlns:r="{RNS}" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"'
sha=lambda data:hashlib.sha256(data).hexdigest()
def p(text,extra='',num=None):
 props='' if num is None else '<w:pPr><w:numPr><w:ilvl w:val="0"/><w:numId w:val="'+str(num)+'"/></w:numPr></w:pPr>'
 return '<w:p>'+props+helper.run(text)+extra+'</w:p>'
def rels(rows):return '<Relationships xmlns="'+PNS+'">'+''.join('<Relationship Id="'+i+'" Type="'+RNS+'/'+kind+'" Target="'+target+'"'+(' TargetMode="External"' if external else '')+'/>' for i,kind,target,external in rows)+'</Relationships>'
def numbering(defs):
 return '<w:numbering'+NS+'>'+''.join('<w:abstractNum w:abstractNumId="'+str(a)+'"><w:multiLevelType w:val="singleLevel"/><w:lvl w:ilvl="0"><w:start w:val="'+str(start)+'"/><w:numFmt w:val="decimal"/><w:lvlText w:val="%1."/></w:lvl></w:abstractNum>' for a,start,n in defs)+''.join('<w:num w:numId="'+str(n)+'"><w:abstractNumId w:val="'+str(a)+'"/></w:num>' for a,start,n in defs)+'</w:numbering>'
def package(path,family,kind,side):
 custom=family=='custom-path';part='word/notes/'+('source' if side=='before' else 'revised')+'/'+kind+'s.xml' if custom else 'word/'+kind+'s.xml'
 ident=7 if side=='before' else 19;main=[('notes',kind+'s',posixpath.relpath(part,'word'),False)];entries={};defaults=[('rels','application/vnd.openxmlformats-package.relationships+xml'),('xml','application/xml')]
 ordinary='';reference=lambda n:'<w:r><w:'+kind+'Reference w:id="'+str(n)+'"/></w:r>'
 if custom:
  body=p('Stable anchor')+p('Note anchor',reference(ident))+p('Body resource ','<w:r>'+helper.drawing()+'</w:r>'+  '<w:hyperlink r:id="rIdShared">'+helper.run('Body link')+'</w:hyperlink>')
  main += [('rIdImage','image','media/body.png',False),('rIdShared','hyperlink','https://body.example/',True)]
  entries['word/media/body.png']=helper.image_bytes('after');entries['word/notes/media/note.png']=helper.image_bytes(side);defaults.append(('png','image/png'))
  ordinary='<w:'+kind+' w:id="'+str(ident)+'">'+p(side+' custom '+kind+' ', '<w:r><w:'+kind+'Ref/></w:r><w:r>'+helper.drawing()+'</w:r>'+ '<w:hyperlink r:id="rIdShared">'+helper.run('Note link')+'</w:hyperlink>')+'</w:'+kind+'>'
  entries[posixpath.join(posixpath.dirname(part),'_rels',posixpath.basename(part)+'.rels')]=rels([('rIdImage','image','../media/note.png',False),('rIdShared','hyperlink','https://note.'+side+'.example/',True)])
 else:
  body=p('Stable anchor')+(p('Retired '+kind,reference(7)) if side=='before' else '')+p('Owned decimal item',num=9 if side=='before' else 5)
  ordinary='<w:'+kind+' w:id="7">'+p('Numbered '+kind,'<w:r><w:'+kind+'Ref/></w:r>',num=5)+'</w:'+kind+'>' if side=='before' else ''
  main.append(('numbering','numbering','numbering.xml',False));entries['word/numbering.xml']=numbering([(3,1,5),(8,9,9)] if side=='before' else [(3,9,5)])
 special='<w:'+kind+' w:id="-1" w:type="separator"><w:p><w:r><w:separator/></w:r></w:p></w:'+kind+'><w:'+kind+' w:id="0" w:type="continuationSeparator"><w:p><w:r><w:continuationSeparator/></w:r></w:p></w:'+kind+'>'
 entries[part]='<w:'+kind+'s'+NS+'>'+special+ordinary+'</w:'+kind+'s>'
 entries['word/document.xml']='<w:document'+NS+'><w:body>'+body+'<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>'
 entries['word/_rels/document.xml.rels']=rels(main);entries['_rels/.rels']=rels([('main','officeDocument','word/document.xml',False)])
 overrides=[('/word/document.xml','document.main'),('/'+part,kind+'s')]+([] if custom else [('/word/numbering.xml','numbering')])
 entries['[Content_Types].xml']='<Types xmlns="'+CT[1:-1]+'">'+''.join('<Default Extension="'+ext+'" ContentType="'+mime+'"/>'for ext,mime in defaults)+''.join('<Override PartName="'+name+'" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.'+typ+'+xml"/>'for name,typ in overrides)+'</Types>'
 with zipfile.ZipFile(path,'w',compression=zipfile.ZIP_STORED)as z:
  for name,data in sorted(entries.items()):
   info=zipfile.ZipInfo(name,(2000,1,1,0,0,0));info.external_attr=0o600<<16;z.writestr(info,data.encode() if isinstance(data,str)else data)

def graph(path,kind):
 """Resolve ACTUAL main relationship owners; conventional note names are never assumed."""
 with zipfile.ZipFile(path)as z:
  names=z.namelist();assert len(names)==len(set(names)) and z.testzip() is None
  types=ET.fromstring(z.read('[Content_Types].xml'))
  def mime(part):
   overrides=[n.get('ContentType')for n in types if n.get('PartName')=='/'+part]
   values=overrides or [n.get('ContentType')for n in types if n.get('Extension')==part.rsplit('.',1)[-1]];assert len(values)==1;return values[0]
  def relationships(owner):
   name=posixpath.join(posixpath.dirname(owner),'_rels',posixpath.basename(owner)+'.rels') if owner else '_rels/.rels'
   rows=list(ET.fromstring(z.read(name))) if name in names else [];assert len({r.get('Id')for r in rows})==len(rows);return rows
  def target(owner,rel):return posixpath.normpath(posixpath.join(posixpath.dirname(owner),rel.get('Target')))
  for name in names:
   if name!='[Content_Types].xml':mime(name)
   if name.endswith(('.xml','.rels')):ET.fromstring(z.read(name))
   if name.endswith('.rels'):
    owner='' if name=='_rels/.rels' else posixpath.join(posixpath.dirname(posixpath.dirname(name)),posixpath.basename(name)[:-5])
    for rel in relationships(owner):
     if rel.get('TargetMode')!='External':assert target(owner,rel) in names
  main=relationships('word/document.xml');note_rels=[r for r in main if r.get('Type')==RNS+'/'+kind+'s'];assert len(note_rels)==1
  note_part=target('word/document.xml',note_rels[0]);assert mime(note_part)=='application/vnd.openxmlformats-officedocument.wordprocessingml.'+kind+'s+xml'
  for part in ['word/document.xml',note_part]:
   root=ET.fromstring(z.read(part));parents={c:p for p in root.iter()for c in p}
   for drawing in root.iter(W+'drawing'):assert parents[drawing].tag==W+'r' and parents[parents[drawing]].tag==W+'p'
  notes=ET.fromstring(z.read(note_part));assert notes.tag==W+kind+'s';ordinary=[n for n in notes if n.get(W+'type','normal')=='normal'];assert len({n.get(W+'id')for n in ordinary})==len(ordinary)
  num_rels=[r for r in main if r.get('Type')==RNS+'/numbering'];num_part=target('word/document.xml',num_rels[0]) if num_rels else None
  number_root=ET.fromstring(z.read(num_part)) if num_part else None
  def numeric(paragraph):
   num=paragraph.find(W+'pPr/'+W+'numPr')
   if num is None:return None
   raw=num.find(W+'numId').get(W+'val');level=num.find(W+'ilvl').get(W+'val');nums=[n for n in number_root.findall(W+'num')if n.get(W+'numId')==raw];assert len(nums)==1
   abstract=nums[0].find(W+'abstractNumId').get(W+'val');defs=[n for n in number_root.findall(W+'abstractNum')if n.get(W+'abstractNumId')==abstract];assert len(defs)==1
   levels=[n for n in defs[0].findall(W+'lvl')if n.get(W+'ilvl')==level];assert len(levels)==1;lvl=levels[0]
   return {'numId':raw,'abstractNumId':abstract,'ilvl':level,'numFmt':lvl.find(W+'numFmt').get(W+'val'),'start':lvl.find(W+'start').get(W+'val'),'lvlText':lvl.find(W+'lvlText').get(W+'val')}
  def resources(part):
   relmap={r.get('Id'):r for r in relationships(part)};root=ET.fromstring(z.read(part));out=[]
   for n in root.iter():
    if n.tag not in ['{http://schemas.openxmlformats.org/drawingml/2006/main}blip',W+'hyperlink']:continue
    rid=n.get(R+'embed') or n.get(R+'id');rel=relmap[rid];item={'owner':part,'rid':rid,'type':rel.get('Type').rsplit('/',1)[-1],'rawTarget':rel.get('Target')}
    if rel.get('TargetMode')=='External':item['external']=rel.get('Target')
    else:
     dest=target(part,rel);item.update({'resolvedPart':dest,'mime':mime(dest),'sha256':sha(z.read(dest))})
    out.append(item)
   return out
  body=ET.fromstring(z.read('word/document.xml')).find(W+'body');assert list(body)[-1].tag==W+'sectPr';refs=[]
  for i,pnode in enumerate(body.findall(W+'p')):
   for n in pnode.iter(W+kind+'Reference'):
    ident=n.get(W+'id');assert sum(n.get(W+'id')==ident for n in ordinary)==1;refs.append({'bodyParagraph':i,'id':ident,'ownerPart':note_part})
  return {'bodyBlocks':[n.tag.rsplit('}',1)[-1]for n in body],'bodyParagraphs':[{'text':''.join(n.text or ''for n in pnode.iter(W+'t')),'numbering':numeric(pnode)}for pnode in body.findall(W+'p')],'mainNoteRelationship':{'id':note_rels[0].get('Id'),'rawTarget':note_rels[0].get('Target'),'resolvedPart':note_part},'noteContentType':mime(note_part),'references':refs,'specials':[[n.get(W+'id'),n.get(W+'type')]for n in notes if n.get(W+'type')],'notes':[{'id':n.get(W+'id'),'paragraphs':[{'text':''.join(t.text or ''for t in pnode.iter(W+'t')),'numbering':numeric(pnode)}for pnode in n.findall(W+'p')]}for n in ordinary],'bodyResources':resources('word/document.xml'),'noteResources':resources(note_part),'numberingPart':num_part,'mainNumberingRelationship':({'id':num_rels[0].get('Id'),'rawTarget':num_rels[0].get('Target'),'resolvedPart':num_part} if num_rels else None)}

def expected(family,kind,side):
 custom=family=='custom-path';before=side=='before';part='word/notes/'+('source'if before else'revised')+'/'+kind+'s.xml'if custom else'word/'+kind+'s.xml';ident='7'if before else'19'
 number=lambda n,a,start:{'numId':n,'abstractNumId':a,'ilvl':'0','numFmt':'decimal','start':start,'lvlText':'%1.'}
 paragraph=lambda text,num=None:{'text':text,'numbering':num}
 paragraphs=[paragraph('Stable anchor')]+([paragraph('Note anchor'),paragraph('Body resource Body link')]if custom else([paragraph('Retired '+kind)]if before else[])+[paragraph('Owned decimal item',number('9','8','9')if before else number('5','3','9'))])
 ordinary=[{'id':ident,'paragraphs':[paragraph(side+' custom '+kind+' Note link')]}]if custom else([{'id':'7','paragraphs':[paragraph('Numbered '+kind,number('5','3','1'))]}]if before else[])
 image=lambda owner,rid,raw,dest,color:{'owner':owner,'rid':rid,'type':'image','rawTarget':raw,'resolvedPart':dest,'mime':'image/png','sha256':sha(helper.image_bytes(color))}
 link=lambda owner,url:{'owner':owner,'rid':'rIdShared','type':'hyperlink','rawTarget':url,'external':url}
 return {'bodyBlocks':['p']*len(paragraphs)+['sectPr'],'bodyParagraphs':paragraphs,'mainNoteRelationship':{'id':'notes','rawTarget':posixpath.relpath(part,'word'),'resolvedPart':part},'noteContentType':'application/vnd.openxmlformats-officedocument.wordprocessingml.'+kind+'s+xml','references':[{'bodyParagraph':1,'id':ident if custom else'7','ownerPart':part}]if custom or before else[],'specials':[['-1','separator'],['0','continuationSeparator']],'notes':ordinary,'bodyResources':[image('word/document.xml','rIdImage','media/body.png','word/media/body.png','after'),link('word/document.xml','https://body.example/')]if custom else[],'noteResources':[image(part,'rIdImage','../media/note.png','word/notes/media/note.png',side),link(part,'https://note.'+side+'.example/')]if custom else[],'numberingPart':None if custom else'word/numbering.xml','mainNumberingRelationship':None if custom else{'id':'numbering','rawTarget':'numbering.xml','resolvedPart':'word/numbering.xml'}}

SOURCE_SHA256 = {'numbering-before-only-footnote-before.docx': 'b456b8582ffd0cb194a50491675612722a63322897d0fa0fc2f742fa62f54db9', 'numbering-before-only-footnote-after.docx': '275fcefe596cfbe6a63e08d12a04ef6b4346b0c17eae85c729ec8eb518180813', 'numbering-before-only-endnote-before.docx': 'cb52d1c81956b02da145484616a7f98329836e881b9a8d1fb4e59170a2349211', 'numbering-before-only-endnote-after.docx': '76a933c49b471ac07102fe395b39bc4ac80a6e60beb450d182069bae6dde36c4', 'custom-path-footnote-before.docx': '0c04b39c4682141ac22a8641d35933ed89c88c773d076ab34fcd77563357adab', 'custom-path-footnote-after.docx': '0e1e38fe11cf05cd0cbdf553715de10b239399be4b9d2acaba5b0d471c39f978', 'custom-path-endnote-before.docx': '08bd83ddb89b1dd508572e223beb343ec4b8d538f98d1aabd8f663a2b73804b4', 'custom-path-endnote-after.docx': '9d64cd9185f44a0005a183ef2fb6fd508577d3622f6a1670d629dcdd3fb1dc79'}

def fixtures(directory):
 directory=pathlib.Path(directory);directory.mkdir(parents=True,exist_ok=True);cases=[]
 for family in ['numbering-before-only','custom-path']:
  for kind in ['footnote','endnote']:
   name=family+'-'+kind;case={'name':name,'kind':kind,'scope':'input-only RAW sources; no output ID/path equality, matching or producer assertion','sources':{}}
   for side in ['before','after']:
    path=directory/(name+'-'+side+'.docx');package(path,family,kind,side);assert sha(path.read_bytes())==SOURCE_SHA256[path.name];literal=expected(family,kind,side);assert graph(path,kind)==literal,(name,side,graph(path,kind),literal)
    with zipfile.ZipFile(path)as z:parts={n:sha(z.read(n))for n in z.namelist()};relationships={n:z.read(n).decode()for n in z.namelist()if n.endswith('.rels')}
    case['sources'][side]={'path':str(path.resolve()),'sha256':sha(path.read_bytes()),'expectedRawGraph':literal,'partHashes':parts,'rawRelationshipParts':relationships}
   cases.append(case)
 return cases

def native(cases,directory):
 executable=shutil.which('libreoffice');out=pathlib.Path(directory)/'native';out.mkdir(exist_ok=True);paths=[pathlib.Path(s['path'])for c in cases for s in c['sources'].values()]
 if not executable:return {'available':False}
 with tempfile.TemporaryDirectory(prefix='note-dependency-lo-')as profile:
  command=[executable,'-env:UserInstallation='+pathlib.Path(profile).as_uri(),'--headless','--convert-to','pdf','--outdir',str(out),*[str(p)for p in paths]];proc=subprocess.run(command,capture_output=True,text=True,timeout=60)
 (out/'convert.log').write_text(proc.stdout+proc.stderr);assert proc.returncode==0;records=[]
 for path in paths:
  pdf=out/(path.stem+'.pdf');assert pdf.is_file()and pdf.read_bytes().startswith(b'%PDF-');text=subprocess.check_output(['pdftotext',str(pdf),'-'],text=True);assert 'Stable anchor'in text
  records.append({'source':str(path.resolve()),'pdf':str(pdf.resolve()),'pdfSha256':sha(pdf.read_bytes()),'renderedText':text,'numberedOrCustomNoteMarkerVisible':('Numbered 'in text or 'custom 'in text),'noteMarkerExpected':path.stem.startswith('custom-path')or path.stem.endswith('before')})
 return {'available':True,'version':subprocess.check_output([executable,'--version'],text=True).strip(),'command':command,'exitCode':0,'records':records,'limits':'Input-only native open/render markers, not producer/native operations/fullXSD/MSWord proof.'}
if __name__=='__main__':
 parser=argparse.ArgumentParser();parser.add_argument('--out',default='/tmp/word-note-dependencies');parser.add_argument('--native',action='store_true');args=parser.parse_args();cases=fixtures(args.out)
 report={'generatorSha256':sha(pathlib.Path(__file__).read_bytes()),'helperSha256':sha((ROOT/'word-note-fixtures.py').read_bytes()),'cases':cases,'validation':'Partial OPC/types/owner relationships/basic decimal references/literalrawgraph checks only; no fullXSD.'}
 if args.native:report['native']=native(cases,args.out)
 for c in cases:
  for s in c['sources'].values():assert sha(pathlib.Path(s['path']).read_bytes())==s['sha256']
 path=pathlib.Path(args.out)/'manifest.json';path.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'pairs':len(cases),'sourceFiles':len(cases)*2,'manifest':str(path.resolve()),'sha256':sha(path.read_bytes())}))
