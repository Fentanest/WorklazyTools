import test from 'node:test';
import assert from 'node:assert/strict';
import PizZip from 'pizzip';
import ExcelJS from 'exceljs';
import { generatorTemplate, generatorWorkbook } from '../helpers/document-generator-fixtures.mjs';
import { inspectGeneratorTemplate, renderGeneratorDocument } from '../../src/features/document-generator/template.ts';
import { parseGeneratorData } from '../../src/features/document-generator/input.ts';
import { mapGeneratorRows } from '../../src/features/document-generator/mapping.ts';
import { assignGeneratorNames } from '../../src/features/document-generator/names.ts';
import { GeneratorError, checkAbort } from '../../src/features/document-generator/errors.ts';
import { createDocumentGeneratorClient } from '../../src/features/document-generator/client.ts';
import { assertGeneratorMemoryCapacity, GENERATOR_MEMORY_LIMIT, createGeneratorMemoryStorage, createGeneratorStorage } from '../../src/features/document-generator/storage.ts';
import { createIncrementalZipArchiveWriter } from '../../src/utils/zipArchive.ts';
import type { GeneratorWorkerBridge } from '../../src/features/document-generator/workerClient.ts';
import type { GeneratorRow, GeneratorSource } from '../../src/features/document-generator/types.ts';

const row = (name = 'one', index = 1): GeneratorRow => ({id: `row-${index}`, sourceId: 'a', sourceFile: 'a.xlsx', sheet: 'S', row: index, values: {name, value:'<&> 😀 e\u0301 {name}', code:'000123', empty:''}});
const input = new File([generatorTemplate()], 'template.docx');
const ab = (bytes: Uint8Array) => bytes.slice().buffer as ArrayBuffer;
function bridge(): GeneratorWorkerBridge {
  return {terminate() {}, async request(request, signal) {
    checkAbort(signal);
    if (request.type === 'inspect') return {id:1,type:'inspect',variables:inspectGeneratorTemplate(new Uint8Array(request.buffer))};
    if (request.type === 'parse') return {id:1,type:'parse',book:await parseGeneratorData(request.fileName,request.buffer)};
    return {id:1,type:'render',buffer:ab(renderGeneratorDocument(new Uint8Array(request.buffer),request.values))};
  }};
}
async function sources(): Promise<GeneratorSource[]> {
  return Promise.all(['A','B'].map(async id=>({id,fileName:id+'.xlsx',book:await parseGeneratorData(id+'.xlsx',ab(await generatorWorkbook(id)))})));
}
function deferred() { let resolve!:()=>void;const promise=new Promise<void>(r=>{resolve=r;});return {promise,resolve}; }
async function until(test:()=>boolean) { for(let i=0;i<1000;i++){if(test())return;await new Promise(r=>setTimeout(r,1));}throw Error('timeout'); }

test('actual C1 two files/two sheets retain coordinates, literal/errors/cache/display values', async()=>{
  const inputs=await sources();
  for(const sheet of ['First','Second']) {
    const mapped=mapGeneratorRows(inputs.map(source=>({source,sheetName:sheet,headerRow:2})),['name','value','code','empty']);
    assert.equal(mapped.length,10);assert.equal(mapped[0].row,3);assert.equal(mapped[0].values.value,'#N/A');assert.equal(mapped[0].values.code,'000123');assert.equal(mapped[0].values.empty,'');
    assert.equal(mapped[1].values.value,'2026-09-13');assert.equal(mapped[2].error,'CELL_ERROR');assert.equal(mapped[3].error,'MISSING_CACHE');assert.equal(mapped[4].values.value,'3');assert.equal(mapped[5].sourceFile,'B.xlsx');assert.equal(mapped[5].sheet,sheet);
  }
  const csv=await parseGeneratorData('sample.csv',new TextEncoder().encode('name,value,code,empty\nCSV,"literal #N/A",00001,\n').buffer);
  assert.equal(mapGeneratorRows([{source:{id:'csv',fileName:'sample.csv',book:csv},sheetName:csv.sheets[0].name,headerRow:1}],['name'])[0].values.code,'00001');
  const zip=new PizZip(await generatorWorkbook());zip.file('[Content_Types].xml',zip.file('[Content_Types].xml')!.asText().replace('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml','application/vnd.ms-excel.sheet.macroEnabled.main+xml'));
  await assert.rejects(parseGeneratorData('disguised.xlsx',ab(zip.generate({type:'uint8array'}))),{code:'UNSUPPORTED_DATA'});
});

