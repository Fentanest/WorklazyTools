// Deliberately strict future-feature regressions: unsupported is recorded as failure.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {loadPyodide} from 'pyodide';
import {compareDocumentModels,diffText} from '../src/features/document-compare/documentComparison.ts';
let requested;
globalThis.worklazyDrawingMask=json=>{requested=JSON.parse(json)};
globalThis.worklazyDiffJson=(a,b)=>JSON.stringify(diffText(a,b));
globalThis.worklazyComparisonManifestJson=(a,b,formatting,tables,metadata)=>JSON.stringify(compareDocumentModels('before','after',JSON.parse(a),JSON.parse(b),{formatting,tables,metadata,formattingMask:requested},'en').manifest);
const py=await loadPyodide();
py.globals.set('WORKLAZY_FORMATTING_POLICY_JSON',fs.readFileSync('src/features/word-compare/formatting-policy.json','utf8'));
for(const name of ['compare','accept_revisions','tracked_docx'])py.runPython(fs.readFileSync(`src/features/word-compare/${name}.py`,'utf8'));
py.runPython(fs.readFileSync('tests/word-note-fixtures.py','utf8').replace("if __name__=='__main__':","if False:"));
const results=JSON.parse(py.runPython(`
results=[]
for case in validate_fixtures():
 try:
  generate_tracked_document(case['before'],case['after'],'/note-output.docx','notes',False,True,True)
  if case.get('comments'):
   with zipfile.ZipFile('/note-output.docx') as out,zipfile.ZipFile(case['after']) as after:
    assert ('word/comments.xml' in out.namelist())==('word/comments.xml' in after.namelist())
    if 'word/comments.xml' in after.namelist():assert out.read('word/comments.xml')==after.read('word/comments.xml')
    root=ET.fromstring(out.read('word/document.xml'))
    assert not any(n.get(W+'id')=='4' for n in root.iter() if n.tag in [W+'commentReference',W+'commentRangeStart',W+'commentRangeEnd']), 'Old anchor aliases revised comment'
  if case['invalid']:raise AssertionError('Malformed ordinary IDs were accepted')
  accept_tracked_document('/note-output.docx','/note-accepted.docx')
  assert reachable('/note-accepted.docx',case['kind'])==expected(case,'after')
  # Independent author-scoped rejection. Paragraph boundary fixtures are separate;
  # these note inputs have one text run per note and stable body paragraphs.
  def reject_note(n):
   if n.tag==W+'ins' and n.get(W+'author')=='notes':return []
   children=[v for c in n for v in reject_note(c)];n[:]=children
   if n.tag==W+'del' and n.get(W+'author')=='notes':return children
   if n.tag==W+'delText':n.tag=W+'t'
   return [n]
  with zipfile.ZipFile('/note-output.docx') as source,zipfile.ZipFile('/note-rejected.docx','w') as output:
   for entry in source.infolist():
    data=source.read(entry.filename)
    if entry.filename in ['word/document.xml','word/footnotes.xml','word/endnotes.xml']:data=ET.tostring(reject_note(ET.fromstring(data))[0])
    output.writestr(entry,data)
  assert reachable('/note-rejected.docx',case['kind'])==expected(case,'before')
  results.append({'name':case['name'],'status':'pass'})
 except Exception as error:
  if case['invalid'] and isinstance(error,ValueError):results.append({'name':case['name'],'status':'pass','rejection':str(error)})
  else:results.append({'name':case['name'],'status':'fail','error':str(error)})
json.dumps(results)
`));
console.log(JSON.stringify(results,null,2));
assert.equal(results.filter(r=>r.status==='fail').length,0,'Required note graph behavior is not implemented');
