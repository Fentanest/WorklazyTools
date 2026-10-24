"""Reserved leaf copier/identity unit boundaries, NOT endpoint producer support."""
import copy, hashlib, importlib.util, io, json, pathlib, sys, tempfile, types, unittest, zipfile
import xml.etree.ElementTree as ET
ROOT=pathlib.Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('fixtures',ROOT/'tests/word-future-resource-fixtures.py');fixture=importlib.util.module_from_spec(spec);spec.loader.exec_module(fixture)
js=types.ModuleType('js');js.worklazyDiffJson=lambda *a:None;js.worklazyComparisonManifestJson=lambda *a:None;sys.modules['js']=js
scope={}
for name in ['compare','tracked_docx']:exec(compile((ROOT/f'src/features/word-compare/{name}.py').read_text(),name+'.py','exec'),scope)
W=fixture.W;R=fixture.R;CT='{'+fixture.CTNS+'}';PR='{'+fixture.PNS+'}'

def archive(entries):
    out=io.BytesIO()
    with zipfile.ZipFile(out,'w') as z:
        for key,value in entries.items():z.writestr(key,value)
    return out.getvalue()
def patch(entries,target=None,mime=None,data=None,nested=False):
    entries=copy.deepcopy(entries);rels=ET.fromstring(entries['word/_rels/document.xml.rels'])
    if target is not None:next(n for n in rels if n.get('Id')=='rLink').set('Target',target)
    entries['word/_rels/document.xml.rels']=ET.tostring(rels)
    if mime is not None:
        content=ET.fromstring(entries['[Content_Types].xml']);ET.SubElement(content,CT+'Override',{'PartName':'/word/target.xml','ContentType':mime});entries['[Content_Types].xml']=ET.tostring(content)
    if data is not None:entries['word/target.xml']=data
    if nested:entries['word/_rels/target.xml.rels']=fixture.relationships([]).encode()
    return entries

def event(data):
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        root=ET.fromstring(z.read('word/document.xml'));refs=scope['_source_paths'](root,'word/document.xml',z)
        return next(ref['objectEvent'] for ref in refs.values() if ref.get('objectEvent',{}).get('kind')=='hyperlink')

class LeafBoundaries(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp=tempfile.TemporaryDirectory();pairs=fixture.build_fixtures(cls.temp.name);case=next(c for c in pairs if c['name']=='internal-part-link')
        def entries(path):
            with zipfile.ZipFile(path) as z:return {n:z.read(n) for n in z.namelist()}
        cls.before=entries(case['before']);cls.after=entries(case['after'])
    @classmethod
    def tearDownClass(cls):cls.temp.cleanup()
    def copier(self,before):
        left=zipfile.ZipFile(io.BytesIO(archive(before)));right=zipfile.ZipFile(io.BytesIO(archive(self.after)))
        self.addCleanup(left.close);self.addCleanup(right.close);return scope['_PackageGraph'](left,right)
    def assert_guard(self,entries):
        data=archive(entries);self.assertFalse(event(data)['supported'])
        with self.assertRaises(ValueError):self.copier(entries).relationship('word/document.xml','rLink')
    def test_exact_copy_and_mime_collision_safe_target(self):
        graph=self.copier(self.before);rid=graph.relationship('word/document.xml','rLink');self.assertEqual(graph.relationship('word/document.xml','rLink'),rid)
        self.assertEqual(len(graph.additions),1);name,data=next(iter(graph.additions.items()));self.assertEqual(data,self.before['word/target.xml']);self.assertEqual(graph.mime(name,graph.types),'application/xml')
        self.assertNotEqual(name,'word/target.xml');self.assertNotEqual(rid,'rLink');self.assertTrue(event(archive(self.before))['supported'])
        self.assertNotEqual(event(archive(self.before))['signature'],event(archive(self.after))['signature'])
    def test_renamed_resource_and_rid_identity(self):
        changed=patch(self.before,target='../customXml/data.xml');changed['customXml/data.xml']=changed.pop('word/target.xml')
        rels=ET.fromstring(changed['word/_rels/document.xml.rels']);next(n for n in rels if n.get('Id')=='rLink').set('Id','renamed');changed['word/_rels/document.xml.rels']=ET.tostring(rels)
        doc=ET.fromstring(changed['word/document.xml']);doc.find('.//'+W+'hyperlink').set(R+'id','renamed');changed['word/document.xml']=ET.tostring(doc)
        self.assertEqual(event(archive(self.before))['signature'],event(archive(changed))['signature'])
        graph=self.copier(changed);graph.relationship('word/document.xml','renamed');self.assertEqual(next(iter(graph.additions.values())),self.before['word/target.xml'])
    def test_missing_part(self):
        changed=dict(self.before);del changed['word/target.xml'];self.assert_guard(changed)
    def test_nested_resource_graph(self):self.assert_guard(patch(self.before,nested=True))
    def test_non_xml_mime(self):self.assert_guard(patch(self.before,mime='application/octet-stream'))
    def test_story_mime(self):self.assert_guard(patch(self.before,mime='application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml'))
    def test_story_qname_disguised_as_data(self):self.assert_guard(patch(self.before,data=('<w:hdr xmlns:w="'+fixture.WNS+'"/>').encode()))
    def test_nested_reference_attribute(self):self.assert_guard(patch(self.before,data=('<data xmlns:r="'+fixture.RNS+'" r:id="owned"/>').encode()))
    def test_malformed_xml(self):self.assert_guard(patch(self.before,data=b'<bad>'))
    def test_missing_and_ambiguous_mime(self):
        for mode in ['missing','duplicate']:
            changed=dict(self.before);root=ET.fromstring(changed['[Content_Types].xml'])
            if mode=='missing':root[:]=[n for n in root if n.get('Extension')!='xml']
            else:root.append(copy.deepcopy(next(n for n in root if n.get('Extension')=='xml')))
            changed['[Content_Types].xml']=ET.tostring(root);self.assert_guard(changed)
    def test_target_uri_boundaries(self):
        for target in ['../../../outside.xml','https://example.invalid/data','target.xml#anchor','target.xml?query','target%2exml','..\\target.xml']:
            with self.subTest(target=target):self.assert_guard(patch(self.before,target=target))
    def test_unknown_target_mode_and_duplicate_relationship(self):
        for duplicate in [False,True]:
            changed=dict(self.before);root=ET.fromstring(changed['word/_rels/document.xml.rels']);rel=next(n for n in root if n.get('Id')=='rLink')
            if duplicate:root.append(copy.deepcopy(rel))
            else:rel.set('TargetMode','Other')
            changed['word/_rels/document.xml.rels']=ET.tostring(root);self.assert_guard(changed)

if __name__=='__main__':unittest.main(verbosity=2)