test('headers require explicit physical aliases for duplicate and empty names',async()=>{
  const book=await parseGeneratorData('a.csv',new TextEncoder().encode('x,x,\n1,2,3\n').buffer);const source={id:'a',fileName:'a.csv',book};const base={source,sheetName:book.sheets[0].name,headerRow:1};
  assert.throws(()=>mapGeneratorRows([base],['x']),{code:'INVALID_ALIAS'});
  const mapped=mapGeneratorRows([{...base,aliases:{1:'first',2:'second',3:'third'}}],['first','third']);assert.equal(mapped[0].values.third,'3');assert.equal(mapped[0].values.first,'1');
  assert.throws(()=>mapGeneratorRows([{...base,aliases:{1:'same',2:'same',3:'third'}}],[]),{code:'INVALID_ALIAS'});
  assert.throws(()=>mapGeneratorRows([{...base,aliases:{1:'first',2:'second',3:'third'}}],['missing']),{code:'MISSING_MAPPING'});
});

test('single-pass names, whole-run collisions and full suffix/byte boundaries',()=>{
  assert.equal(assignGeneratorNames([row('{other}')],'{name}')[0].fileName,'{other}.docx');
  assert.equal(assignGeneratorNames([row()],'{file}-{row}.docx')[0].fileName,'a-1.docx');
  for(const name of ['a.pdf','a.docx.docx','../x','CON','x/'.repeat(2)])assert.throws(()=>assignGeneratorNames([row(name)],'{name}'));
  assert.equal(new TextEncoder().encode(assignGeneratorNames([row('a'.repeat(250))],'{name}')[0].fileName).length,255);
  assert.throws(()=>assignGeneratorNames([row('a'.repeat(251))],'{name}'),{code:'INVALID_NAME'});
  for(const pair of [['Same','same'],['é','e\u0301']])assert.throws(()=>assignGeneratorNames([row(pair[0]),row('middle',2),{...row(pair[1],3),sourceId:'b',sourceFile:'b.xlsx'}],'{name}'),(error:GeneratorError)=>error.code==='NAME_COLLISION'&&error.origins?.[0].row===1&&error.origins?.[1].row===3);
});

test('template output preserves parts, split runs and scalar literals, rejects own/prototype/control violations',()=>{
  const bytes=generatorTemplate();assert.deepEqual(new Set(inspectGeneratorTemplate(bytes)),new Set(['name','code','value','empty']));
  const first=new PizZip(renderGeneratorDocument(bytes,row().values));const second=new PizZip(renderGeneratorDocument(bytes,row('TWO').values));
  assert.ok(first.file('word/document.xml')!.asText().includes('&lt;&amp;&gt;'));assert.ok(second.file('word/header1.xml')!.asText().includes('Header TWO'));
  for(const name of ['word/styles.xml','word/media/image1.png','word/_rels/document.xml.rels'])assert.deepEqual(first.file(name)!.asUint8Array(),new PizZip(bytes).file(name)!.asUint8Array());
  assert.throws(()=>renderGeneratorDocument(bytes,Object.assign(Object.create({name:'INHERITED'}),{value:'v',code:'c',empty:''})),{code:'MISSING_MAPPING'});
  for(const value of ['\0','\u000b','\ud800'])assert.throws(()=>renderGeneratorDocument(bytes,{...row().values,value}),{code:'INVALID_VALUE'});
});

