"""Source-readiness fixtures only: stable ordered section/story ownership.
No producer calls, pairing inference, shared-helper edits or feature pass claims.
"""
import argparse, copy, hashlib, json, os, pathlib, posixpath, re, shutil, struct, subprocess, zipfile, zlib
import xml.etree.ElementTree as ET
WNS='http://schemas.openxmlformats.org/wordprocessingml/2006/main';RNS='http://schemas.openxmlformats.org/officeDocument/2006/relationships';PNS='http://schemas.openxmlformats.org/package/2006/relationships';CTNS='http://schemas.openxmlformats.org/package/2006/content-types'
W='{'+WNS+'}';R='{'+RNS+'}';A='{http://schemas.openxmlformats.org/drawingml/2006/main}';WP='{http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing}'
NS=' xmlns:w="'+WNS+'" xmlns:r="'+RNS+'" xmlns:a="'+A[1:-1]+'" xmlns:wp="'+WP[1:-1]+'"'
# Literal section maps are the source of truth, independently read back from the generated OPC graph.
CASES=[
 {'name':'two-distinct-owners','sections':[{'header':'HA','footer':'FX'},{'header':'HB','footer':'FY'}]},
 {'name':'two-shared-header','sections':[{'header':'HA','footer':'FX'},{'header':'HA','footer':'FX'}]},
 {'name':'three-inherited-header','sections':[{'header':'HA','footer':'FX'},{},{'header':'HB','footer':'FY'}]},
 {'name':'shifted-boundary-owner','sections':[{'header':'HA','footer':'FX'},{'header':'HB','footer':'FY'}],'afterIntro':True},
 {'name':'stable-bindings-margin-change','sections':[{'header':'HA','footer':'FX'},{'header':'HB','footer':'FY'}],'afterTopMargin':1440},
]
OWNERS={'HA':('header','HEADER A',1),'HB':('header','HEADER B',2),'FX':('footer','FOOTER X',3),'FY':('footer','FOOTER Y',4)}
def sha(data):return hashlib.sha256(data).hexdigest()
def png(side,key):
 n=OWNERS[key][2];rgb=bytes([30*n,50 if side=='before'else 200,220-30*n])
 def c(kind,data):return struct.pack('>I',len(data))+kind+data+struct.pack('>I',zlib.crc32(kind+data)&0xffffffff)
 return b'\x89PNG\r\n\x1a\n'+c(b'IHDR',struct.pack('>IIBBBBB',1,1,8,2,0,0,0))+c(b'IDAT',zlib.compress(b'\x00'+rgb))+c(b'IEND',b'')
def story_path(side,key):return 'word/'+('legacy'if side=='before'else'revised')+'/owners/'+key+'/story.xml'
def rid(side,key):return ('rOld_'if side=='before'else'afterBinding_')+key
def marker(side,key):return side.upper()+' '+OWNERS[key][1]
def target_uri(side,key):return 'https://'+side+'.example/'+key

def paragraph(value):return '<w:p><w:r><w:t xml:space="preserve">'+value+'</w:t></w:r></w:p>'
def drawing(number):return '<w:r><w:drawing><wp:inline><wp:extent cx="457200" cy="457200"/><wp:docPr id="'+str(number)+'" name="Story image"/><wp:cNvGraphicFramePr/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="0" name="Story"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rImage"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="457200" cy="457200"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>'
def rel_xml(rows):return '<Relationships xmlns="'+PNS+'">'+''.join('<Relationship Id="'+ident+'" Type="'+RNS+'/'+kind+'" Target="'+target+'"'+(' TargetMode="External"'if external else'')+'/>'for ident,kind,target,external in rows)+'</Relationships>'
def relpath(part):return posixpath.join(posixpath.dirname(part),'_rels',posixpath.basename(part)+'.rels')
def section_xml(binding,side,top):
 refs=''.join('<w:'+kind+'Reference w:type="default" r:id="'+rid(side,binding[kind])+'"/>'for kind in ['header','footer']if kind in binding)
 return '<w:sectPr>'+refs+'<w:type w:val="nextPage"/><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="'+str(top)+'" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr>'
