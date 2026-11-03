import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {startRecoveryServer} from './recovery-server.mjs';
const output=path.resolve(process.env.OFFICE_STICKY_OUTPUT||'scratch/mobile-sticky/office');const records=[];let server,browser;
before(async()=>{await fs.mkdir(output,{recursive:true});server=await startRecoveryServer({root:'dist',port:0});browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});});
after(async()=>{await browser?.close();await server?.close();await fs.writeFile(path.join(output,'results.json'),JSON.stringify(records,null,2));});
for(const [width,lang,theme]of [[768,'ko','light-coral'],[768,'en','dark-coral'],[1440,'ko','dark-coral'],[1440,'en','light-coral']])test(`office ${width} ${lang} ${theme}: sticky actions clear header`,{timeout:60000},async()=>{
 const context=await browser.newContext({viewport:{width,height:750},serviceWorkers:'block'}),page=await context.newPage(),record={width,lang,theme};
 try{
  await context.addInitScript(theme=>{if(window===window.top)localStorage.setItem('worklazy-theme',theme);},theme);await context.route('**/*',route=>new URL(route.request().url()).origin===server.url?route.continue():route.abort());
  await page.goto(`${server.url}/${lang}/tools/office-editor/app/`,{waitUntil:'domcontentloaded'});const bar=page.getByTestId('office-app-toolbar');await bar.waitFor();await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(document.getAnimations().filter(a=>a.effect?.getComputedTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));});
  const top=await bar.evaluate(el=>el.getBoundingClientRect().top+scrollY);record.states=[];
  for(const y of [top-20,top+50,top+150]){
   await page.evaluate(y=>scrollTo({top:y,behavior:'instant'}),y);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
   record.states.push(await bar.evaluate(el=>{const headers=[...document.querySelectorAll('.mobile-header,.wl-topbar')].filter(e=>e.getClientRects().length&&getComputedStyle(e).position==='fixed');const headerBottom=Math.max(0,...headers.map(e=>e.getBoundingClientRect().bottom));const points=[];const controls=[...el.querySelectorAll('a,button')].filter(e=>!e.disabled&&e.getClientRects().length);for(const b of controls){const r=b.getBoundingClientRect(),x=r.left+r.width/2,y=r.top+r.height/2;for(const [px,py]of [[x,y],[x,r.top+2],[x,r.bottom-2],[r.left+2,y],[r.right-2,y]]){const hit=document.elementFromPoint(px,py);points.push({hit:hit===b||b.contains(hit),blockedBy:hit?.closest('header')?.className||hit?.tagName});}}return{scrollY,top:el.getBoundingClientRect().top,headerBottom,controls:controls.length,points};}));
  }
  record.blocked=record.states.flatMap(s=>s.points).filter(p=>!p.hit);assert.ok(record.states.every(s=>s.controls>0));assert.equal(record.blocked.length,0,'Office sticky controls must not be covered');record.passed=true;
 }catch(error){record.passed=false;record.error=error.message;await page.screenshot({path:path.join(output,`${width}-${lang}-${theme}-failure.png`)});throw error;}
 finally{records.push(record);await context.close();}
});
