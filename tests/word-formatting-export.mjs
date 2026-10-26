import assert from "node:assert/strict";
import fs from "node:fs";
import { loadPyodide } from "pyodide";
import { compareDocumentModels, diffText } from "../src/features/document-compare/documentComparison.ts";
const fixtures = JSON.parse(fs.readFileSync("tests/fixtures/document-compare/formatting-authority.json", "utf8")).fixtures;
const results = [];
globalThis.worklazyDiffJson = (a, b) => JSON.stringify(diffText(a, b));
globalThis.worklazyComparisonManifestJson = (a, b, formatting, tables, metadata) => {
  const options = { formatting, tables, metadata, trackedDocument: true, revisionAuthor: "format-test", rewriteRevisionAuthor: false };
  const result = compareDocumentModels("before", "after", JSON.parse(a), JSON.parse(b), options, "en");
  assert.deepEqual(result.manifest.options, { formatting, tables, metadata });
  results.push(result);
  return JSON.stringify(result.manifest);
};
const py = await loadPyodide();
py.globals.set("WORKLAZY_FORMATTING_POLICY_JSON", fs.readFileSync("src/features/word-compare/formatting-policy.json", "utf8"));
py.globals.set("FORMAT_FIXTURES_JSON", JSON.stringify(fixtures));
for (const name of ["compare", "accept_revisions", "tracked_docx"]) py.runPython(fs.readFileSync(`src/features/word-compare/${name}.py`, "utf8"));
py.runPython(String.raw`
def fixture(path, family, properties):
    paragraph = '<w:p>' + (properties if family == 'paragraph' else '') + '<w:r>' + (properties if family == 'run' else '') + '<w:t>Same text</w:t></w:r></w:p>'
    body = paragraph
    if family in ('table','row','cell'):
        body = '<w:tbl>' + (properties if family == 'table' else '') + '<w:tr>' + (properties if family == 'row' else '') + '<w:tc>' + (properties if family == 'cell' else '') + paragraph + '</w:tc></w:tr></w:tbl>'
    if family == 'section': body += properties
    with zipfile.ZipFile(path, 'w') as archive:
        archive.writestr('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>')
        archive.writestr('word/document.xml','<w:document xmlns:w="' + WORD_NS + '"><w:body>' + body + '</w:body></w:document>')
        if family.startswith('style-'):
            archive.writestr('word/styles.xml','<w:styles xmlns:w="' + WORD_NS + '"><w:style w:styleId="Probe"><w:name w:val="Probe"/>' + properties + '</w:style></w:styles>')
def selected(path, family):
    part = 'word/styles.xml' if family.startswith('style-') else 'word/document.xml'
    prop = {'run':'rPr','paragraph':'pPr','table':'tblPr','row':'trPr','cell':'tcPr','section':'sectPr','style-run':'rPr','style-paragraph':'pPr'}[family]
    with zipfile.ZipFile(path) as archive:
        root = ET.fromstring(archive.read(part))
        return root.find('.//' + W + prop), prop
# Independent expected property projection: exact expanded names and values,
# with only the explicit fixture toggle/history equivalences.
def canon(node):
    if node is None: return None
    name = node.tag.rsplit('}',1)[-1]
    if name.endswith('PrChange'): return None
    attributes = sorted(node.attrib.items())
    if name in {'b','i'}:
        value = node.get(W + 'val','true').lower()
        if value in {'false','off','0'}: return None
        attributes = [(key,value) for key,value in attributes if key != W + 'val']
    return (node.tag, attributes, [value for child in node if (value := canon(child)) is not None])
checks = []
for row in json.loads(FORMAT_FIXTURES_JSON):
    fixture('/before.docx',row['family'],row['beforeXml']);fixture('/after.docx',row['family'],row['afterXml'])
    generate_tracked_document('/before.docx','/after.docx','/output.docx','format-test',True,True,True)
    actual, property_name = selected('/output.docx',row['family'])
    revisions = [element for element in actual.iter() if element.tag == W + property_name + 'Change' and element.get(W + 'author') == 'format-test']
    assert bool(revisions) == row['expectAction'], (row['id'], 'declared revision count',len(revisions))
    expected_before,_ = selected('/before.docx',row['family'])
    expected_after,_ = selected('/after.docx',row['family'])
    rejected = revisions[0][0] if revisions else actual
    assert canon(rejected) == canon(expected_before), (row['id'],'reject properties')
    accept_tracked_document('/output.docx','/accepted.docx')
    accepted,_ = selected('/accepted.docx',row['family'])
    assert canon(accepted) == canon(expected_after), (row['id'],'accept properties')
    checks.append(row['id'])
# Removing a supplied action or canonical fact never triggers repair/recomparison.
fixture('/before.docx','section','<w:sectPr><w:pgMar w:top="1440"/></w:sectPr>')
fixture('/after.docx','section','<w:sectPr><w:pgMar w:top="720"/></w:sectPr>')
a=extract_document_model(open('/before.docx','rb').read(),True,True,'en');b=extract_document_model(open('/after.docx','rb').read(),True,True,'en')
value=json.loads(worklazyComparisonManifestJson(a,b,True,True,True))
generate_tracked_document('/before.docx','/after.docx','/explicit.docx','format-test',True,True,True,json.dumps(value))
checks.append('explicit-worker-shaped-manifest')
for mutation in ('missing-action','forged-fact','missing-scope'):
    corrupt=copy.deepcopy(value)
    if mutation == 'missing-action': corrupt['propertyActions']=[]
    if mutation == 'forged-fact': corrupt['formattingScopes'][-1]['beforeFact']['supported']={}
    if mutation == 'missing-scope': corrupt['formattingScopes']=corrupt['formattingScopes'][:-1]
    try:
        generate_tracked_document('/before.docx','/after.docx','/bad.docx','format-test',True,True,True,json.dumps(corrupt))
        raise AssertionError(mutation + ' accepted')
    except ValueError as error:
        assert 'COMPARISON_MANIFEST' in str(error)
    checks.append(mutation)

# Paired run scopes and their declared spans are complete, even for equal facts.
fixture('/before.docx','run','<w:rPr><w:sz w:val="20"/></w:rPr>')
fixture('/after.docx','run','<w:rPr><w:sz w:val="40"/></w:rPr>')
a=extract_document_model(open('/before.docx','rb').read(),True,True,'en');b=extract_document_model(open('/after.docx','rb').read(),True,True,'en')
value=json.loads(worklazyComparisonManifestJson(a,b,True,True,True))
for mutation in ('missing-run-span','missing-equal-scope','duplicate-scope'):
    corrupt=copy.deepcopy(value)
    if mutation == 'missing-run-span': corrupt['decisions'][0]['comparisons'][0]['formatting']['spans']=[]
    if mutation == 'missing-equal-scope': corrupt['formattingScopes']=[scope for scope in corrupt['formattingScopes'] if scope.get('comparisonId') is not None]
    if mutation == 'duplicate-scope': corrupt['formattingScopes'].append(copy.deepcopy(corrupt['formattingScopes'][0]))
    try:
        generate_tracked_document('/before.docx','/after.docx','/bad.docx','format-test',True,True,True,json.dumps(corrupt))
        raise AssertionError(mutation + ' accepted')
    except ValueError as error: assert 'COMPARISON_MANIFEST' in str(error)
    checks.append(mutation)
# The before supported property is restored while an excluded unknown property retains after.
fixture('/before.docx','run','<w:rPr><w:sz w:val="20"/><w:lang w:val="ko-KR"/></w:rPr>')
fixture('/after.docx','run','<w:rPr><w:sz w:val="40"/><w:lang w:val="en-US"/></w:rPr>')
generate_tracked_document('/before.docx','/after.docx','/output.docx','format-test',True,True,True)
actual,_=selected('/output.docx','run');previous=actual.find(W+'rPrChange')[0]
assert previous.find(W+'sz').get(W+'val')=='20' and previous.find(W+'lang').get(W+'val')=='en-US'
checks.append('supported-before-excluded-after')
fixture('/before.docx','paragraph','<w:pPr xmlns:x="urn:opaque-format" x:flag="before"><w:jc w:val="left"/></w:pPr>')
fixture('/after.docx','paragraph','<w:pPr xmlns:x="urn:opaque-format" x:flag="after"><w:jc w:val="left"/></w:pPr>')
generate_tracked_document('/before.docx','/after.docx','/output.docx','format-test',True,True,True)
actual,_=selected('/output.docx','paragraph')
assert actual.get('{urn:opaque-format}flag')=='after' and actual.find(W+'pPrChange') is None
checks.append('unknown-root-attribute-preserved')

def sized_runs(rows):
    return ''.join('<w:r><w:rPr><w:sz w:val="' + str(size) + '"/></w:rPr><w:t xml:space="preserve">' + text + '</w:t></w:r>' for text,size in rows)
def run_fixture(path, rows):
    with zipfile.ZipFile(path, 'w') as archive:
        archive.writestr('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>')
        archive.writestr('word/document.xml','<w:document xmlns:w="' + WORD_NS + '"><w:body><w:p>' + sized_runs(rows) + '</w:p></w:body></w:document>')
def styled_characters(path, reject):
    with zipfile.ZipFile(path) as archive: root=ET.fromstring(archive.read('word/document.xml'))
    result=[]
    def visit(node):
        if reject and node.tag == W+'ins' and node.get(W+'author')=='format-test': return
        if not reject and node.tag == W+'del': return
        if node.tag == W+'r':
            properties=node.find(W+'rPr')
            change=properties.find(W+'rPrChange') if properties is not None else None
            if reject and change is not None and change.get(W+'author')=='format-test': properties=change[0]
            size=properties.find(W+'sz') if properties is not None else None
            value=size.get(W+'val') if size is not None else None
            for child in node:
                if child.tag in (W+'t',W+'delText'): result.extend((char,value) for char in child.text or '')
            return
        if node.tag not in {W+'pPr',W+'rPr'}:
            for child in node: visit(child)
    visit(root)
    return result
for case,before_runs,after_runs in [
    ('unequal-before-runs-merged-after',[('A',20),('B',30)],[('AB',40)]),
    ('before-run-split-after',[('AB',40)],[('A',20),('B',30)]),
    ('property-scopes-across-text-equals',[('A ',20),('old',30),(' B',50)],[('A new B',40)]),
]:
    run_fixture('/before.docx',before_runs);run_fixture('/after.docx',after_runs)
    generate_tracked_document('/before.docx','/after.docx','/output.docx','format-test',True,True,True)
    expected_before=[(character,str(size)) for text,size in before_runs for character in text]
    expected_after=[(character,str(size)) for text,size in after_runs for character in text]
    assert styled_characters('/output.docx',True)==expected_before,(case,'reject run boundaries',styled_characters('/output.docx',True))
    assert styled_characters('/output.docx',False)==expected_after,(case,'accept run boundaries')
    checks.append(case)
`);
const checks = py.globals.get("checks").toJs();
assert.equal(checks.length, 33);
for (const [index, fixture] of fixtures.entries()) {
  assert.equal(results[index].summary.format > 0, fixture.expectAction, `${fixture.id} screen formatting`);
  if (fixture.expectAction) assert([...results[index].views.document, ...results[index].views.headerFooter].some((view) => view.formattingLabels?.length), `${fixture.id} descriptive labels`);
}
console.log(JSON.stringify({ checks: checks.length, sourceFixtures: fixtures.length, acceptRejectPropertyProjection: true, forgedOrMissingActionsRejected: true }));
