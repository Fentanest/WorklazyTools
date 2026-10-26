"""Simple PNG pict source boundaries; tests execute current extraction/copy code."""
import copy,importlib.util,io,pathlib,sys,tempfile,types,unittest,zipfile
import xml.etree.ElementTree as ET
ROOT=pathlib.Path(__file__).resolve().parents[1];spec=importlib.util.spec_from_file_location('fixture',ROOT/'tests/word-future-resource-fixtures.py');fixture=importlib.util.module_from_spec(spec);spec.loader.exec_module(fixture)
js=types.ModuleType('js');js.worklazyDiffJson=lambda*a:None;js.worklazyComparisonManifestJson=lambda*a:None;sys.modules['js']=js
scope={}
for name in ['compare','tracked_docx']:exec(compile((ROOT/f'src/features/word-compare/{name}.py').read_text(),name+'.py','exec'),scope)
W=fixture.W;R=fixture.R;V=fixture.V;O='{urn:schemas-microsoft-com:office:office}';CT='{'+fixture.CTNS+'}'
def archive(entries):
 out=io.BytesIO()
 with zipfile.ZipFile(out,'w') as z:
  for name,data in entries.items():z.writestr(name,data)
 return out.getvalue()
def event(entries):
 with zipfile.ZipFile(io.BytesIO(archive(entries))) as z:
  root=ET.fromstring(z.read('word/document.xml'));refs=scope['_source_paths'](root,'word/document.xml',z)
  return next(ref['objectEvent'] for ref in refs.values() if ref.get('objectEvent',{}).get('kind')=='drawing')
def modify(entries,fn):
 value=copy.deepcopy(entries);root=ET.fromstring(value['word/document.xml']);fn(root.find('.//'+W+'pict'));value['word/document.xml']=ET.tostring(root);return value
class VmlBoundaries(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.temp=tempfile.TemporaryDirectory();case=next(c for c in fixture.build_fixtures(cls.temp.name) if c['name']=='vml-body')
  def entries(path):
   with zipfile.ZipFile(path) as z:return {n:z.read(n) for n in z.namelist()}
  cls.before=entries(case['before']);cls.after=entries(case['after'])
 @classmethod
 def tearDownClass(cls):cls.temp.cleanup()
 def copier(self,entries):
  left=zipfile.ZipFile(io.BytesIO(archive(entries)));right=zipfile.ZipFile(io.BytesIO(archive(self.after)));self.addCleanup(left.close);self.addCleanup(right.close);return scope['_PackageGraph'](left,right)
 def assert_guard(self,entries):
  self.assertFalse(event(entries)['supported']);root=ET.fromstring(entries['word/document.xml'])
  with self.assertRaisesRegex(ValueError,'VML_PICTURE'):self.copier(entries).copy(root.find('.//'+W+'pict'),'word/document.xml')
 def test_volatile_ids_aliases_and_copy_reservation(self):
  original=event(self.before);self.assertTrue(original['supported']);changed=modify(self.before,lambda p:(p[0].set('id','DifferentType'),p[1].set('id','DifferentShape'),p[1].set('type','#DifferentType')))
  self.assertEqual(original['signature'],event(changed)['signature'])
  changed['word/document.xml']=changed['word/document.xml'].replace(b'ns2:',b'alias:').replace(b'xmlns:ns2=',b'xmlns:alias=');self.assertEqual(original['signature'],event(changed)['signature'])
  graph=self.copier(self.before);node=ET.fromstring(self.before['word/document.xml']).find('.//'+W+'pict');first=graph.copy(node,'word/document.xml');second=graph.copy(node,'word/document.xml');ids=[n.get('id') for p in (first,second) for n in p if n.tag in {V+'shape',V+'shapetype'}];self.assertEqual(len(set(ids)),4)
  self.assertTrue(all(n not in {'_x0000_t75','_x0000_i1025'} for n in ids));self.assertEqual(first[1].get('type'),'#'+first[0].get('id'));self.assertEqual(second[1].get('type'),'#'+second[0].get('id'))
 def test_complex_shapes_and_attributes(self):
  changes=[lambda p:ET.SubElement(p[1],V+'textbox'),lambda p:ET.SubElement(p[1],O+'OLEObject'),lambda p:p[1].set('href','https://example.invalid/'),lambda p:p[0].set(O+'spt','202'),lambda p:p[1].set('type','#Missing'),lambda p:p.set('unsafe','1'),lambda p:p[1][0].set(R+'href','image.png'),lambda p:p[1][0].set('src','https://example.invalid/image'),lambda p:ET.SubElement(p[1],V+'imagedata')]
  for i,change in enumerate(changes):
   with self.subTest(i=i):self.assert_guard(modify(self.before,change))
 def test_unsafe_styles(self):
  for style in ['width:72pt;height:72pt;position:absolute','width:0pt;height:72pt','width:NaNpt;height:72pt','width:72px;height:72pt','width:72pt;width:72pt;height:72pt','width:72pt']:
   with self.subTest(style=style):self.assert_guard(modify(self.before,lambda p:p[1].set('style',style)))
 def test_namespace_spoof(self):self.assert_guard(modify(self.before,lambda p:setattr(p[1],'tag','{urn:fake}shape')))
 def test_duplicate_ids(self):
  changed=dict(self.before);root=ET.fromstring(changed['word/document.xml']);root.find(W+'body').insert(1,copy.deepcopy(root.find('.//'+W+'p')));changed['word/document.xml']=ET.tostring(root);self.assert_guard(changed)
 def test_illegal_parent(self):
  changed=dict(self.before);root=ET.fromstring(changed['word/document.xml']);paragraph=root.find('.//'+W+'p');run=paragraph.find(W+'r');picture=root.find('.//'+W+'pict');run=next(r for r in paragraph if picture in list(r));run.remove(picture);paragraph.append(picture);changed['word/document.xml']=ET.tostring(root);self.assert_guard(changed)
 def test_relationship_guards(self):
  for mode in ['missing','duplicate','external','wrong-type','nested','mime','fake-png']:
   changed=copy.deepcopy(self.before);root=ET.fromstring(changed['word/_rels/document.xml.rels']);image=next(r for r in root if r.get('Id')=='rImage')
   if mode=='missing':del changed['word/media/image1.png']
   elif mode=='duplicate':root.append(copy.deepcopy(image))
   elif mode=='external':image.set('TargetMode','External')
   elif mode=='wrong-type':image.set('Type',fixture.RNS+'/hyperlink')
   elif mode=='nested':changed['word/media/_rels/image1.png.rels']=fixture.relationships([]).encode()
   elif mode=='mime':
    content=ET.fromstring(changed['[Content_Types].xml']);next(n for n in content if n.get('Extension')=='png').set('ContentType','application/xml');changed['[Content_Types].xml']=ET.tostring(content)
   elif mode=='fake-png':changed['word/media/image1.png']=b'<fixture/>'
   changed['word/_rels/document.xml.rels']=ET.tostring(root)
   with self.subTest(mode=mode):self.assert_guard(changed)
if __name__=='__main__':unittest.main(verbosity=2)
