"""Bounded source-only bookmark context/volatile ID checks."""
import copy,importlib.util,pathlib,tempfile,unittest,zipfile
import xml.etree.ElementTree as ET
ROOT=pathlib.Path(__file__).resolve().parents[1];scope={};exec(compile((ROOT/'src/features/word-compare/compare.py').read_text(),'compare.py','exec'),scope)
spec=importlib.util.spec_from_file_location('fixture',ROOT/'tests/word-future-resource-fixtures.py');fixture=importlib.util.module_from_spec(spec);spec.loader.exec_module(fixture);W=fixture.W
class BookmarkSource(unittest.TestCase):
 @classmethod
 def setUpClass(cls):
  cls.temp=tempfile.TemporaryDirectory();case=next(c for c in fixture.build_fixtures(cls.temp.name)if c['name']=='anchor-collision')
  with zipfile.ZipFile(case['before'])as z:cls.root=ET.fromstring(z.read('word/document.xml'))
 @classmethod
 def tearDownClass(cls):cls.temp.cleanup()
 def check(self,root):return scope['_stable_named_bookmark_context'](root,'word/document.xml')
 def test_fullrange_and_volatile_ids(self):
  ctx=self.check(self.root);self.assertEqual(ctx['name'],'SharedAnchor');root=copy.deepcopy(self.root);root.find('.//'+W+'bookmarkStart').set(W+'id','91');root.find('.//'+W+'bookmarkEnd').set(W+'id','91');self.assertEqual(self.check(root)['name'],ctx['name'])
 def test_partial_and_unmatched_ranges(self):
  for mode in ['partial','end-id','missing-end','extra-start-attr','free-text']:
   root=copy.deepcopy(self.root);p=root.find(W+'body/'+W+'p');start=p.find(W+'bookmarkStart');end=p.find(W+'bookmarkEnd')
   if mode=='partial':p.remove(start);p.insert(1,start)
   elif mode=='end-id':end.set(W+'id','8')
   elif mode=='missing-end':p.remove(end)
   elif mode=='extra-start-attr':start.set(W+'colFirst','0')
   else:start.tail='untyped text'
   with self.subTest(mode=mode):self.assertIsNone(self.check(root))
 def test_ambiguous_name_or_id_and_jump(self):
  for mode in ['duplicate-range','duplicate-jump','dangling-anchor']:
   root=copy.deepcopy(self.root);body=root.find(W+'body')
   if mode=='duplicate-range':body.insert(1,copy.deepcopy(body[0]))
   elif mode=='duplicate-jump':body.insert(2,copy.deepcopy(body[1]))
   else:root.find('.//'+W+'hyperlink').set(W+'anchor','Missing')
   with self.subTest(mode=mode):self.assertIsNone(self.check(root))
 def test_namespace_spoof_and_nonbody_context(self):
  for mode in ['namespace','table','formatting','external-and-anchor']:
   root=copy.deepcopy(self.root);body=root.find(W+'body');p=body[0]
   if mode=='namespace':p[0].tag='{urn:fake}bookmarkStart'
   elif mode=='table':body.remove(p);ET.SubElement(ET.SubElement(ET.SubElement(body,W+'tbl'),W+'tr'),W+'tc').append(p)
   elif mode=='formatting':ET.SubElement(p[1],W+'rPr')
   else:root.find('.//'+W+'hyperlink').set(fixture.R+'id','rLink')
   with self.subTest(mode=mode):self.assertIsNone(self.check(root))
if __name__=='__main__':unittest.main(verbosity=2)