test('custom related parts, equivalent prefixes and invalid part namespaces retain repaired boundaries',()=>{
  const zip=new PizZip(generatorTemplate());for(const kind of ['header','footer']){const old=`${kind}1.xml`,name=`custom-${kind}.xml`;zip.file('word/'+name,zip.file('word/'+old)!.asText());zip.remove('word/'+old);for(const part of ['[Content_Types].xml','word/_rels/document.xml.rels'])zip.file(part,zip.file(part)!.asText().replace(old,name));}
  assert.ok(new PizZip(renderGeneratorDocument(zip.generate({type:'uint8array'}),row().values)).file('word/custom-header.xml')!.asText().includes('Header one'));
  zip.file('word/custom-header.xml',zip.file('word/custom-header.xml')!.asText().replace('{name}','{#name}LOOP{/name}'));assert.throws(()=>inspectGeneratorTemplate(zip.generate({type:'uint8array'})));
  for(const namespace of ['http://schemas.openxmlformats.org/wordprocessingml/2006/main','urn:wrong']){const z=new PizZip(generatorTemplate());z.file('word/document.xml',z.file('word/document.xml')!.asText().replaceAll('w:','x:').replaceAll('xmlns:w=','xmlns:x=').replace('http://schemas.openxmlformats.org/wordprocessingml/2006/main',namespace));if(namespace==='urn:wrong')assert.throws(()=>inspectGeneratorTemplate(z.generate({type:'uint8array'})));else assert.ok(renderGeneratorDocument(z.generate({type:'uint8array'}),row().values));}
});

test('memory exact limit is allowed and +1 rejected before registration; OPFS startup failures fall back',async()=>{
  assert.doesNotThrow(()=>assertGeneratorMemoryCapacity(0,GENERATOR_MEMORY_LIMIT));assert.throws(()=>assertGeneratorMemoryCapacity(GENERATOR_MEMORY_LIMIT,1),{code:'STORAGE_LIMIT'});
  for(const platform of [{},{getDirectory:async()=>{throw Error('no')}}])assert.equal((await createGeneratorStorage(platform)).kind,'memory');
});

test('first commit retirement waits for acknowledgement; failed/canceled reruns preserve previous outputs',async()=>{
  const stores:ReturnType<typeof createGeneratorMemoryStorage>[]=[];let delay=false;let fail=false;let entered=false;let gate=deferred();
  const client=createDocumentGeneratorClient({workerFactory:bridge,storageFactory:async()=>{const store=createGeneratorMemoryStorage();const original=store.write;store.write=async(k,b)=>{if(fail)throw new GeneratorError('STORAGE_LIMIT');if(delay){entered=true;await gate.promise;}await original(k,b);};stores.push(store);return store;}});
  const selection=(await sources()).map(source=>({source,sheetName:'First',headerRow:2}));const plan=await client.prepare(input,selection);await client.generate(plan);
  assert.equal(client.snapshot().results.length,6);const old=client.snapshot();const oldDownload=await client.readResult(old.results[0].id);
  fail=true;await client.generate(plan);assert.deepEqual(client.snapshot().results,old.results);assert.equal(client.snapshot().attempt!.rows[0].error,'STORAGE_LIMIT');fail=false;
  const badPlan=await client.prepare(input,[{source:{...selection[0].source,book:{...selection[0].source.book,sheets:selection[0].source.book.sheets.map(s=>({...s,rowCount:6}))}},sheetName:'First',headerRow:4}]).catch(()=>undefined);
  assert.equal(badPlan,undefined); // Invalid header rows do not replace existing results.
  delay=true;const running=client.generate(plan);await until(()=>entered);client.cancel();assert.equal(client.snapshot().state,'canceling');await assert.rejects(client.generate(plan),{code:'BUSY'});gate.resolve();await running;assert.deepEqual(client.snapshot().results,old.results);assert.ok(client.snapshot().attempt!.rows.filter(r=>!r.error||r.error==='CANCELED').every(r=>r.status==='canceled'));
  delay=false;await client.generate(plan);assert.notEqual(client.snapshot().resultAttemptId,old.resultAttemptId);assert.ok(await stores[0].read('row-1'));await client.acknowledgeResults(client.snapshot().version);await assert.rejects(stores[0].read('row-1'));oldDownload.release();await client.dispose();assert.equal(client.snapshot().results.length,0);
});

