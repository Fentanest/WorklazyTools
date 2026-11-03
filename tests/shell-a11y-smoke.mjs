import test,{before,after} from 'node:test';import assert from 'node:assert/strict';
import fs from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {chromium} from 'playwright';import {PNG} from 'pngjs';
import {startRecoveryServer} from './recovery-server.mjs';
import {beginFocusAudit,auditTabCycle} from './helpers/shell-focus-audit.mjs';
import {stateWith} from './fixtures/product-banner/state.ts';
import {saveProjectJson} from '../src/features/product-banner/projectJson.ts';
import {createDefaultSettings} from '../src/features/product-banner/settings.ts';
const phase=process.env.SHELL_PHASE||'after';
const output=path.resolve(process.env.SHELL_OUTPUT||`scratch/shell-a11y/${phase}`);
const tools=['text-tools','text-formatter','data-converter','payroll-calculator','timezone-calculator','product-banner'];
const matrix=phase==='before'?[['en','light-coral']]:[['ko','light-coral'],['ko','dark-coral'],['en','light-coral'],['en','dark-coral']];
let server,context,profiles;const records=[];const denied=new Set();
// Playwright's inferred clip is wrong with viewport:null and native site zoom.
// Capture the compositor viewport directly, preserving the real 200% pixels.
async function captureViewport(page,file){
 const cdp=await page.context().newCDPSession(page);
 try{const shot=await cdp.send('Page.captureScreenshot',{format:'png',fromSurface:true,captureBeyondViewport:false});await fs.writeFile(file,Buffer.from(shot.data,'base64'));}
 finally{await cdp.detach();}
}
before(async()=>{
 await fs.mkdir(output,{recursive:true});profiles=await fs.mkdtemp(path.join(os.tmpdir(),'shell-focus-'));
 const profile=path.join(profiles,'200');await fs.mkdir(`${profile}/Default`,{recursive:true});await fs.writeFile(`${profile}/Default/Preferences`,JSON.stringify({partition:{per_host_zoom_levels:{x:{'127.0.0.1':{zoom_level:Math.log(2)/Math.log(1.2)}}}}}));
 server=await startRecoveryServer({root:process.env.SHELL_DIST||'dist',port:0});
 context=await chromium.launchPersistentContext(profile,{executablePath:'/usr/bin/google-chrome',headless:true,viewport:null,serviceWorkers:'block',args:['--window-size=1280,1000','--no-sandbox','--disable-dev-shm-usage']});
 const png=new PNG({width:24,height:24});png.data.fill(200);const image=PNG.sync.write(png);
 await context.route('**/*',route=>{const u=new URL(route.request().url());if(!/^https?:$/u.test(u.protocol)||u.origin===server.url)return route.continue();denied.add(u.origin);if(route.request().resourceType()==='image')return route.fulfill({contentType:'image/png',body:image});return route.abort();});
});
after(async()=>{await context?.close();await server?.close();await fs.writeFile(path.join(output,'results.json'),JSON.stringify({phase,tools,matrix,records,externalOriginsBlocked:[...denied]},null,2));if(profiles)await fs.rm(profiles,{recursive:true,force:true});});
for(const [lang,theme] of matrix)for(const tool of tools)test(`${lang} ${theme} ${tool}: native 200% Tab and Shift+Tab`,{timeout:180000},async()=>{
 const page=await context.newPage(),record={lang,theme,tool};page.setDefaultTimeout(30000);
 try{
  await page.addInitScript(theme=>{if(window===window.top)localStorage.setItem('worklazy-theme',theme);},theme);
  await page.goto(`${server.url}/${lang}/tools/${tool}/`,{waitUntil:'domcontentloaded'});
  await page.locator('[data-tool-page]').waitFor();await page.evaluate(()=>document.fonts.ready);
  record.metrics=await page.evaluate(()=>({innerWidth,innerHeight,outerWidth,outerHeight,dpr:devicePixelRatio,scale:visualViewport.scale}));
  assert.equal(record.metrics.innerWidth*2,record.metrics.outerWidth,'real site zoom halves the layout viewport');assert.equal(record.metrics.dpr,2);assert.equal(record.metrics.scale,1);
  if(tool==='product-banner'){
   const project=stateWith(3).project;const settings=createDefaultSettings(lang,project.settings.design);project.settings={...project.settings,language:lang,affiliateNotice:settings.affiliateNotice};
   await page.locator('input[accept=".json"]').setInputFiles({name:'synthetic-shell.json',mimeType:'application/json',buffer:Buffer.from(saveProjectJson(project))});
   await page.getByTestId('banner-product').first().waitFor();
   const advanced=page.locator('details > summary').filter({hasText:lang==='ko'?'상세 설정':'Advanced settings'});if(await advanced.count())await advanced.click();
  }
  await captureViewport(page,path.join(output,`${lang}-${theme}-${tool}-200-top.png`));
  const start=await beginFocusAudit(page);assert.ok(start.expected.length>0,'positive native field selection');record.expectedFields=start.expected.length;
  let captured=false;
  const forward=await auditTabCycle(page,'forward',start.first,800,async row=>{if(row.field&&row.partial&&!captured){captured=true;await captureViewport(page,path.join(output,`${lang}-${theme}-${tool}-overlap.png`));}});const reverse=await auditTabCycle(page,'reverse',start.first);
  record.otherOverlaps=[...forward,...reverse].filter(r=>!r.field&&(r.partial||r.outsideViewport));
  record.tabStops=forward.length+reverse.length;record.fields=[...forward,...reverse].filter(r=>r.field);
  const seen=new Set(record.fields.map(r=>r.key));record.missingFields=start.expected.filter(id=>!seen.has(id));
  record.missingByDirection=[forward,reverse].map(rows=>start.expected.filter(id=>!rows.some(r=>r.field&&r.key===id)));
  assert.deepEqual(record.missingByDirection,[[],[]],'all initial fields must be visited in each direction');
  record.obscured=record.fields.filter(r=>r.partial||r.outsideViewport);record.fullyObscured=record.fields.filter(r=>r.fullyObscured||r.outsideViewport);
  assert.deepEqual(record.missingFields,[],'all visible enabled field tab stops must be visited');
  assert.equal(record.fullyObscured.length,0,'focused fields must not be fully obscured by fixed shell bars');
  assert.equal(record.obscured.length,0,'focused fields must have no partial overlap with fixed shell bars');
  record.passed=true;
 }catch(error){record.passed=false;record.error=error.message;await captureViewport(page,path.join(output,`${lang}-${theme}-${tool}-failure.png`)).catch(()=>{});throw error;}
 finally{records.push(record);await fs.writeFile(path.join(output,'results.json'),JSON.stringify({phase,tools,matrix,records,externalOriginsBlocked:[...denied]},null,2));await page.close();}
});
