import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
import {startRecoveryServer} from './recovery-server.mjs';
const phase=process.env.RAIL_PHASE||'after';const output=path.resolve(process.env.RAIL_OUTPUT||`scratch/mobile-rail/${phase}`);const records=[];let browser,server,image;
const cases=phase==='before'?[[320,'en','dark-coral']]:[414,390,320].flatMap(width=>[['ko','light-coral'],['en','dark-coral']].map(([lang,theme])=>[width,lang,theme]));
before(async()=>{await fs.mkdir(output,{recursive:true});server=await startRecoveryServer({root:process.env.RAIL_DIST||'dist',port:0});browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});const png=new PNG({width:960,height:640});png.data.fill(210);image=PNG.sync.write(png);});
after(async()=>{await browser?.close();await server?.close();await fs.writeFile(path.join(output,'results.json'),JSON.stringify(records,null,2));});
async function settle(page){await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));}
async function geometry(page){return page.evaluate(()=>{
 const rail=document.querySelector('.asp-workspace__rail'),r=rail.getBoundingClientRect(),style=getComputedStyle(rail),header=document.querySelector('.mobile-header').getBoundingClientRect(),tabs=document.querySelector('.bottom-tabs').getBoundingClientRect();
 const safeTop=header.bottom+8,safeBottom=tabs.top-8;const hidden=Number(style.opacity)<0.1;
 const points=[];let visibleButtons=0;
 for(const button of rail.querySelectorAll('button.asp-rail__tool')){const b=button.getBoundingClientRect();if(b.left<r.left+1||b.right>r.right-1)continue;visibleButtons++;for(const [x,y]of [[b.left+b.width/2,b.top+b.height/2],[b.left+b.width/2,b.top+2],[b.left+b.width/2,b.bottom-2],[b.left+2,b.top+b.height/2],[b.right-2,b.top+b.height/2]]){if(x<0||x>innerWidth||y<0||y>innerHeight)continue;const hit=document.elementFromPoint(x,y);points.push({hit:hit===button||button.contains(hit),x,y,blockedBy:hit?.closest('header,nav')?.className||hit?.tagName});}}
 return{scrollY,top:r.top,bottom:r.bottom,height:r.height,hidden,pointerEvents:style.pointerEvents,safeTop,safeBottom,inside:r.top>=safeTop-.5&&r.bottom<=safeBottom+.5,visibleButtons,points,scrollWidth:rail.scrollWidth,clientWidth:rail.clientWidth};
});}
for(const [width,lang,theme]of cases)test(`${width} ${lang}: compact rail and all tools avoid both shell bars`,{timeout:120000},async()=>{
 const context=await browser.newContext({viewport:{width,height:750},deviceScaleFactor:2,isMobile:true,hasTouch:true,serviceWorkers:'block'});const page=await context.newPage();const record={width,lang,theme};
 try{
  await context.addInitScript(theme=>{if(window===window.top)localStorage.setItem('worklazy-theme',theme);},theme);await context.route('**/*',r=>new URL(r.request().url()).origin===server.url?r.continue():r.abort());
  await page.goto(`${server.url}/${lang}/tools/image-studio/`,{waitUntil:'domcontentloaded'});await page.locator('.asp-image-editor .lower-canvas').waitFor();await page.locator('[data-testid=library-image-editor] input[type=file]').first().setInputFiles({name:'rail-fixture.png',mimeType:'image/png',buffer:image});await page.waitForFunction(()=>!document.querySelector('[data-testid=image-editor-add-to-batch]')?.disabled);await page.evaluate(async()=>{await document.fonts.ready;await Promise.all(document.getAnimations().filter(a=>a.effect?.getComputedTiming().iterations!==Infinity).map(a=>a.finished.catch(()=>{})));});await page.evaluate(()=>scrollTo({top:0,behavior:'instant'}));await settle(page);
  const bounds=await page.locator('.asp-workspace').evaluate(el=>({top:el.getBoundingClientRect().top+scrollY,height:el.getBoundingClientRect().height}));record.states=[];
  for(let y=Math.max(0,bounds.top-750+50);y<=bounds.top+bounds.height+100;y+=37){await page.evaluate(y=>scrollTo({top:y,behavior:'instant'}),y);await settle(page);record.states.push(await geometry(page));}
  record.maxHeight=Math.max(...record.states.map(s=>s.height));record.blocked=record.states.filter(s=>!s.hidden).flatMap(s=>s.points).filter(p=>!p.hit);record.shown=record.states.filter(s=>!s.hidden&&s.inside).length;
  assert.ok(record.maxHeight<=80,`rail occupies ${record.maxHeight}px instead of one compact row`);
  assert.ok(record.shown>=2,'strip must actually appear in the safe editor viewport');assert.equal(record.blocked.length,0,'painted tools must not be behind the header or bottom tabs');
  assert.ok(record.states.every(s=>s.hidden?!s.inside&&s.pointerEvents==='none':s.inside),'out-of-band transitions hide the entire strip instead of exposing clipped controls');
  // A keyboard user can reach an offscreen strip and all horizontally hidden tools.
  const rail=page.locator('.asp-workspace__rail'),buttons=rail.locator('button.asp-rail__tool');assert.equal(await buttons.count(),10);await buttons.first().focus();await settle(page);record.focus=await geometry(page);assert.equal(record.focus.hidden,false);assert.equal(record.focus.inside,true);
  const seen=new Set();record.keyboard=[];
  for(let step=0;step<35&&seen.size<10;step++){
   const info=await page.evaluate(()=>{const b=document.activeElement;if(!b?.matches('button.asp-rail__tool'))return null;const r=b.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return{title:b.getAttribute('title'),hit:hit===b||b.contains(hit)};});
   if(info){seen.add(info.title);record.keyboard.push(info);assert.equal(info.hit,true,'focused horizontal tools are visible and reachable');}
   await page.keyboard.press('Tab');await settle(page);
  }
  assert.equal(seen.size,10,'no tool is removed by compacting');
  record.menus=[];
  const toggles=rail.locator('button.asp-rail__flyout-toggle');assert.ok(await toggles.count()>0);
  for(let i=0;i<await toggles.count();i++){
   await toggles.nth(i).focus();await toggles.nth(i).click();const menu=rail.getByRole('menu');await menu.waitFor();await settle(page);
   const metrics=await menu.evaluate(el=>{const r=el.getBoundingClientRect(),h=document.querySelector('.mobile-header').getBoundingClientRect(),n=document.querySelector('.bottom-tabs').getBoundingClientRect();return{top:r.top,bottom:r.bottom,headerBottom:h.bottom,navTop:n.top,popover:el.matches(':popover-open')};});record.menus.push(metrics);assert.ok(metrics.top>=metrics.headerBottom&&metrics.bottom<=metrics.navTop,'submenus also stay clear of shell chrome');assert.equal(metrics.popover,true);
   for(const item of await menu.getByRole('menuitem').all()){await item.scrollIntoViewIfNeeded();assert.equal(await item.evaluate(el=>{const r=el.getBoundingClientRect(),h=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);return h===el||el.contains(h);}),true,'all menu choices remain clickable');}
   await page.keyboard.press('Escape');await menu.waitFor({state:'hidden'});
  }
  if(width===320&&lang==='en'){
   await toggles.first().focus();await toggles.first().click();await rail.getByRole('menu').waitFor();
   await page.setViewportSize({width:1440,height:750});await settle(page);
   assert.equal(await rail.getByRole('menu').count(),0,'leaving mobile dismisses its menu');
   assert.equal(await rail.getAttribute('data-mobile-rail'),null,'desktop has no compact viewport guard');
   record.responsiveRestore=true;await page.setViewportSize({width,height:750});await settle(page);
  }
  await buttons.first().focus();await settle(page);record.documentWidth=await page.evaluate(()=>document.documentElement.scrollWidth);assert.ok(record.documentWidth<=width);
  await page.screenshot({path:path.join(output,`${width}-${lang}.png`)});record.passed=true;
 }catch(error){record.passed=false;record.error=error.message;await page.screenshot({path:path.join(output,`${width}-${lang}-failure.png`)}).catch(()=>{});throw error;}
 finally{records.push(record);await context.close();}
});