test('all-error rerun keeps previous result set and exposes independent failure manifest',async()=>{
  const client=createDocumentGeneratorClient({workerFactory:bridge,storageFactory:async()=>createGeneratorMemoryStorage()});const [source]=await sources();const plan=await client.prepare(input,[{source,sheetName:'First',headerRow:2}]);await client.generate(plan);const old=client.snapshot().results;
  const badSource=structuredClone(source);badSource.book.sheets[0].cells.filter(cell=>cell.row>2&&cell.column===2).forEach(cell=>{cell.type='error';});
  const bad=await client.prepare(input,[{source:badSource,sheetName:'First',headerRow:2}]);await client.generate(bad);assert.deepEqual(client.snapshot().results,old);assert.ok(client.snapshot().attempt!.rows.every(row=>row.status==='failed'));
  const manifest=await client.exportManifest('en');const workbook=new ExcelJS.Workbook();await workbook.xlsx.load(await manifest.blob.arrayBuffer());assert.equal(workbook.worksheets[0].getCell('E2').text,'Failed');assert.equal(workbook.worksheets[0].getCell('C2').text,'3');manifest.release();await client.dispose();
});

test('real C3 ZIP close delayed settlement: cancel hides late ZIP, preserves individual and old ZIP, retries',async()=>{
  let delayed=false,entered=false;const gate=deferred();const client=createDocumentGeneratorClient({workerFactory:bridge,storageFactory:async()=>createGeneratorMemoryStorage(),zipWriterFactory:(...args)=>{const writer=createIncrementalZipArchiveWriter(...args);return {...writer,async close(){const blob=await writer.close();if(delayed){entered=true;await gate.promise;}return blob;}};}});
  const [source]=await sources();await client.generate(await client.prepare(input,[{source,sheetName:'First',headerRow:2}]));const zip=await client.exportZip();const old=client.snapshot().zip;assert.ok(new PizZip(await zip.blob.arrayBuffer()).file(/\.docx$/).length===3);
  delayed=true;const pending=client.exportZip();await until(()=>entered);client.cancel();await assert.rejects(client.exportZip(),{code:'BUSY'});gate.resolve();await assert.rejects(pending,{code:'CANCELED'});assert.equal(client.snapshot().zip,old);assert.equal(client.snapshot().results.length,3);delayed=false;const retry=await client.exportZip();assert.ok(retry.blob.size>0);zip.release();retry.release();await client.dispose();
});

test('worker bridge ignores stale replies and closes canceled job before retry',async()=>{
  const {createGeneratorWorkerBridge}=await import('../../src/features/document-generator/workerClient.ts');
  class FakeWorker extends EventTarget {
    sent: {id:number}[]=[]; stopped=0;
    postMessage(data:{id:number}){this.sent.push(data);} terminate(){this.stopped++;}
    reply(id:number){this.dispatchEvent(new MessageEvent('message',{data:{id,type:'inspect',variables:['name']}}));}
  }
  const workers:FakeWorker[]=[];const worker=createGeneratorWorkerBridge(()=>{const w=new FakeWorker();workers.push(w);return w as unknown as Worker;});
  const controller=new AbortController();const first=worker.request({type:'inspect',buffer:new ArrayBuffer(2)},controller.signal);controller.abort();await assert.rejects(first,{code:'CANCELED'});assert.equal(workers[0].stopped,1);
  let resolved=false;const second=worker.request({type:'inspect',buffer:new ArrayBuffer(2)}).then(value=>{resolved=true;return value;});workers[0].reply(2);workers[1].reply(1);await Promise.resolve();assert.equal(resolved,false);workers[1].reply(2);assert.equal((await second).type,'inspect');worker.terminate();
});

test('zero data rows and two valid rows retain whole-run behavior without inventing outputs',async()=>{
  const book=await parseGeneratorData('empty.csv',new TextEncoder().encode('name,value,code,empty\n').buffer);const client=createDocumentGeneratorClient({workerFactory:bridge,storageFactory:async()=>createGeneratorMemoryStorage()});
  const plan=await client.prepare(input,[{source:{id:'empty',fileName:'empty.csv',book},sheetName:book.sheets[0].name,headerRow:1}]);assert.equal(plan.rows.length,0);assert.equal((await client.generate(plan)).rows.length,0);assert.equal(client.snapshot().results.length,0);
  const twoBook=await parseGeneratorData('two.csv',new TextEncoder().encode('name,value,code,empty\na,first,001,\nb,second,002,\n').buffer);const two=await client.prepare(input,[{source:{id:'two',fileName:'two.csv',book:twoBook},sheetName:twoBook.sheets[0].name,headerRow:1}]);await client.generate(two);assert.equal(client.snapshot().results.length,2);await client.dispose();
});
