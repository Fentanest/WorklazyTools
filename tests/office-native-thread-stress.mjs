// Synthetic rich fixtures only. Uses real product UI and pinned native runtime.
// Browser/process RSS is diagnostic; shared pages may be counted more than once.
import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import { Worker as CpuWorker } from 'node:worker_threads';
import { setTimeout as delay } from 'node:timers/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
const root=process.cwd(), out=process.env.EVIDENCE_DIR||await fs.mkdtemp('/tmp/office-native-thread-stress-');
await fs.mkdir(out,{recursive:true});
const dist=path.resolve(process.env.OFFICE_STRESS_DIST||'dist');
const original=await fs.readFile(path.join(dist,'vendor/libreoffice-converter/2.3.1/browser.worker.global.js'),'utf8');
const originalSHA=createHash('sha256').update(original).digest('hex');
const server=http.createServer(async(req,res)=>{try{
 const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);let file=path.resolve(dist,'.'+pathname);
 if(!file.startsWith(dist+path.sep)){res.writeHead(403).end();return;}
 let stat=await fs.stat(file);if(stat.isDirectory()){file=path.join(file,'index.html');stat=await fs.stat(file);}
 const mime=({'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'})[path.extname(file)]||'application/octet-stream';
 res.writeHead(200,{'Content-Type':mime,'Content-Length':stat.size,'Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp','Cross-Origin-Resource-Policy':'same-origin','Cache-Control':'no-store'});createReadStream(file).pipe(res);
 }catch{res.writeHead(404).end('missing');}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
const cdp=await browser.newBrowserCDPSession();let stopping=false;const memory=[];
async function resources(){const [mem,load,pressure]=await Promise.all(['/proc/meminfo','/proc/loadavg','/proc/pressure/memory'].map(p=>fs.readFile(p,'utf8')));return{at:Date.now(),availableGiB:Number(mem.match(/^MemAvailable:\s*(\d+)/m)?.[1])/1024**2,load:load.trim(),pressure:pressure.trim()};}
const monitor=(async()=>{while(!stopping){try{const processes=(await cdp.send('SystemInfo.getProcessInfo')).processInfo;const rss=[];for(const p of processes){try{const s=await fs.readFile(`/proc/${p.id}/status`,'utf8');rss.push({pid:p.id,type:p.type,cpu:p.cpuTime,rssKiB:Number(s.match(/^VmRSS:\s*(\d+)/m)?.[1]||0)});}catch{}}memory.push({...await resources(),rss});}catch{}await fs.writeFile(path.join(out,'memory.json'),JSON.stringify(memory));await delay(1000);}})();
const plans={serial:{count:8,parallel:1,cpu:0,trace:false},parallel:{count:16,parallel:4,cpu:0,trace:false},loaded:{count:24,parallel:4,cpu:6,trace:false}};
if(process.env.OFFICE_STRESS_CASES){const count=Number(process.env.OFFICE_STRESS_CASES);if(!Number.isInteger(count)||count<2||count%2)throw Error('OFFICE_STRESS_CASES must be a positive even count');for(const plan of Object.values(plans))plan.count=count;}
const selected=process.env.OFFICE_STRESS_PROFILE?process.env.OFFICE_STRESS_PROFILE.split(','):(process.argv[2]?process.argv.slice(2):Object.keys(plans));const records=[];
await fs.writeFile(path.join(out,'environment.json'),JSON.stringify({root,head:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),node:process.version,browser:browser.version(),cpus:os.cpus().length,originalSHA,plans,base,fixtures:await Promise.all(['rich.docx','rich.xlsx'].map(async name=>({name,sha256:createHash('sha256').update(await fs.readFile(path.join(root,'tests/fixtures/document-converters',name))).digest('hex')})))},null,2));
async function single(group,index,plan){
 const id=`${group}-${String(index).padStart(2,'0')}`,name=index%2?'rich.xlsx':'rich.docx', logFile=path.join(out,id+'.jsonl');const events=[];const started=Date.now();let page;
 const record={id,group,index,name,trace:plan.trace,cpuWorkers:plan.cpu,status:'starting',started,resourcesBefore:await resources()};
 const context=await browser.newContext({serviceWorkers:'block',viewport:{width:1280,height:900}});
 const add=e=>{events.push({hostAt:Date.now(),...e});void fs.appendFile(logFile,JSON.stringify(events.at(-1))+'\n');};
 await context.exposeBinding('__officeHostTrace',(_,event)=>add(event));
 await context.addInitScript(()=>{
  window.__WORKLAZY_MOCK_PROVIDERS__=true;const Original=window.Worker;let counter=0;
  const emit=event=>{window.__officeHostTrace(event).catch(()=>{});};
  window.Worker=class extends Original{constructor(url,opts){super(url,opts);this.probeId=++counter;this.office=String(url).includes('browser.worker.global');emit({event:'worker-created',worker:this.probeId,office:this.office});const post=this.postMessage.bind(this);this.postMessage=(message,...transfer)=>{if(this.office)emit({event:'send',worker:this.probeId,type:message.type,id:message.id});return post(message,...transfer)};this.addEventListener('message',({data})=>{if(this.office)emit({event:'receive',worker:this.probeId,type:data.type,id:data.id,progress:data.progress,probe:data.probe,bytes:data.data?.byteLength})});this.addEventListener('error',e=>emit({event:'worker-error',worker:this.probeId,message:e.message}));}terminate(){emit({event:'worker-terminated',worker:this.probeId,office:this.office});super.terminate();}};
 });
 const external=[];
 await context.route('**/*',async route=>{const url=route.request().url();if(url.startsWith(base+'/')||/^(blob:|data:)/.test(url))return route.continue();external.push(url);return route.abort();});
 try{
  page=await context.newPage();page.setDefaultTimeout(25000);
  page.on('console',m=>{const text=m.text();if(/lok_document|Unipoll|WASM.*error|Aborted|pthread|out of memory/i.test(text))add({event:'console',level:m.type(),text:text.slice(0,1200)});});page.on('pageerror',e=>add({event:'pageerror',message:e.message}));page.on('crash',()=>add({event:'pagecrash'}));
  await page.goto(base+'/en/tools/pdf-converter/document-to-pdf/');await page.waitForFunction(()=>crossOriginIsolated&&typeof SharedArrayBuffer!=='undefined');
  await page.locator('input[type=file]').setInputFiles(path.join(root,'tests/fixtures/document-converters',name));
  record.conversionStarted=Date.now();await page.getByRole('button',{name:'Create PDF',exact:true}).click();
  while(Date.now()-record.conversionStarted<192000){
   const state=await Promise.race([page.evaluate(()=>({link:!!document.querySelector('[data-testid=document-pdf-download]'),alerts:[...document.querySelectorAll('[role=alert]')].map(e=>e.textContent),reload:[...document.querySelectorAll('button')].some(e=>e.textContent==='Reload page')})),delay(4000).then(()=>({unresponsive:true}))]);
   if(state.unresponsive){record.mainThreadUnresponsive=true;}
   else if(state.link){const link=page.getByTestId('document-pdf-download');const [download]=await Promise.all([page.waitForEvent('download'),link.click()]);const pdf=path.join(out,id+'.pdf');await download.saveAs(pdf);const info=execFileSync('pdfinfo',[pdf],{encoding:'utf8'});const text=execFileSync('pdftotext',[pdf,'-'],{encoding:'utf8'});const images=execFileSync('pdfimages',['-list',pdf],{encoding:'utf8'});record.pages=Number(info.match(/^Pages:\s*(\d+)/m)?.[1]);record.bytes=(await fs.stat(pdf)).size;record.outputValid=record.pages===2&&/한글/.test(text)&&/42/.test(text)&&/SECOND/.test(text)&&/\bimage\b/.test(images);record.status=record.outputValid?'pass':'invalid-output';break;}
   else if(state.alerts.length||state.reload){record.status=state.reload?'product-timeout':'product-error';record.alerts=state.alerts;break;}
   await delay(500);
  }
  if(record.status==='starting')record.status='diagnostic-deadline';
 }catch(error){record.status='harness-error';record.error=String(error);}
 finally{
  record.ms=Date.now()-(record.conversionStarted||started);record.lastReceive=[...events].reverse().find(e=>e.event==='receive');record.lastNative=[...events].reverse().find(e=>e.probe?.phase?.startsWith('native'));record.lastNativeConsole=[...events].reverse().find(e=>e.event==='console');record.sends=events.filter(e=>e.event==='send');record.external=external;record.resourcesAfter=await resources();
  await fs.writeFile(path.join(out,id+'.json'),JSON.stringify(record,null,2));await fs.writeFile(path.join(out,id+'-events.json'),JSON.stringify(events,null,2));records.push(record);await fs.writeFile(path.join(out,'results.json'),JSON.stringify(records,null,2));console.log(JSON.stringify({id,name,status:record.status,ms:record.ms,last:record.lastNative?.probe||record.lastReceive?.progress||record.lastNativeConsole?.text}));
  await context.close();
 }
}
try{for(const group of selected){const plan=plans[group];if(!plan)throw Error(group);const before=await resources();if(before.availableGiB<8)throw Error('insufficient memory for bounded stress');const cpus=Array.from({length:plan.cpu},()=>new CpuWorker(`let v=1;for(;;){for(let i=0;i<1000000;i++)v=Math.imul(v+1,1664525);}`,{eval:true}));console.log(JSON.stringify({group,start:before,parallel:plan.parallel,cpuWorkers:cpus.length}));try{let next=0;await Promise.all(Array.from({length:plan.parallel},async()=>{while(next<plan.count){const index=next++;await single(group,index,plan);}}));}finally{await Promise.all(cpus.map(w=>w.terminate()));}}}
finally{stopping=true;await monitor;await browser.close();await new Promise(r=>{server.closeAllConnections();server.close(r)});await fs.writeFile(path.join(out,'done.json'),JSON.stringify({finished:Date.now(),counts:records.reduce((a,r)=>(a[r.status]=(a[r.status]||0)+1,a),{}),cases:records.length},null,2));}

await test('rich office native operations complete under bounded repeated/concurrent load',()=>{
 assert.equal(records.length,selected.reduce((n,g)=>n+plans[g].count,0));
 assert.deepEqual(records.filter(r=>r.status!=='pass').map(r=>({id:r.id,status:r.status,last:r.lastReceive?.progress})),[]);
 for(const r of records){assert.deepEqual(r.external,[]);assert.equal(r.lastReceive?.type,'ready');assert.ok(r.sends.some(s=>s.type==='worklazy-ping'));assert.match(r.lastNativeConsole?.text||'',/lok_documentDestroy done/);}
});
