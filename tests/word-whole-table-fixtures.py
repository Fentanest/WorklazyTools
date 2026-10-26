"""Five deterministic SOURCE pairs; no producer operation/support assertion.
All-scope future terminal oracle: accept=after raw graph, reject=before raw graph.
Zero-row container is deliberately distinct from absent table, including if a native
reader normalizes it. Checks below are partial OPC/child-order, NOT full XSD.
Primary shape: Open-XML-SDK v3.0.1 CT_Tbl/w:tbl, CT_Row/w:tr, CT_Tc/w:tc:
https://raw.githubusercontent.com/dotnet/Open-XML-SDK/v3.0.1/data/schemas/schemas_openxmlformats_org_wordprocessingml_2006_main.json
"""
import argparse, hashlib, importlib.util, json, pathlib, posixpath, shutil, subprocess, tempfile, zipfile
import xml.etree.ElementTree as ET
from xml.sax.saxutils import escape
WNS='http://schemas.openxmlformats.org/wordprocessingml/2006/main'; W='{'+WNS+'}'
RNS='http://schemas.openxmlformats.org/officeDocument/2006/relationships'; R='{'+RNS+'}'
PNS='http://schemas.openxmlformats.org/package/2006/relationships'
helper_path=pathlib.Path(__file__).with_name('word-note-fixtures.py')
spec=importlib.util.spec_from_file_location('note_fixture',helper_path); note_fixture=importlib.util.module_from_spec(spec);spec.loader.exec_module(note_fixture)
PNG=note_fixture.image_bytes('before'); SHA=lambda b:hashlib.sha256(b).hexdigest()
NS=f' xmlns:w="{WNS}" xmlns:r="{RNS}" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"'