def build(path,case,side):
 owners=sorted({key for section in case['sections']for key in section.values()});top=case.get('afterTopMargin',720)if side=='after'else 720
 body=paragraph('AFTER ONLY INTRO')if side=='after'and case.get('afterIntro')else''
 for index,binding in enumerate(case['sections']):
  body+=paragraph('BODY SECTION '+str(index+1))
  properties=section_xml(binding,side,top)
  if index+1<len(case['sections']):body+='<w:p><w:pPr>'+properties+'</w:pPr><w:r><w:t>BOUNDARY '+str(index+1)+'</w:t></w:r></w:p>'
  else:body+=properties
 entries={'word/document.xml':'<w:document'+NS+'><w:body>'+body+'</w:body></w:document>','_rels/.rels':rel_xml([('main','officeDocument','word/document.xml',False)])};rows=[];overrides=[('/word/document.xml','document.main')]
 for key in owners:
  kind,label,number=OWNERS[key];part=story_path(side,key);root='hdr'if kind=='header'else'ftr'
  entries[part]='<w:'+root+NS+'><w:p><w:r><w:t>'+marker(side,key)+'</w:t></w:r>'+drawing(number)+'<w:hyperlink r:id="rLink"><w:r><w:t>LINK '+key+'</w:t></w:r></w:hyperlink></w:p></w:'+root+'>'
  entries[posixpath.dirname(part)+'/media/image.png']=png(side,key)
  entries[relpath(part)]=rel_xml([('rImage','image','media/image.png',False),('rLink','hyperlink',target_uri(side,key),True)])
  rows.append((rid(side,key),kind,posixpath.relpath(part,'word'),False));overrides.append(('/'+part,kind))
 entries['word/_rels/document.xml.rels']=rel_xml(rows)
 entries['[Content_Types].xml']='<Types xmlns="'+CTNS+'"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="png" ContentType="image/png"/>'+''.join('<Override PartName="'+part+'" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.'+kind+'+xml"/>'for part,kind in overrides)+'</Types>'
 with zipfile.ZipFile(path,'w')as z:
  for name,data in sorted(entries.items()):
   info=zipfile.ZipInfo(name,(2026,10,24,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;z.writestr(info,data)

def expected(case,side):
 donor={};result=[];top=case.get('afterTopMargin',720)if side=='after'else 720
 for index,binding in enumerate(case['sections']):
  slots={}
  for kind in ['header','footer']:
   if kind in binding:donor[kind]=(index+1,binding[kind])
   source,key=donor[kind]
   slots[kind]={'variant':'default','explicit':kind in binding,'referenceId':rid(side,key)if kind in binding else None,'donorSection':source,'part':story_path(side,key),'marker':marker(side,key),'imageSHA256':sha(png(side,key)),'linkText':'LINK '+key,'linkTarget':target_uri(side,key)}
  result.append({'section':index+1,'boundaryOwnerText':'BOUNDARY '+str(index+1)if index+1<len(case['sections'])else'FINAL BODY','final':index+1==len(case['sections']),'type':'nextPage','topMargin':str(top),'slots':slots})
 return result

def inspect(path):
 """Independent source traversal: ordered live boundaries, explicit refs and effective donors.
Only fixed fixture schema invariants are checked, not full XSD/native Word conformance.
"""
 with zipfile.ZipFile(path)as z:
  names=z.namelist();assert len(names)==len(set(names));types=ET.fromstring(z.read('[Content_Types].xml'));overrides={n.get('PartName'):n.get('ContentType')for n in types if n.tag.endswith('Override')};defaults={n.get('Extension'):n.get('ContentType')for n in types if n.tag.endswith('Default')}
  for name in names:
   assert name=='[Content_Types].xml'or overrides.get('/'+name)or defaults.get(name.rsplit('.',1)[-1]),('missing content type',name)
   if name.endswith(('.xml','.rels')):ET.fromstring(z.read(name))
  def relationships(part):
   root=ET.fromstring(z.read(relpath(part)));ids=[n.get('Id')for n in root];assert len(ids)==len(set(ids));return {n.get('Id'):n for n in root}
  body=ET.fromstring(z.read('word/document.xml')).find(W+'body');assert body[-1].tag==W+'sectPr';assert len(body.findall(W+'sectPr'))==1
  assert not any(n.tag==W+'sectPrChange'for n in body.iter()),'Source has no reference history or pre-existing revisions'
  sections=[];relations=relationships('word/document.xml');donors={}
  for child in body:
   props=child if child.tag==W+'sectPr'else child.find(W+'pPr/'+W+'sectPr')if child.tag==W+'p'else None
   if props is None:continue
   index=len(sections)+1;order=[n.tag for n in props];rank={W+'headerReference':0,W+'footerReference':1,W+'type':2,W+'pgSz':3,W+'pgMar':4};assert all(n in rank for n in order);assert [rank[n]for n in order]==sorted(rank[n]for n in order)
   if child.tag==W+'p':assert list(child)[0].tag==W+'pPr'
   explicit={}
   for ref in props:
    if ref.tag not in [W+'headerReference',W+'footerReference']:continue
    kind='header'if ref.tag==W+'headerReference'else'footer';assert ref.get(W+'type')=='default'and kind not in explicit
    relationship=relations[ref.get(R+'id')];assert relationship.get('Type')==RNS+'/'+kind and relationship.get('TargetMode')is None
    target=posixpath.normpath(posixpath.join('word',relationship.get('Target')));assert target in names;assert overrides['/'+target].endswith('.'+kind+'+xml')
    story=ET.fromstring(z.read(target));assert story.tag==W+('hdr'if kind=='header'else'ftr');owned=relationships(target)
    blips=list(story.iter(A+'blip'));links=list(story.iter(W+'hyperlink'));assert len(blips)==len(links)==1
    image=owned[blips[0].get(R+'embed')];assert image.get('Type')==RNS+'/image'and image.get('TargetMode')is None
    image_part=posixpath.normpath(posixpath.join(posixpath.dirname(target),image.get('Target')));assert image_part in names
    link=owned[links[0].get(R+'id')];assert link.get('Type')==RNS+'/hyperlink'and link.get('TargetMode')=='External'
    text=''.join(n.text or''for n in story.find(W+'p').findall(W+'r/'+W+'t'))
    value={'variant':'default','explicit':True,'referenceId':ref.get(R+'id'),'donorSection':index,'part':target,'marker':text,'imageSHA256':sha(z.read(image_part)),'linkText':''.join(links[0].itertext()),'linkTarget':link.get('Target')};explicit[kind]=value;donors[kind]=value
   slots={}
   for kind in ['header','footer']:
    assert kind in donors;value=dict(donors[kind]);value.update({'explicit':kind in explicit,'referenceId':explicit[kind]['referenceId']if kind in explicit else None});slots[kind]=value
   sections.append({'section':index,'boundaryOwnerText':'FINAL BODY'if child.tag==W+'sectPr'else''.join(n.text or''for n in child.iter(W+'t')),'final':child.tag==W+'sectPr','type':props.find(W+'type').get(W+'val'),'topMargin':props.find(W+'pgMar').get(W+'top'),'slots':slots})
  return sections

def native_source_check(directory,cases):
 executable=shutil.which('libreoffice');assert executable,'LibreOffice unavailable; no native source proof'
 native=directory/'native-open';native.mkdir(exist_ok=True);profile=directory/'native-profile';sources=[str(c[side])for c in cases for side in ['before','after']]
 run=subprocess.run([executable,'-env:UserInstallation='+profile.resolve().as_uri(),'--headless','--convert-to','pdf','--outdir',str(native),*sources],capture_output=True,text=True,timeout=120);(directory/'native-open.log').write_text(run.stdout+run.stderr);assert run.returncode==0
 proof=[]
 for c in cases:
  for side in ['before','after']:
   pdf=native/(pathlib.Path(c[side]).stem+'.pdf');assert pdf.exists();info=subprocess.check_output(['pdfinfo',str(pdf)],text=True);pages=int(re.search(r'^Pages:\s+(\d+)',info,re.M).group(1));assert pages==len(c['expected'][side]),(c['name'],side,pages)
   for index,section in enumerate(c['expected'][side],1):
    extracted=subprocess.check_output(['pdftotext','-f',str(index),'-l',str(index),str(pdf),'-'],text=True)
    markers=[v['marker']for v in section['slots'].values()]+['BODY SECTION '+str(index)]
    assert all(marker in extracted for marker in markers),(c['name'],side,index,markers,extracted)
    proof.append({'name':c['name'],'side':side,'page':index,'expectedVisibleMarkers':markers,'matched':True})
 return {'pagesVerified':len(proof),'records':proof,'scope':'LibreOffice source PDF per-page donor/content marker proof; not producer accept/reject/native Microsoft Word or full XSD conformance.'}

def main():
 parser=argparse.ArgumentParser();parser.add_argument('directory');parser.add_argument('--native',action='store_true');args=parser.parse_args();directory=pathlib.Path(args.directory);directory.mkdir(parents=True,exist_ok=True);cases=[]
 for spec in CASES:
  case={'name':spec['name'],'expected':{},'sourceSHA256':{},'parts':{},'relationships':{},'featureApproval':False}
  for side in ['before','after']:
   file=directory/(spec['name']+'-'+side+'.docx');build(file,spec,side);case[side]=str(file);case['expected'][side]=expected(spec,side);assert inspect(file)==case['expected'][side],(spec['name'],side)
   case['sourceSHA256'][side]=sha(file.read_bytes())
   with zipfile.ZipFile(file)as z:case['parts'][side]={n:sha(z.read(n))for n in z.namelist()};case['relationships'][side]={n:z.read(n).decode()for n in z.namelist()if n.endswith('.rels')}
  rejected=copy.deepcopy(case['expected']['before'])
  for old,current in zip(rejected,case['expected']['after']):
   for kind in ['header','footer']:
    old['slots'][kind]['part']=current['slots'][kind]['part'];old['slots'][kind]['referenceId']=current['slots'][kind]['referenceId']
  case['futureExpectedOutputs']={'accept':case['expected']['after'],'reject':rejected,'bindingRule':'Both views retain current AFTER reference IDs and story owner paths. Reject restores BEFORE content/resources and base properties; never old references in sectPrChange.'}
  case['futureComparisonOptions']={'metadata':True,'formatting':True,'formattingMask':'all enabled; especially paragraph/base-section properties for margin case'}
  keys=sorted({key for binding in spec['sections']for key in binding.values()})
  case['expectedUniqueStoryPairs']=[{'ownerKey':key,'beforePart':story_path('before',key),'afterPart':story_path('after',key),'explicitBindings':[{'section':i+1,'kind':kind,'variant':'default'}for i,binding in enumerate(spec['sections'])for kind,value in binding.items()if value==key],'effectiveBindings':[{'section':section['section'],'kind':kind,'variant':'default','inherited':not slot['explicit']}for section in case['expected']['before']for kind,slot in section['slots'].items()if slot['part']==story_path('before',key)],'futurePhysicalEmissionCount':1}for key in keys]
  case['rawSectionBodyChildIndices']={}
  for side in ['before','after']:
   with zipfile.ZipFile(case[side])as archive:body=ET.fromstring(archive.read('word/document.xml')).find(W+'body')
   case['rawSectionBodyChildIndices'][side]=[i for i,node in enumerate(body)if node.tag==W+'sectPr'or(node.tag==W+'p'and node.find(W+'pPr/'+W+'sectPr')is not None)]
  cases.append(case)
 report={'kind':'Source readiness only; guarded producer baselines are not feature passes','fixturePairs':len(cases),'sourceDOCX':len(cases)*2,'cases':cases,'limitations':['No producer invocation or new comparison logic; section correspondence must come from authoritative decisions, never this path/index enumeration.','Ordered native source graph includes explicit/inherited donor identity and selected owner-relative image/link bytes, not unordered ZIP names.','Only stable default variants/nextPage boundaries admitted; first/even activation, sharing-map changes, inserted/deleted/moved/split/merged boundaries remain outside this fixture set.','Full OpenXML XSD and native Microsoft Word conformance unverified. No previous references inside sectPrChange are generated.','Optional separator/continuationSeparator fixtures omitted: existing note fixtures already cover same-role variants; no duplication.']}
 if args.native:report['nativeSourceProof']=native_source_check(directory,cases)
 manifest=directory/'source-manifest.json';manifest.write_text(json.dumps(report,indent=2));print(json.dumps({'manifest':str(manifest),'fixturePairs':len(cases),'sourceDOCX':len(cases)*2,'nativePages':report.get('nativeSourceProof',{}).get('pagesVerified'),'featureApproval':False},indent=2))
if __name__=='__main__':main()
