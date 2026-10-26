// Fixture-only staging gate. Unsupported remains PENDING, never a feature pass.
// WORD_RESOURCE_FUTURE_STRICT=1 requires production accept + independent rejection
// to match literal source graphs; it deliberately fails on today's guards.
import fs from'node:fs';import path from'node:path';import{execFileSync}from'node:child_process';import{createHash}from'node:crypto';import{loadPyodide}from'pyodide';
import{compareDocumentModels,diffText}from'../src/features/document-compare/documentComparison.ts';
const directory=process.env.WORD_RESOURCE_FIXTURE_DIR??'docs/jobs/todo/diffchecker-port-20261023/word-future-resources';fs.mkdirSync(directory,{recursive:true});
const cases=JSON.parse(execFileSync('python3',['tests/word-future-resource-fixtures.py',directory],{encoding:'utf8'}));fs.writeFileSync(path.join(directory,'source-manifest.json'),JSON.stringify(cases,null,2));
let requested;globalThis.worklazyDrawingMask=json=>{requested=JSON.parse(json)};globalThis.worklazyDiffJson=(a,b)=>JSON.stringify(diffText(a,b));globalThis.worklazyComparisonManifestJson=(a,b,formatting,tables,metadata)=>JSON.stringify(compareDocumentModels('before','after',JSON.parse(a),JSON.parse(b),{formatting,tables,metadata,formattingMask:requested},'en').manifest);
const py=await loadPyodide();py.globals.set('WORKLAZY_FORMATTING_POLICY_JSON',fs.readFileSync('src/features/word-compare/formatting-policy.json','utf8'));for(const name of['compare','accept_revisions','tracked_docx'])py.runPython(fs.readFileSync(`src/features/word-compare/${name}.py`,'utf8'));
const harness=fs.readFileSync('tests/word-package-events.mjs','utf8');py.runPython(harness.slice(harness.indexOf('registry=dict(ET._namespace_map)'),harness.indexOf('checks=[]')));py.runPython(fs.readFileSync('tests/word-future-resource-fixtures.py','utf8').replace("if __name__=='__main__':","if False:"));
py.FS.mkdirTree('/resource-fixtures');const fixed=cases.map(c=>{const value={...c};for(const side of['before','after']){const data=fs.readFileSync(c[side]);if(createHash('sha256').update(data).digest('hex')!==c.sources[side].sha256)throw Error('source-byte mismatch');value[side]=`/resource-fixtures/${c.name}-${side}.docx`;py.FS.writeFile(value[side],data);}return value;});py.globals.set('RESOURCE_CASES_JSON',JSON.stringify(fixed));
const results=JSON.parse(py.runPython(String.raw`
RESOURCE_CASES=json.loads(RESOURCE_CASES_JSON)
import traceback
results=[]
for case in RESOURCE_CASES:
 assert validate_source(case['before']) and validate_source(case['after'])
 assert reachable(case['before'])==case['expectedRejectGraph']
 assert reachable(case['after'])==case['expectedAcceptGraph']
 stem='/resource-fixtures/'+case['name'];output=stem+'-tracked.docx';accepted_path=stem+'-accepted.docx';rejected_path=stem+'-rejected.docx'
 item={'name':case['name'],'sourceInvariantChecks':'passed','expectedFeatureState':'pending implementation','specUnknown':case['specUnknown'],'beforeSHA256':digest(open(case['before'],'rb').read()),'afterSHA256':digest(open(case['after'],'rb').read())}
 try:
  generate_tracked_document(case['before'],case['after'],output,'events',False,True,True)
 except Exception as error:
  item.update({'producerOutcome':'guarded-pending','guard':str(error),'featurePass':False})
 else:
  try:
   item['stage']='tracked invariants';validate_source(output)
   item['stage']='accept';accept_tracked_document(output,accepted_path)
   item['stage']='independent reject'
   with zipfile.ZipFile(output)as source,zipfile.ZipFile(rejected_path,'w')as out:
    for entry in source.infolist():
     data=source.read(entry.filename)
     if entry.filename.endswith('.xml')and entry.filename!='[Content_Types].xml':
      root=ET.fromstring(data)
      if root.tag.startswith(W):data=ET.tostring(reject(root)[0],encoding='utf-8',xml_declaration=True)
     out.writestr(entry,data)
   item['stage']='graph comparison';accepted=reachable(accepted_path);rejected=reachable(rejected_path)
   item['acceptedGraph']=accepted;item['rejectedGraph']=rejected
   assert accepted==case['expectedAcceptGraph'],('accept graph differs',accepted,case['expectedAcceptGraph'])
   assert rejected==case['expectedRejectGraph'],('reject graph differs',rejected,case['expectedRejectGraph'])
   validate_source(accepted_path);validate_source(rejected_path)
   item.update({'producerOutcome':'graphs-match','featurePass':not case['specUnknown']})
  except Exception as error:item.update({'producerOutcome':'oracle-failed-pending','oracleFailure':str(error),'traceback':traceback.format_exc(),'featurePass':False})
 item['artifacts']=[f for f in [output,accepted_path,rejected_path]if os.path.exists(f)]
 results.append(item)
json.dumps(results)
`));
for(const result of results)for(const artifact of result.artifacts??[])fs.writeFileSync(path.join(directory,path.basename(artifact)),py.FS.readFile(artifact));
const sourcePaths=['tests/word-future-resource-packages.mjs','tests/word-future-resource-fixtures.py','tests/word-package-events.mjs','src/features/word-compare/compare.py','src/features/word-compare/accept_revisions.py','src/features/word-compare/tracked_docx.py','src/features/word-compare/formatting-policy.json','src/features/document-compare/documentComparison.ts'];
const sourceHashes=Object.fromEntries(sourcePaths.map(filename=>[filename,createHash('sha256').update(fs.readFileSync(filename)).digest('hex')]));
const candidate=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const workingTreeStatus=execFileSync('git',['status','--porcelain','--untracked-files=no'],{encoding:'utf8'}).trim();
const report={candidate,sourceHashes,workingTreeStatus,scope:'Fixture-only future-resource readiness. Guarded baselines are PENDING, not producer passes. No new comparator/producer code.',fixturePairsValidated:cases.length,primaryPairs:cases.filter(c=>!c.specUnknown).length,diagnosticSpecUnknownPairs:cases.filter(c=>c.specUnknown).length,results,limitations:['Primary namespace/OPC/reference/bookmark/VML identity/table block invariants checked; no full XSD/native Word conformance claim.','Existing independent events reject oracle reused unchanged; future row/cell revision markers may require owner extension of that oracle. No new output comparator added.','Own image-part.rels fixture is OPC-structural diagnostic, native/OOXML semantic meaning explicitly unverified; not an enabled feature expectation.']};
fs.writeFileSync(path.join(directory,'baseline-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
if(process.env.WORD_RESOURCE_FUTURE_STRICT==='1'&&results.some(r=>!r.specUnknown&&!r.featurePass))process.exitCode=1;