def p(text, extra=''):return '<w:p><w:r><w:t>'+escape(text)+'</w:t></w:r>'+extra+'</w:p>'
def ref(n):return '<w:r><w:footnoteReference w:id="'+str(n)+'"/></w:r>'
def table(mode):
    if mode=='absent':return ''
    columns=1 if mode=='rich' else 2
    props='<w:tblPr><w:tblW w:w="6000" w:type="dxa"/><w:tblBorders>'+''.join('<w:'+k+' w:val="single" w:sz="4"/>' for k in ['top','left','bottom','right','insideH','insideV'])+'</w:tblBorders></w:tblPr>'
    grid='<w:tblGrid>'+('<w:gridCol w:w="'+str(6000//columns)+'"/>')*columns+'</w:tblGrid>'
    cells=[p('Cell A'),p('Cell B')]
    if mode=='rich':cells=[p('Rich cell', '<w:hyperlink r:id="link">'+p('External link')[5:-6]+'</w:hyperlink>'+ref(7)+'<w:r>'+note_fixture.drawing().replace('rIdImage','image')+'</w:r>')]
    rows='' if mode=='zero' else '<w:tr>'+''.join('<w:tc><w:tcPr><w:tcW w:w="'+str(6000//columns)+'" w:type="dxa"/></w:tcPr>'+c+'</w:tc>' for c in cells)+'</w:tr>'
    return '<w:tbl>'+props+grid+rows+'</w:tbl>'

# Literal source specifications independent of a diff/parser/matcher.
CASES=[('whole-table-birth','absent','plain',False),('whole-table-death','plain','absent',False),
       ('zero-row-to-populated','zero','plain',False),('rich-table-death-note-id-collision','rich','absent',False),
       ('terminal-table-birth','absent','plain',True)]

def expected(mode,terminal=False,rich_case=False,side='before'):
    blocks=['p']+([] if mode=='absent' else ['tbl'])+([] if terminal else ['p'])+['sectPr']
    texts=['Anchor start']+({'absent':[],'zero':[],'plain':['Cell A','Cell B'],'rich':['Rich cell','External link']}[mode])+([] if terminal else ['Anchor end'])
    notes=([{'id':'7','text':'Table note'},{'id':'8','text':'Outside note'}] if side=='before' else [{'id':'7','text':'Outside note'}]) if rich_case else []
    rels=[['footnotes','footnotes','footnotes.xml','']] if rich_case else []
    if mode=='rich':rels += [['image','image','media/table.png',''],['link','hyperlink','https://example.invalid/table','External']]
    return {'bodyBlocks':blocks,'bodyTextNodes':texts,'tables':[] if mode=='absent' else [{'gridColumns':1 if mode=='rich' else 2,'rows':0 if mode=='zero' else 1,'cells':[] if mode=='zero' else [1 if mode=='rich' else 2]}], 'noteReferences':(['7','8'] if side=='before' else ['7']) if rich_case else [],'notes':notes,'relationships':sorted(rels),'media':[{'part':'word/media/table.png','sha256':SHA(PNG)}] if mode=='rich' else []}

def package(path,mode,terminal=False,rich_case=False,side='before'):
    outside=ref(8 if side=='before' else 7) if rich_case else ''
    body=p('Anchor start')+table(mode)+('' if terminal else p('Anchor end',outside))+'<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>'
    rel=lambda rows:'<Relationships xmlns="'+PNS+'">'+''.join('<Relationship Id="'+i+'" Type="'+RNS+'/'+typ+'" Target="'+target+'"'+(' TargetMode="External"' if ext else '')+'/>' for i,typ,target,ext in rows)+'</Relationships>'
    entries={'word/document.xml':'<w:document'+NS+'><w:body>'+body+'</w:body></w:document>','_rels/.rels':rel([('main','officeDocument','word/document.xml',False)])}
    relations=[]
    if rich_case:
        relations.append(('footnotes','footnotes','footnotes.xml',False))
        ordinary=(note_fixture.note(7,'Table note')+note_fixture.note(8,'Outside note')) if side=='before' else note_fixture.note(7,'Outside note')
        entries['word/footnotes.xml']='<w:footnotes'+NS+'><w:footnote w:type="separator" w:id="-1"><w:p><w:r><w:separator/></w:r></w:p></w:footnote><w:footnote w:type="continuationSeparator" w:id="0"><w:p><w:r><w:continuationSeparator/></w:r></w:p></w:footnote>'+ordinary+'</w:footnotes>'
    if mode=='rich':
        relations += [('image','image','media/table.png',False),('link','hyperlink','https://example.invalid/table',True)]
        entries['word/media/table.png']=PNG
    if relations:entries['word/_rels/document.xml.rels']=rel(relations)
    entries['[Content_Types].xml']='<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>'+('<Default Extension="png" ContentType="image/png"/>' if mode=='rich' else '')+'<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'+('<Override PartName="/word/footnotes.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml"/>' if rich_case else '')+'</Types>'
    with zipfile.ZipFile(path,'w',compression=zipfile.ZIP_STORED) as z:
        for name,value in sorted(entries.items()):
            info=zipfile.ZipInfo(name,date_time=(2000,1,1,0,0,0));info.external_attr=0o600<<16;z.writestr(info,value.encode() if isinstance(value,str) else value)

def graph(path,partial_checks=True):
    with zipfile.ZipFile(path) as z:
        assert z.testzip() is None
        if partial_checks:
            types=ET.fromstring(z.read('[Content_Types].xml'))
            defaults={n.get('Extension') for n in types if n.tag.endswith('Default')}
            overrides={n.get('PartName').lstrip('/') for n in types if n.tag.endswith('Override')}
            assert all(n=='[Content_Types].xml' or n in overrides or n.rsplit('.',1)[-1] in defaults for n in z.namelist())
            root_rel=list(ET.fromstring(z.read('_rels/.rels')));assert len(root_rel)==1 and root_rel[0].get('Target')=='word/document.xml'
        document=ET.fromstring(z.read('word/document.xml'));body=document.find(W+'body');tables=list(body.iter(W+'tbl'))
        if partial_checks:
            assert list(body)[-1].tag==W+'sectPr'
            for t in tables:
                children=[n.tag for n in t];assert children[:2]==[W+'tblPr',W+'tblGrid'];assert all(x==W+'tr' for x in children[2:])
                for tc in t.iter(W+'tc'):assert list(tc)[0].tag==W+'tcPr' and list(tc)[-1].tag==W+'p'
            # Resolve every INTERNAL relationship, including package root.
            for name in z.namelist():
                if not name.endswith('.rels'):continue
                owner='' if name=='_rels/.rels' else posixpath.dirname(posixpath.dirname(name))
                ids=[]
                for rel in ET.fromstring(z.read(name)):
                    assert rel.get('Id') not in ids;ids.append(rel.get('Id'))
                    if rel.get('TargetMode')!='External':assert posixpath.normpath(posixpath.join(owner,rel.get('Target'))) in z.namelist()
        notes=[]
        if 'word/footnotes.xml' in z.namelist():
            for n in ET.fromstring(z.read('word/footnotes.xml')):
                if n.get(W+'type','normal')=='normal':notes.append({'id':n.get(W+'id'),'text':''.join(t.text or '' for t in n.iter(W+'t'))})
        refs=[r.get(W+'id') for r in body.iter(W+'footnoteReference')];assert all(any(n['id']==r for n in notes) for r in refs)
        rels=[]
        if 'word/_rels/document.xml.rels' in z.namelist():
            rels=[[r.get('Id'),r.get('Type').split('/')[-1],r.get('Target'),r.get('TargetMode','')] for r in ET.fromstring(z.read('word/_rels/document.xml.rels'))]
        return {'bodyBlocks':[n.tag.split('}')[-1] for n in body],'bodyTextNodes':[n.text or '' for n in body.iter(W+'t')],'tables':[{'gridColumns':len(t.find(W+'tblGrid')),'rows':len(t.findall(W+'tr')),'cells':[len(r.findall(W+'tc')) for r in t.findall(W+'tr')]} for t in tables],'noteReferences':refs,'notes':notes,'relationships':sorted(rels),'media':[{'part':n,'sha256':SHA(z.read(n))} for n in sorted(z.namelist()) if n.startswith('word/media/')]}

SOURCE_SHA256 = {'whole-table-birth-before.docx': '92c3a27b8b4b621ab4e6d00661d148aec35c287acc3070ddd085ac80811c0274', 'whole-table-birth-after.docx': '14f385a26d57cdbc70172da1d44002d435e62b6fc3c8f8c5d7c77b3d066761ca', 'whole-table-death-before.docx': '14f385a26d57cdbc70172da1d44002d435e62b6fc3c8f8c5d7c77b3d066761ca', 'whole-table-death-after.docx': '92c3a27b8b4b621ab4e6d00661d148aec35c287acc3070ddd085ac80811c0274', 'zero-row-to-populated-before.docx': 'aa37b811bf74a4c2344e5344fffbaa39ac6b8d1c15e84cfd2911376f7b09a024', 'zero-row-to-populated-after.docx': '14f385a26d57cdbc70172da1d44002d435e62b6fc3c8f8c5d7c77b3d066761ca', 'rich-table-death-note-id-collision-before.docx': '4f4c6b8ec5841c866bc3e4a49ffd328305e45e15266a6acaad74cebdee0defd2', 'rich-table-death-note-id-collision-after.docx': '03b2aa20696a19dd81c5be8065acaa56b5b615fdd91c0c14503bbeea75b203b5', 'terminal-table-birth-before.docx': '62cb65e46eb1872b6b70cc1e9ac42d54267d3cf83e2726db81215eb78ff12b82', 'terminal-table-birth-after.docx': '03074fcc801e0a315df2deeab4c47ebde96f5fcb411ba1ead6c582aceade7f53'}

def fixtures(root):
    root=pathlib.Path(root);root.mkdir(parents=True,exist_ok=True);cases=[]
    for name,b,a,terminal in CASES:
        case={'name':name,'terminalOracleScope':'future all-scope accept=after/reject=before; not executed','sources':{}}
        for side,mode in [('before',b),('after',a)]:
            path=root/(name+'-'+side+'.docx');rich_case=name.startswith('rich-');package(path,mode,terminal,rich_case,side)
            assert SHA(path.read_bytes())==SOURCE_SHA256[path.name],path.name
            literal=expected(mode,terminal,rich_case,side);actual=graph(path);assert actual==literal,(name,side,actual,literal)
            case['sources'][side]={'path':str(path.resolve()),'sha256':SHA(path.read_bytes()),'expected':literal}
        cases.append(case)
    return cases

def native_sources(cases,root):
    executable=shutil.which('libreoffice') or shutil.which('soffice')
    if not executable:return {'available':False,'claims':[]}
    out=pathlib.Path(root)/'native';out.mkdir(exist_ok=True);paths=[r['path'] for c in cases for r in c['sources'].values()]
    with tempfile.TemporaryDirectory(prefix='word-whole-table-lo-') as profile:
        proc=subprocess.run([executable,'-env:UserInstallation='+pathlib.Path(profile).as_uri(),'--headless','--convert-to','pdf','--outdir',str(out),*paths],capture_output=True,text=True,timeout=60)
    (out/'convert.log').write_text(proc.stdout+proc.stderr);assert proc.returncode==0
    records=[]
    for path in paths:
        pdf=out/(pathlib.Path(path).stem+'.pdf');assert pdf.is_file() and pdf.read_bytes().startswith(b'%PDF-')
        result={'source':path,'pdf':str(pdf.resolve()),'pdfSha256':SHA(pdf.read_bytes())}
        if shutil.which('pdftotext'):
            text=subprocess.check_output(['pdftotext',str(pdf),'-'],text=True);assert 'Anchor start' in text
            result['renderedText']=text
        records.append(result)
    # Separate normalization observation: zero-row table may disappear on native save.
    zero=next(c['sources']['before']['path'] for c in cases if c['name']=='zero-row-to-populated');normalized=out/'normalized';normalized.mkdir(exist_ok=True)
    with tempfile.TemporaryDirectory(prefix='word-whole-table-save-') as profile:
        proc=subprocess.run([executable,'-env:UserInstallation='+pathlib.Path(profile).as_uri(),'--headless','--convert-to','docx','--outdir',str(normalized),zero],capture_output=True,text=True,timeout=60)
    saved=normalized/pathlib.Path(zero).name;assert proc.returncode==0 and saved.is_file()
    return {'available':True,'version':subprocess.check_output([executable,'--version'],text=True).strip(),'sourceOpensAndPdfRenders':records,'zeroRowNativeSavedGraph':graph(saved,False),'zeroRowNormalizedSha256':SHA(saved.read_bytes()),'limits':'Source opening/render only, not full XSD, MS Word, tracked producer or accept/reject proof.'}

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--out',default='/tmp/word-whole-table-fixtures');parser.add_argument('--native',action='store_true');args=parser.parse_args()
    cases=fixtures(args.out);report={'cases':cases,'generatorSha256':SHA(pathlib.Path(__file__).read_bytes()),'existingNoteHelperSha256':SHA(helper_path.read_bytes()),'validation':'partial OPC/CT_Tbl order/row/cell shape + literal raw graphs, no full XSD'}
    if args.native:report['native']=native_sources(cases,args.out)
    for c in cases:
        for src in c['sources'].values():assert SHA(pathlib.Path(src['path']).read_bytes())==src['sha256']
    path=pathlib.Path(args.out)/'manifest.json';path.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps({'pairs':len(cases),'sources':len(cases)*2,'manifest':str(path.resolve()),'manifestSha256':SHA(path.read_bytes()),'native':report.get('native',{}).get('available',False)}))
