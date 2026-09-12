import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {build, preview} from 'vite';
import {nodePolyfills} from 'vite-plugin-node-polyfills';
import {chromium} from 'playwright';
import {generatorTemplate, generatorWorkbook} from './helpers/document-generator-fixtures.mjs';

const root=path.resolve(import.meta.dirname,'..');
const output=process.env.GENERATOR_EVIDENCE_DIR ?? await fs.mkdtemp(path.join(os.tmpdir(),'worklazy-generator-smoke-'));
await fs.mkdir(output,{recursive:true});
const entry=path.join(output,'entry.ts');
await fs.writeFile(entry, `import {createDocumentGeneratorClient} from '${root}/src/features/document-generator/client.ts';
import {createGeneratorWorkerBridge} from '${root}/src/features/document-generator/workerClient.ts';
import {createGeneratorStorage,createGeneratorMemoryStorage,GENERATOR_MEMORY_LIMIT} from '${root}/src/features/document-generator/storage.ts';
window.generator={createDocumentGeneratorClient,createGeneratorWorkerBridge,createGeneratorStorage,createGeneratorMemoryStorage,GENERATOR_MEMORY_LIMIT};window.ready=true;`);
await fs.writeFile(path.join(output,'index.html'),'<html><head><meta charset="utf-8"></head><body>Local synthetic core check<script type="module" src="./entry.ts"></script></body></html>');
const config={configFile:false,root:output,publicDir:false,plugins:[nodePolyfills({globals:{Buffer:true,global:true,process:true},protocolImports:true})],worker:{format:'es'},build:{outDir:process.env.GENERATOR_DIST_DIR ?? path.join(output,'dist'),emptyOutDir:true,rollupOptions:{input:path.join(output,'index.html')}},preview:{host:'127.0.0.1',port:Number(process.env.GENERATOR_TEST_PORT??4382),strictPort:true}};
if(!process.env.GENERATOR_SKIP_BUILD)await build(config);
const server=await preview(config);
const origin=`http://127.0.0.1:${config.preview.port}`;
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
const external=[],errors=[],requests=[],consoleMessages=[];
try{
 const context=await browser.newContext({serviceWorkers:'block'});
 await context.route('**/*',route=>{const url=route.request().url();requests.push(url);if(!url.startsWith(origin+'/')){external.push(url);return route.abort();}return route.continue();});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>consoleMessages.push(m.text()));
 // Vite preserves the temp entry HTML path relative to project root; locate it.
 const html=await findHtml(config.build.outDir);
 await page.goto(origin+'/'+path.relative(config.build.outDir,html));await page.waitForFunction(()=>window.ready);
 if(process.env.GENERATOR_NETWORK_MUTANT){
  await page.evaluate(async()=>{const url=URL.createObjectURL(new Blob([`fetch('https://example.invalid/U7-synthetic-worker-mutant').catch(()=>{}).finally(()=>postMessage('settled'));`],{type:'text/javascript'}));const worker=new Worker(url);try{await new Promise(resolve=>worker.onmessage=resolve);}finally{worker.terminate();URL.revokeObjectURL(url);}});
  await fs.writeFile(path.join(output,'network-mutant.json'),JSON.stringify({external,errors,requests},null,2));
  assertNetworkBoundary(external,errors);throw Error('Mutant escaped');
 }
 const fixtures={template:[...generatorTemplate()],a:[...await generatorWorkbook('A')],b:[...await generatorWorkbook('B')]};
 await fs.writeFile(path.join(output,'template.docx'),new Uint8Array(fixtures.template));
 const result=await page.evaluate(async fixtures=>{
  const {createDocumentGeneratorClient,createGeneratorWorkerBridge,createGeneratorStorage,createGeneratorMemoryStorage,GENERATOR_MEMORY_LIMIT}=window.generator;
  const assert=(value,message)=>{if(!value)throw Error(message);};
  const wait=async test=>{for(let i=0;i<4000;i++){if(test())return;await new Promise(r=>setTimeout(r,1));}throw Error('wait timeout');};
  const template=new File([new Uint8Array(fixtures.template)],'template.docx');
  const sourceFiles=[new File([new Uint8Array(fixtures.a)],'A.xlsx'),new File([new Uint8Array(fixtures.b)],'B.xlsx')];
  let workers=0,terminated=0,duringRender=false,renderClient;
  // Use the production bridge's own worker URL. Count lifecycle through the native constructor below.
  const Native=window.Worker;
  window.Worker=class extends Native{constructor(...args){super(...args);workers++;const stop=this.terminate.bind(this);this.terminate=()=>{terminated++;stop();};this.addEventListener('message',({data})=>{if(duringRender&&data.type==='progress'){duringRender=false;renderClient.cancel();}});}};
  const client=createDocumentGeneratorClient();
  const sources=await client.loadSources(sourceFiles);
  assert(sources.length===2&&sources.every(s=>s.book.sheets.length===2),'2files2sheets');
  const plan=await client.prepare(template,sources.map(source=>({source,sheetName:'Second',headerRow:2})));
  assert(plan.rows[0].row===3&&plan.rows[0].values.value==='#N/A'&&plan.rows[0].values.code==='000123','C1 origin/display');
  const attempt=await client.generate(plan);
  assert(attempt.storageKind==='opfs','real OPFS selected');assert(client.snapshot().results.length===6,'six committed');
  const output=[];
  for(const row of client.snapshot().results){const owned=await client.readResult(row.id);output.push({name:row.fileName,bytes:[...new Uint8Array(await owned.blob.arrayBuffer())],row:row.row,sourceFile:row.sourceFile});owned.release();}
  const zip=await client.exportZip();const zipBytes=[...new Uint8Array(await zip.blob.arrayBuffer())];zip.release();
  const manifest=await client.exportManifest('en');const manifestBytes=[...new Uint8Array(await manifest.blob.arrayBuffer())];manifest.release();
  const old=client.snapshot();
  await client.generate(plan);await client.acknowledgeResults(client.snapshot().version);
  assert(client.snapshot().resultAttemptId!==old.resultAttemptId,'first commit replacement');
  // Actual worker termination during a render, then retry from committed results.
  const repeat=client.generate(plan);client.cancel();await repeat;assert(client.snapshot().results.length===6,'cancel before first commit preserves');
  await client.generate(plan);assert(client.snapshot().results.length===6,'retry');
  renderClient=client;duringRender=true;await client.generate(plan);assert(!duringRender,'actual worker rendering progress observed');assert(client.snapshot().results.length===6,'terminate during render preserves prior');
  await client.dispose();assert(client.snapshot().results.length===0,'dispose');
  // Exact 200MiB committed memory Blob policy; shared chunk assembly has a real Blob.size.
  const memory=createGeneratorMemoryStorage();const chunk=new Blob([new Uint8Array(1024*1024)]);const large=new Blob(Array(200).fill(chunk));
  assert(large.size===GENERATOR_MEMORY_LIMIT,'actual blob equals policy');await memory.write('row-1',large);
  let limit=false;try{await memory.write('row-2',new Blob(['x']));}catch(e){limit=e.code==='STORAGE_LIMIT';}assert(limit,'+1 rejected');assert((await memory.read('row-1')).size===GENERATOR_MEMORY_LIMIT,'previous large kept');await memory.clear();
  // Actual OPFS write callback delayed after writing: cancellation retains pending ownership until settlement.
  let delayed=false,entered=false,release,fault='',readFailure=false;
  const platform={getDirectory:async()=>{
    const root=await navigator.storage.getDirectory();
    return {getDirectoryHandle:async(name,opts)=>{
      const parent=await root.getDirectoryHandle(name,opts);
      return {removeEntry:parent.removeEntry.bind(parent),getDirectoryHandle:async(name,opts)=>{
        const run=await parent.getDirectoryHandle(name,opts);
        return {removeEntry:run.removeEntry.bind(run),getFileHandle:async(name,opts)=>{
          const file=await run.getFileHandle(name,opts);
          return {getFile:async()=>{if(readFailure)throw Error('SYNTHETIC_READ_FAILURE');return file.getFile();},createWritable:async()=>{
            const writable=await file.createWritable();return {abort:writable.abort.bind(writable),close:writable.close.bind(writable),write:async blob=>{await writable.write(blob);if(fault)throw fault==='quota'?new DOMException('Synthetic quota','QuotaExceededError'):Error('Synthetic write');if(delayed){entered=true;await new Promise(r=>release=r);}}};
          }};
        }};
      }};
    }};
  },estimate:()=>navigator.storage.estimate()};
  const canceled=createDocumentGeneratorClient({storageFactory:()=>createGeneratorStorage(platform)});
  const cp=await canceled.prepare(template,sources.map(source=>({source,sheetName:'First',headerRow:2})));await canceled.generate(cp);const prior=canceled.snapshot().results;
  delayed=true;const pending=canceled.generate(cp);await wait(()=>entered);canceled.cancel();assert(canceled.snapshot().state==='canceling','pending write remains active');let busy=false;try{await canceled.generate(cp);}catch(e){busy=e.code==='BUSY';}assert(busy,'fast retry prevented before write settles');release();await pending;assert(JSON.stringify(canceled.snapshot().results)===JSON.stringify(prior),'old result preserved after late write');delayed=false;
  for(const mode of ['write','quota']){fault=mode;await canceled.generate(cp);assert(JSON.stringify(canceled.snapshot().results)===JSON.stringify(prior),'OPFS write/quota prior results');assert(canceled.snapshot().attempt.rows[0].error===(mode==='quota'?'STORAGE_LIMIT':'STORAGE_WRITE'),'actual write failure classified');assert(canceled.snapshot().attempt.storageKind==='opfs','no midwrite fallback');}
  fault='';const priorZip=await canceled.exportZip();const oldZip=canceled.snapshot().zip;readFailure=true;let readRejected=false;try{await canceled.exportZip();}catch(e){readRejected=e.code==='STORAGE_READ';}assert(readRejected,'OPFS read error');assert(canceled.snapshot().zip===oldZip,'ZIP preserved on read failure');readFailure=false;priorZip.release();await canceled.dispose();
  const fallback=await createGeneratorStorage({getDirectory:async()=>{throw Error('startup');}});assert(fallback.kind==='memory'&&fallback.fallback,'startup fallback');await fallback.clear();
  window.Worker=Native;
  return {cases:['2files2sheets','real-worker','opfs-six-outputs','zip','manifest','replace','cancel-before-commit','retry','dispose','actual-memory-equality-plus1','opfs-delayed-write-cancel','worker-render-terminate','opfs-write-failure','opfs-quota-failure','opfs-read-failure','opfs-startup-fallback'],workers,terminated,output,zipBytes,manifestBytes};
 },fixtures);
 for(const file of result.output)await fs.writeFile(path.join(output,file.name),new Uint8Array(file.bytes));
 await fs.writeFile(path.join(output,'results.zip'),new Uint8Array(result.zipBytes));await fs.writeFile(path.join(output,'manifest.xlsx'),new Uint8Array(result.manifestBytes));
 const summary={...result,output:result.output.map(({bytes,...item})=>({...item,bytes:bytes.length})),zipBytes:result.zipBytes.length,manifestBytes:result.manifestBytes.length,external,errors,requests,browser:await browser.version(),consoleMessages};
 await fs.writeFile(path.join(output,'summary.json'),JSON.stringify(summary,null,2));
 assertNetworkBoundary(external,errors);console.log(JSON.stringify({cases:result.cases.length,external:external.length,errors:errors.length,outputs:result.output.length,workers:result.workers,terminated:result.terminated}));
}finally{await browser.close();await new Promise(resolve=>server.httpServer.close(resolve));}
async function findHtml(dir){for(const item of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,item.name);if(item.isFile()&&item.name.endsWith('.html'))return p;if(item.isDirectory()){const found=await findHtml(p);if(found)return found;}}}

function assertNetworkBoundary(external,errors){assert.equal(external.length,0,'external transport attempt');assert.equal(errors.length,0,'browser exception');}
