"""Independent ZIP/XML output contract reader; only synthetic evidence directories."""
import sys,json,zipfile,io,xml.etree.ElementTree as E
from pathlib import Path
p=Path(sys.argv[1]);mutant=sys.argv[2] if len(sys.argv)>2 else ''
summary=json.loads((p/'summary.json').read_text());items=summary['output'];w='{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
if mutant=='partial-drop':items=items[:-1]
assert len(items)==6,'six committed source rows must survive'
with zipfile.ZipFile(p/'template.docx') as template:
 for i,item in enumerate(items):
  file=p/item['name'];data=file.read_bytes()
  if mutant=='row-swap' and i==0:data=(p/items[1]['name']).read_bytes()
  with zipfile.ZipFile(io.BytesIO(data)) as doc:
   assert doc.testzip() is None
   assert {n for n in doc.namelist() if not n.endswith('/')}=={n for n in template.namelist() if not n.endswith('/')}
   for name in template.namelist():
    if name.endswith(('.xml','.rels')):E.fromstring(doc.read(name))
    if name not in ['word/document.xml','word/header1.xml','word/footer1.xml']:assert template.read(name)==doc.read(name),name
   filePrefix=item['sourceFile'].split('.')[0];row=item['row'];suffix={3:'-Second-1',4:'-Second-2',7:'-CACHED'}[row];value={3:'#N/A',4:'2026-09-13',7:'3'}[row];code={3:'000123',4:'TWO',7:'OK'}[row]
   root=E.fromstring(doc.read('word/document.xml'));text=[''.join(n.text or '' for n in q.iter(w+'t')) for q in root.iter(w+'p')]
   assert text[:4]==[filePrefix+suffix,'Body '+value,'Empty[]','Code '+code],(item,text)
   assert 'Table '+filePrefix+suffix in text
   assert len(list(root.iter(w+'drawing')))==1
   assert ''.join(n.text or '' for n in E.fromstring(doc.read('word/header1.xml')).iter(w+'t'))=='Header '+filePrefix+suffix
zipBytes=(p/'results.zip').read_bytes()
if mutant=='zip-truncate':zipBytes=zipBytes[:100]
with zipfile.ZipFile(io.BytesIO(zipBytes)) as archive:
 assert archive.testzip() is None
 assert set(archive.namelist())=={item['name'] for item in items}
 for item in items:assert archive.read(item['name'])==(p/item['name']).read_bytes()
with zipfile.ZipFile(p/'manifest.xlsx') as archive:
 for name in archive.namelist():
  if name.endswith('.xml'):E.fromstring(archive.read(name))
print(json.dumps({'docx':6,'unchangedPartsAndNamespaceXML':True,'ZIPEntriesByteExact':6,'mutant':mutant or None}))
