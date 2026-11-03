import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { startRecoveryServer } from './recovery-server.mjs';
const output=path.resolve(process.env.KRX_RULE_SHOTS || 'scratch/krxrule/browser');
const records=[];let browser,server;
const rootUrl='https://rule.krx.co.kr/out/index.do';
const kind='https://kind.krx.co.kr/external/2025/12/18/000081/20251204000985/70780.htm';
const article='제4조(시장의 구분 및 매매거래시간)';
const quote=article+'\nSynthetic calendar citation. <b>Literal source markup</b>';
const digest=raw=>createHash('sha256').update(raw).digest('hex');
let names;
before(async()=>{
 await fs.mkdir(output,{recursive:true});names=JSON.parse(await fs.readFile('src/features/market-calendar/krxRuleNames.json','utf8'));
 server=await startRecoveryServer({root:'dist',port:0});browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
});
after(async()=>{await browser?.close();await server?.close();await fs.writeFile(path.join(output,'results.json'),JSON.stringify(records,null,2));});
const cases=[['ko',320,'light-coral','present'],['en',1280,'dark-coral','present'],['en',320,'light-coral','missing'],['ko',1280,'dark-coral','corrupt'],['en',320,'dark-coral','schema-invalid']];
for(const [lang,width,theme,mode] of cases)test(`${lang} ${width} ${mode}: KRX saved source and keyboard copy`,{timeout:90000},async()=>{
 const context=await browser.newContext({viewport:{width,height:800},permissions:['clipboard-read','clipboard-write'],serviceWorkers:'block'});
 const page=await context.newPage();const record={lang,width,theme,mode};
 try{
  await page.addInitScript(theme=>{if(window===window.top)localStorage.setItem('worklazy-theme',theme);},theme);
  const row={date:'20260102',venue:'krx',status:'open',sessions:[{code:'regular',start:'09:00:00',end:'15:30:00',tz:'Asia/Seoul'}],special:null,reason:null,notes:[],sources:[
   {id:'krx-rule-210025251',url:'https://rule.krx.co.kr/out/regulation/regulationViewPop.do',quote:lang==='en'&&mode==='present'?'Synthetic calendar citation.':quote},
   {id:'krx-rule-210019450',url:'https://rule.krx.co.kr/out/regulation/regulationViewPop.do',quote},
   {id:'kind-fixture',url:kind,quote:'Synthetic KIND citation'},
   {id:'annual-fixture',url:'https://open.krx.co.kr/contents/OPN/99/OPN99000001.jspx',quote:'Synthetic annual citation'},
  ]};
  if(lang==='ko'&&mode==='present'){row.status='closed';row.sessions=[]}
  const calendar=JSON.stringify([row]);const manifest={schema_version:1,generation_id:'krx-smoke',created_at:new Date().toISOString(),files:[{year:2026,path:'calendar-2026.json',sha256:digest(calendar)}],scopes:[{venue:'krx',year:2026,included:true,validity:'valid',last_checked_at:new Date().toISOString(),reason:null}]};
  const catalogValue=({schema_version:1,generation_id:manifest.generation_id,sources:row.sources.slice(0,2).map(source=>({id:source.id,...names[source.id],fetched_at:'2026-11-03T00:00:00Z',raw_sha256:'a'.repeat(64),text_sha256:'b'.repeat(64),representation:'session_redacted',excerpts:[{article,text:quote+'\n'}]}))});
  if(mode==='schema-invalid')catalogValue.sources[0].extra=true;
  const catalog=JSON.stringify(catalogValue);
  await context.route('**/*',route=>{
   const u=new URL(route.request().url());if(u.origin!==server.url)return route.abort();
   if(u.pathname.includes('/data/market-calendar/v1/')){
    const name=u.pathname.split('/').at(-1);
    if(name==='manifest.json')return route.fulfill({contentType:'application/json',body:JSON.stringify(manifest)});
    if(name==='calendar-2026.json')return route.fulfill({contentType:'application/json',body:calendar});
    if(mode==='missing')return route.fulfill({status:404,body:''});
    return route.fulfill({contentType:name.endsWith('.json')?'application/json':'text/plain',body:name.endsWith('.json')?catalog:mode==='corrupt'?'0'.repeat(64):digest(catalog)});
   }
   return route.continue();
  });
  const optional=page.waitForResponse(r=>r.url().endsWith(mode==='missing'?'sources-v1.sha256':'sources-v1.json'));
  await page.goto(`${server.url}/${lang}/tools/market-calendar/?venue=krx&year=2026&month=1&day=2`,{waitUntil:'domcontentloaded'});
  await page.locator('.mcal-sources').waitFor();await optional;
  const primary=page.locator('.mcal-rule-source').first();const copy=primary.getByRole('button');
  assert.equal(await page.locator('.mcal-rule-source').count(),2,'different KRX books must not collapse by identical POST URL');
  assert.equal(await page.locator('a[href*="regulationViewPop.do"]').count(),0);
  assert.equal(await page.locator(`a[href="${rootUrl}"]`).count(),2);
  assert.equal(await page.locator(`a[href="${kind}"]`).count(),1,'GET source stays unchanged');
  if(mode==='present'){
   const saved=primary.locator('summary');await saved.waitFor();
   await primary.getByRole('link').focus();await page.keyboard.press('Tab');assert.equal(await copy.evaluate(el=>el===document.activeElement),true);
   await page.keyboard.press(lang==='ko'?'Enter':'Space');
   const expected=names['krx-rule-210025251'].title+' · '+article;
   await page.waitForFunction(expected=>document.querySelector('.mcal-rule-source [role=status]')?.textContent?.length>0,expected);
   assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),expected);
   await page.keyboard.press('Tab');assert.equal(await saved.evaluate(el=>el===document.activeElement),true);await page.keyboard.press('Enter');
   assert.equal(await primary.locator('.mcal-saved-copy').isVisible(),true);
   assert.equal(await primary.locator('pre').textContent(),quote+'\n');assert.equal(await primary.locator('pre b').count(),0,'archived text is never interpreted as HTML');
   assert.equal(await primary.getByRole('heading',{level:3,name:article,exact:true}).count(),1,'closed-day source headings must follow the enclosing h2 without skipping a level');
   assert.match(await primary.locator('code').innerText(),/^a{64}$/);
   assert.equal(await primary.locator('time').getAttribute('datetime'),'2026-11-03T00:00:00Z');
  }else{
   await page.waitForTimeout(200);assert.equal(await primary.locator('summary').count(),0,'bad optional evidence must be hidden');assert.equal(await copy.isVisible(),true);
  }
  if(lang==='en'){
   const visibleUI=await primary.evaluate(element=>{const values=[];const walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT);let node;while((node=walker.nextNode()))if(!node.parentElement?.closest('[data-mcal-original]'))values.push(node.textContent);return values.join(' ');});
   assert.doesNotMatch(visibleUI,/[가-힣]/,'EN controls stay English while official Korean data is explicitly marked');
  }
  const more=page.locator('.mcal-sources > details > summary');await more.click();
  const firstName=await page.locator(`a[href="${kind}"]`).innerText();
  const secondName=await page.locator('a[href="https://open.krx.co.kr/contents/OPN/99/OPN99000001.jspx"]').innerText();
  assert.notEqual(firstName,secondName,'general source links have distinguishable accessible names');
  assert.equal(await page.getByRole('link',{name:firstName,exact:true}).count(),1);
  assert.equal(await page.getByRole('link',{name:secondName,exact:true}).count(),1);
  record.normalLinkNames=[firstName,secondName];await more.click();
  await primary.scrollIntoViewIfNeeded();record.documentWidth=await page.evaluate(()=>document.documentElement.scrollWidth);assert.ok(record.documentWidth<=width,'reference and hash must wrap on mobile');
  await page.screenshot({path:path.join(output,`${lang}-${width}-${theme}-${mode}.png`)});record.passed=true;
 }catch(error){record.passed=false;record.error=error.message;await page.screenshot({path:path.join(output,`${lang}-${width}-${mode}-failure.png`)}).catch(()=>{});throw error;}
 finally{records.push(record);await context.close();}
});
