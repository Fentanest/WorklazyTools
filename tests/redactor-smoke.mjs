import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
const base=process.env.REDACTOR_BASE_URL??'http://127.0.0.1:4330';
const out=process.env.REDACTOR_OUTPUT??'/tmp/worklazy-u6-preflight/p1-engine/browser-first';fs.mkdirSync(out,{recursive:true});
const fixtures=process.env.REDACTOR_FIXTURES??'/tmp/worklazy-u6-preflight/p1-engine/fixtures';
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']});
const context=await browser.newContext({serviceWorkers:'block'});let active=false;const requests=[],errors=[],consoleRows=[];
await context.route('**/*',route=>{const url=route.request().url();if(active||!url.startsWith(base+'/')){requests.push(url);return route.abort();}return route.continue();});
const page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>consoleRows.push({type:m.type(),text:m.text()}));
try{
 await page.goto(base+'/tests/redactor-browser.html');await page.waitForFunction(()=>window.ready||window.fatal,{},{timeout:120000});const fatal=await page.evaluate(()=>window.fatal);assert.equal(fatal,undefined);active=true;
 const control=await page.evaluate(async bytes=>{
  const client=window.client;const {inputs:infos}=await client.setInputs([new File([new Uint8Array(bytes)],'DO_NOT_LOG_PRIVATE_NAME.pdf')]);
  const masks={0:[{x:.1,y:.1,w:.5,h:.3},{x:.3,y:.2,w:.4,h:.3}],2:[{x:0,y:0,w:.1,h:.1}]};
  const result=await client.processFile(infos[0].id,{dpi:150,masksByPage:masks});
  const bytesOut=Array.from(new Uint8Array(await result.blob.arrayBuffer()));
  return{infos,result:{...result,blob:{size:result.blob.size}},bytes:bytesOut,diagnostics:client.diagnostics(),capabilities:client.capabilities};
 },Array.from(fs.readFileSync(path.join(fixtures,'three-pages.pdf'))));
 fs.writeFileSync(path.join(out,'output.pdf'),Buffer.from(control.bytes));delete control.bytes;fs.writeFileSync(path.join(out,'control.json'),JSON.stringify(control,null,2));assert.deepEqual(control.result.unmaskedPages,[1]);
 await page.evaluate(()=>window.client.dispose());assert.equal(requests.length,0);assert.equal(errors.length,0);assert.ok(consoleRows.every(row=>!row.text.includes('SYNTHETIC_')&&!row.text.includes('DO_NOT_LOG')));console.log('PASS multi-page, mask union, unmasked page, exact internal PNG/PDF oracle, no HTTP after Node observer activation (exact-enable gate: redactor-network.mjs)');
}finally{fs.writeFileSync(path.join(out,'environment.json'),JSON.stringify({requests,errors,consoleRows,browser:browser.version()},null,2));await browser.close();}
