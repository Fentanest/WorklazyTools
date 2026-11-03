import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium, webkit } from 'playwright';
import { PNG } from 'pngjs';
import { startRecoveryServer } from './recovery-server.mjs';

const phase=process.env.STICKY_PHASE||'after';
const engine=process.env.STICKY_ENGINE||'chromium';
const output=path.resolve(process.env.STICKY_OUTPUT||`scratch/mobile-sticky/${phase}-${engine}`);
const records=[];let browser,server,image,folio;
const mobile=phase==='before'?[{width:414,lang:'ko',theme:'light-coral'}]:[414,390,320].flatMap(width=>['ko','en'].flatMap(lang=>['light-coral','dark-coral'].map(theme=>({width,lang,theme}))));
const cases=phase==='before'?mobile:[...mobile,{width:414,lang:'en',theme:'light-coral',inset:47},...['ko','en'].flatMap(lang=>['light-coral','dark-coral'].map(theme=>({width:1440,lang,theme}))),{width:1024,lang:'en',theme:'light-coral'}];
before(async()=>{
 await fs.mkdir(output,{recursive:true});server=await startRecoveryServer({root:'dist',port:0});
 browser=await (engine==='webkit'?webkit:chromium).launch({headless:true,...(engine==='chromium'?{executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']}:{})});
 const png=new PNG({width:960,height:640});png.data.fill(210);image=PNG.sync.write(png);
 folio=JSON.parse(await fs.readFile('tests/fixtures/foliotrace/market-holdings.json','utf8'));
});
after(async()=>{await browser?.close();await server?.close();await fs.writeFile(path.join(output,'results.json'),JSON.stringify({engine,phase,records},null,2));});
async function settle(page){await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(document.getAnimations().filter(a=>a.effect?.getComputedTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));await new Promise(requestAnimationFrame);});}
async function move(page,y){await page.evaluate(y=>scrollTo({top:Math.max(0,y),behavior:'instant'}),y);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function measure(page,selector,buttonSelector){return page.locator(selector).evaluate((rail,buttonSelector)=>{
 const r=rail.getBoundingClientRect();const headers=[...document.querySelectorAll('.mobile-header,.wl-topbar,.app-topbar')].filter(el=>el.getClientRects().length&&getComputedStyle(el).position==='fixed');const headerBottom=Math.max(0,...headers.map(el=>el.getBoundingClientRect().bottom));
 const all=[...rail.querySelectorAll(buttonSelector)].filter(el=>el.getClientRects().length&&!el.disabled);const controls=innerWidth>820?all.slice(0,5):all;
 const points=[];
 for(const [index,button]of controls.entries()){
  const b=button.getBoundingClientRect(),cx=b.left+b.width/2,cy=b.top+b.height/2;
  for(const [part,x,y]of [['center',cx,cy],['top',cx,b.top+2],['bottom',cx,b.bottom-2],['left',b.left+2,cy],['right',b.right-2,cy]]){
   const hit=document.elementFromPoint(x,y);points.push({index,part,x,y,hit:hit===button||button.contains(hit),blockedBy:hit?.closest('header')?.className||hit?.tagName||null});
  }
 }
 const style=getComputedStyle(rail);return {scrollY,position:style.position,cssTop:style.top,top:r.top,bottom:r.bottom,height:r.height,parentBottom:rail.parentElement.getBoundingClientRect().bottom,headerBottom,controls:controls.length,totalControls:all.length,points};
},buttonSelector);}
for(const c of cases)test(`${engine} ${c.lang} ${c.theme} ${c.width}${c.inset?' inset47':''}: sticky controls clear shell`,{timeout:90000},async()=>{
 const context=await browser.newContext({viewport:{width:c.width,height:750},deviceScaleFactor:c.width<=820?2:1,isMobile:c.width<=820,hasTouch:c.width<=820,serviceWorkers:'block'}),page=await context.newPage();const record={...c,engine};
 try{
  await context.addInitScript(theme=>{if(window===window.top)localStorage.setItem('worklazy-theme',theme);},c.theme);
  const body=JSON.stringify(folio),manifest={schemaVersion:1,datasetVersion:folio.datasetVersion,snapshotPath:`snapshots/${folio.datasetVersion}.json`,snapshotSha256:createHash('sha256').update(body).digest('hex')};
  await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!==server.url&&!/^(data:|blob:)/.test(url.protocol))return route.abort();if(url.pathname==='/data/foliotrace/v1/manifest.json')return route.fulfill({json:manifest});if(url.pathname===`/data/foliotrace/v1/${manifest.snapshotPath}`)return route.fulfill({body,contentType:'application/json'});return route.continue();});
  await page.goto(`${server.url}/${c.lang}/tools/image-studio/`,{waitUntil:'domcontentloaded'});await page.locator('.asp-image-editor .lower-canvas').waitFor();await settle(page);
  if(c.inset)await page.locator('.app-shell').evaluate((el,inset)=>el.style.setProperty('--wl-mobile-header-inset',`${inset}px`),c.inset);
  record.initial=await page.evaluate(()=>{const search=document.querySelector('.wl-search').getBoundingClientRect(),heading=document.querySelector('.ui-page-header').getBoundingClientRect(),tool=document.querySelector('[data-tool-page]');return {searchBottom:search.bottom,headingTop:heading.top,gap:heading.top-search.bottom,paddingTop:getComputedStyle(tool).paddingTop,documentWidth:document.documentElement.scrollWidth};});
  await page.locator('[data-testid=library-image-editor] input[type=file]').first().setInputFiles({name:'sticky-fixture.png',mimeType:'image/png',buffer:image});await page.waitForFunction(()=>!document.querySelector('[data-testid=image-editor-add-to-batch]')?.disabled);await settle(page);await move(page,0);
  const rail=page.locator('.asp-workspace__rail');const natural=await rail.evaluate(el=>el.getBoundingClientRect().top+scrollY);record.image=[];
  for(const y of [500,natural-100,natural-30,natural,natural+150,natural+300]){await move(page,y);const row=await measure(page,'.asp-workspace__rail','button.asp-rail__tool');row.expectedActive=row.position==='sticky'&&natural-row.scrollY<=row.headerBottom+8&&row.parentBottom>row.headerBottom+8+row.height;row.probed=row.expectedActive||row.points.every(point=>point.y>row.headerBottom&&point.y<(c.width<=820?669:750));record.image.push(row);}
  await page.screenshot({path:path.join(output,`${c.lang}-${c.theme}-${c.width}${c.inset?'-inset47':''}-image.png`)});
  assert.ok(record.image.every(row=>row.controls>=5),'actual image tools must be selected');
  const imagePoints=record.image.filter(row=>row.probed).flatMap(row=>row.points);assert.ok(imagePoints.length>=25,'positive visible/sticky hit selection');record.imageBlocked=imagePoints.filter(point=>!point.hit);
  assert.equal(record.imageBlocked.length,0,'image tool hit targets must not be covered by shell');
  if(c.width<=820){assert.ok(record.initial.gap>=8&&record.initial.gap<=40,'mobile heading uses reading space, not a second header reservation');}
  else{assert.equal(record.initial.paddingTop,'61px','desktop padding contract stays unchanged');}
  if(c.width<=820){
   await page.goto(`${server.url}/${c.lang}/tools/foliotrace/`,{waitUntil:'domcontentloaded'});await page.locator('.foliotrace-market-tabs').waitFor();await settle(page);
   if(c.inset)await page.locator('.app-shell').evaluate((el,inset)=>el.style.setProperty('--wl-mobile-header-inset',`${inset}px`),c.inset);
   await move(page,0);const natural=await page.locator('.foliotrace-market-tabs').evaluate(el=>el.getBoundingClientRect().top+scrollY);record.folio=[];
   for(const y of [natural-20,natural+100,natural+250]){await move(page,y);const row=await measure(page,'.foliotrace-market-tabs','button');assert.equal(row.controls,2);record.folio.push(row);}
   const points=record.folio.flatMap(row=>row.points);record.folioBlocked=points.filter(point=>!point.hit);assert.equal(record.folioBlocked.length,0,'other page-level sticky controls clear the same shell');
  }
  record.passed=true;
 }catch(error){record.passed=false;record.error=error.message;await page.screenshot({path:path.join(output,`${c.lang}-${c.theme}-${c.width}${c.inset?'-inset47':''}-failure.png`)}).catch(()=>{});throw error;}
 finally{records.push(record);await context.close();}
});
