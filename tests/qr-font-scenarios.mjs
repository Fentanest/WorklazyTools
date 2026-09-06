import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import http from 'node:http';
import { PDFDocument, PDFRawStream, decodePDFRawStream } from 'pdf-lib';

export const fontPaths = {
  subset: '/vendor/qr-label-font/noto-cjk-sans-2.004-ksx1001-v1/NotoSansKR-Regular.ksx1001.otf',
  full: '/vendor/qr-label-font/noto-cjk-sans-2.004/NotoSansKR-Regular.otf',
};
const pins = {
  subset: {size:931704, sha256:'b84d27a582d3f3e660db728e7913af3061d4e825e93cabdb6802f0ce23a252be'},
  full: {size:4644748, sha256:'69975a0ac8472717870aefeab0a4d52739308d90856b9955313b2ad5e0148d68'},
};
export const qrFontScenarios = {
  subset: {font:'subset',requests:['subset']},
  full: {font:'full',requests:['full']},
  corrupt: {font:'full',requests:['subset','full']},
};
export const qrFontBrowserScenarios = {
  ...qrFontScenarios,
  font404: {font:'full',requests:['subset','full']},
};
export function readQrFontScenario(args) {
  assert(args.length <= 1, 'Use exactly one optional --scenario=subset|full|corrupt');
  const scenario=args.length ? args[0].replace(/^--scenario=/,'') : 'subset';
  assert(!args.length || args[0].startsWith('--scenario='), 'Expected --scenario=');
  assert(Object.hasOwn(qrFontScenarios,scenario),`Unknown QR font scenario: ${scenario}`);
  return scenario;
}
export function qrFontFixture(scenario, count) {
  assert(Object.hasOwn(qrFontBrowserScenarios,scenario));
  const rows=Array.from({length:count},(_,i)=>({
    payload: count===25 ? `한글 라벨 경계 ${i+1}` : `한글 라벨 ${i===0?'첫째':'둘째'}`,
    title:'한글 라벨 제목'+(scenario==='full' && i===0 ? '똠' : ''), description:'',
  }));
  return {rows,csv:'Primary,Label\n'+rows.map(r=>`${r.payload},${r.title}`).join('\n'),titleTemplate:'{{Label}}'};
}
export async function assertPinnedQrPdf(bytes, kind, pages) {
  assert.equal(Buffer.from(bytes.subarray(0,4)).toString(),'%PDF');
  const document=await PDFDocument.load(bytes);
  assert.equal(document.getPageCount(),pages);
  const fonts=[];
  for (const [,object] of document.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFRawStream)) continue;
    const decoded=decodePDFRawStream(object).decode();
    if (Buffer.from(decoded.subarray(0,4)).toString()==='OTTO') fonts.push(decoded);
  }
  assert.equal(fonts.length,1,'Exactly one embedded OTF stream');
  const embedded={size:fonts[0].length,sha256:createHash('sha256').update(fonts[0]).digest('hex')};
  assert.deepEqual(embedded,pins[kind]);
  return {pdfBytes:bytes.length,pages:document.getPageCount(),embedded};
}
export function assertQrFontRequests(requests, scenario) {
  const selected=requests.filter(r=>Object.values(fontPaths).includes(new URL(r.url).pathname));
  assert.deepEqual(selected.map(r=>new URL(r.url).pathname),qrFontScenarios[scenario].requests.map(k=>fontPaths[k]));
  assert(selected.every(r=>r.stage==='pdf-complete' && !r.fromServiceWorker && !r.fromDiskCache && !r.servedFromCache && !r.netlogCacheRead));
}
// Test-only same-origin reverse proxy. Ordinary responses retain upstream bytes
// and encoding. Only the exact owned subset pathname can be corrupted.
// Browser routing is never used; Chromium records actual HTTP bytes in NetLog.
export async function createQrFontScenarioServer({upstream,subsetPath,chunkPath,scenario='subset'}) {
  const serverScenarios=new Set([...Object.keys(qrFontBrowserScenarios),'chunk404']);
  assert(serverScenarios.has(scenario));
  const corrupt=Buffer.from(await fs.readFile(subsetPath));
  assert.equal(corrupt.length,pins.subset.size);
  assert.equal(createHash('sha256').update(corrupt).digest('hex'),pins.subset.sha256);
  corrupt[50]^=1;
  const injected=[];
  const fontRequests=[];
  let heldFont404;
  const server=http.createServer((request,response)=>{
    const target=new URL(request.url,upstream);
    const requestScenario=scenario;
    if (Object.values(fontPaths).includes(target.pathname)) fontRequests.push({scenario:requestScenario,path:target.pathname});
    if (requestScenario==='corrupt' && target.pathname===fontPaths.subset) {
      injected.push({scenario:requestScenario,path:target.pathname,status:200,bytes:corrupt.length});
      response.writeHead(200,{'Content-Type':'font/otf','Content-Length':corrupt.length});
      response.end(corrupt); return;
    }
    if (requestScenario==='font404' && target.pathname===fontPaths.subset) {
      injected.push({scenario:requestScenario,path:target.pathname,status:404,bytes:0});
      const hold=heldFont404;
      hold?.markRequested();
      const respond=()=>{
        if (response.destroyed) return;
        response.writeHead(404,{'Content-Type':'text/plain','Content-Length':0});
        response.end();
      };
      if (hold) void hold.gate.then(respond);
      else respond();
      return;
    }
    if (requestScenario==='chunk404' && chunkPath && target.pathname===chunkPath) {
      injected.push({scenario:requestScenario,path:target.pathname,status:404,bytes:0});
      response.writeHead(404,{'Content-Type':'text/plain','Content-Length':0});
      response.end(); return;
    }
    const pending=http.request(target,{method:request.method,headers:{...request.headers,host:target.host}},incoming=>{
      response.writeHead(incoming.statusCode,incoming.headers); incoming.pipe(response);
    });
    pending.on('error',()=>{response.writeHead(502);response.end('Test upstream unavailable');});
    request.pipe(pending);
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  return {url:`http://127.0.0.1:${server.address().port}`,injected,fontRequests,
    setScenario(value){assert(serverScenarios.has(value));scenario=value},
    holdFont404(){
      assert.equal(scenario,'font404');
      assert.equal(heldFont404,undefined);
      let releaseGate,markRequested;
      const gate=new Promise(resolve=>{releaseGate=resolve});
      const requested=new Promise(resolve=>{markRequested=resolve});
      let released=false;
      const hold={gate,requested,markRequested,release(){
        if (released) return;
        released=true;
        heldFont404=undefined;
        releaseGate();
      }};
      heldFont404=hold;
      return {requested,release:hold.release};
    },
    async close(){heldFont404?.release();server.closeAllConnections();await new Promise(r=>server.close(r))},
  };
}
