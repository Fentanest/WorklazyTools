import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {chromium} from 'playwright';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:5189';
const output=path.resolve(process.env.WORK_TEST_OUTPUT||'docs/jobs/todo/work-calculator/after');await fs.mkdir(output,{recursive:true});
const report={cases:[],layouts:[],performance:[],pageErrors:[]};
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({reducedMotion:'reduce',serviceWorkers:'block'});await context.route('**/*',r=>{const u=new URL(r.request().url());return /^https?:$/.test(u.protocol)&&u.origin!==base?r.abort():r.continue();});
await context.addInitScript(()=>{window.__WORKLAZY_MOCK_PROVIDERS__=true;});
const page=await context.newPage();page.on('pageerror',e=>report.pageErrors.push(String(e)));page.setDefaultTimeout(15000);
async function open(lang='ko'){await page.goto(`${base}/${lang}/tools/work-calculator`);await page.getByTestId('work-core').waitFor();}
async function test(name,fn){if(process.env.WORK_TEST_FILTER&&!new RegExp(process.env.WORK_TEST_FILTER).test(name))return;try{await fn();report.cases.push({name,status:'PASS'});console.log('PASS',name);}catch(e){report.cases.push({name,status:'FAIL',error:String(e),stack:e.stack});console.error('FAIL',name,e);await page.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{});}await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));}
async function fillPeriod(start,end){await page.locator('#work-start').fill(start);await page.locator('#work-end').fill(end);}
const result=()=>page.getByTestId('work-result-region');
await test('business official boundaries, persistent empty/invalid states and real zero',async()=>{
 await open();for(const [date,count] of [['2026-05-01',0],['2026-07-17',0],['2026-06-03',0],['2025-01-27',0],['2025-06-03',0],['2020-03-02',1],['2022-12-26',1]]){await fillPeriod(date,date);assert.equal(await page.locator('.work-primary-value').innerText(),`${count}일`);}
 const box=await result().boundingBox();await page.locator('#work-start').fill('');assert.equal(await result().count(),1);assert.match(await result().innerText(),/시작일.*입력/);assert.doesNotMatch(await result().innerText(),/NaN|undefined|0일/);assert.equal(await page.locator('#work-start').getAttribute('aria-invalid'),'true');const emptyBox=await result().boundingBox();assert.equal(emptyBox.x,box.x);assert.equal(emptyBox.y,box.y);
 await fillPeriod('2026-02-01','2026-01-01');assert.match(await result().innerText(),/빠를 수 없습니다/);await fillPeriod('2026-01-04','2026-01-04');assert.equal(await page.locator('.work-primary-value').innerText(),'0일');
});
await test('English range errors interpolate dates and invalid height follows actual resized ready layout',async()=>{
 await open('en');await page.locator('#work-start').fill('1999-12-31');await page.waitForFunction(()=>document.querySelector('#work-start').getAttribute('aria-invalid')==='true');const error=await result().innerText();assert.match(error,/2000-01-01/);assert.match(error,/2050-12-31/);assert.doesNotMatch(error,/\{\{/);
 await open();await page.getByTestId('work-mode').getByRole('button').nth(1).click();await page.locator('#work-hire').fill('2025-12-31');await page.locator('#work-asOf').fill('2026-11-30');await page.getByTestId('leave-method').getByRole('button').nth(1).click();
 for(const width of [1440,390,1440]){
  await page.setViewportSize({width,height:900});await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const height=await result().evaluate(e=>e.getBoundingClientRect().height);await page.locator('#work-hire').fill('');await page.waitForFunction(()=>document.querySelector('#work-hire').getAttribute('aria-invalid')==='true');
  const invalid=await result().evaluate(e=>e.getBoundingClientRect().height);assert.ok(Math.abs(height-invalid)<=1,`${width}: ${height} -> ${invalid}`);
  await page.locator('#work-hire').fill('2025-12-31');await page.waitForFunction(()=>document.querySelector('#work-hire').getAttribute('aria-invalid')==='false');
 }
 await page.evaluate(()=>{window.__workNativeResizeObserver=ResizeObserver;window.ResizeObserver=undefined;});
 try{await page.locator('#work-hire').fill('');await page.waitForFunction(()=>document.querySelector('#work-hire').getAttribute('aria-invalid')==='true');await page.locator('#work-hire').fill('2025-12-31');await page.waitForFunction(()=>document.querySelector('#work-hire').getAttribute('aria-invalid')==='false');await page.locator('#work-asOf').fill('2025-12-31');await page.waitForFunction(()=>document.querySelector('.work-primary-value')?.textContent==='0일');const h=await result().evaluate(e=>e.getBoundingClientRect().height);await page.locator('#work-hire').fill('');await page.waitForFunction(()=>document.querySelector('#work-hire').getAttribute('aria-invalid')==='true');assert.ok(Math.abs((await result().evaluate(e=>e.getBoundingClientRect().height))-h)<=1);}finally{await page.evaluate(()=>{window.ResizeObserver=window.__workNativeResizeObserver;});}

});
await test('custom holiday draft atomic paste duplicate/outside/remove and reason preservation',async()=>{
 await open();await fillPeriod('2025-05-03','2025-05-09');const original=await page.locator('.work-primary-value').innerText();await page.locator('.work-extra summary').click();
 await page.locator('#work-custom-text').fill('2026-');assert.equal(await page.locator('.work-primary-value').innerText(),original);assert.equal(await page.locator('#work-custom-error').count(),0);
 await page.locator('#work-custom-text').fill('2025-05-05, 2025-05-07\n2025-05-07 2024-12-31');await page.locator('.work-paste-row button').click();assert.equal(await page.locator('.work-holiday-chips li').count(),3);assert.match(await page.locator('.work-holiday-chips').innerText(),/기간 밖/);assert.equal(await page.locator('.work-primary-value').innerText(),'2일');
 await page.locator('#work-custom-text').fill('2025-05-08 2025-02-30');await page.locator('.work-paste-row button').click();assert.equal(await page.locator('.work-holiday-chips li').count(),3);assert.match(await page.locator('#work-custom-error').innerText(),/2025-02-30/);assert.equal(await page.locator('.work-primary-value').innerText(),'2일');
 await page.locator('.work-details').first().locator('summary').click();await page.waitForFunction(()=>document.querySelectorAll('.work-details tbody tr').length===5);const text=await page.locator('.work-details tbody').innerText();assert.match(text,/어린이날/);assert.match(text,/부처님/);assert.match(text,/직접 추가/);
 await page.getByRole('button',{name:/2025-05-07.*삭제/}).click();assert.equal(await page.locator('.work-primary-value').innerText(),'3일');
});
await test('fiscal monthly history independent, tiny proportion, birth-month periods and empty recovery',async()=>{
 await open();await page.getByTestId('work-mode').getByRole('button',{name:'연차 계산',exact:true}).click();await page.locator('#work-hire').fill('2025-07-01');await page.locator('#work-asOf').fill('2026-01-01');await page.getByTestId('leave-method').getByRole('button',{name:'회계연도 기준',exact:true}).click();
 assert.equal(await page.locator('.work-primary-value').innerText(),'7.56일');assert.equal(await page.locator('.work-monthly-summary p').innerText(),'6일');assert.match(await result().innerText(),/잔여.*아닙니다|잔여.*계산하지/);
 await page.locator('#work-asOf').fill('2026-06-01');assert.equal(await page.locator('.work-monthly-summary p').innerText(),'11일');await page.locator('#work-asOf').fill('2026-07-01');assert.equal(await page.locator('.work-primary-value').innerText(),'7.56일');
 await page.getByTestId('leave-method').getByRole('button',{name:'입사일 기준',exact:true}).click();assert.equal(await page.locator('.work-primary-value').innerText(),'15일');assert.equal(await page.locator('.work-monthly-summary p').innerText(),'11일');
 await page.locator('#work-hire').fill('2025-12-31');await page.locator('#work-asOf').fill('2026-11-30');await page.getByTestId('leave-method').getByRole('button',{name:'회계연도 기준',exact:true}).click();assert.equal(await page.locator('.work-primary-value').innerText(),'0.04일');assert.equal(await page.locator('.work-monthly-summary p').innerText(),'10일');
 const readyBox=await result().boundingBox();await page.locator('#work-hire').fill('');await page.waitForFunction(()=>document.querySelector('#work-hire').getAttribute('aria-invalid')==='true');const emptyLeaveBox=await result().evaluate(e=>({height:e.getBoundingClientRect().height}));assert.ok(Math.abs(emptyLeaveBox.height-readyBox.height)<=1,JSON.stringify({readyBox,emptyLeaveBox,style:await result().evaluate(e=>({inline:e.style.minHeight,box:getComputedStyle(e).boxSizing}))}));assert.match(await result().innerText(),/입사일.*입력/);assert.doesNotMatch(await result().innerText(),/NaN|undefined/);await page.locator('#work-hire').fill('2026-01-31');await page.locator('#work-asOf').fill('2026-02-28');await page.getByTestId('leave-method').getByRole('button',{name:'입사일 기준',exact:true}).click();assert.equal(await page.locator('.work-primary-value').innerText(),'0일');await page.locator('#work-asOf').fill('2026-03-01');assert.equal(await page.locator('.work-primary-value').innerText(),'1일');
});
await test('mode preserves input and drafts; collapsed details render nothing, opened paging is bounded',async()=>{
 await open();await fillPeriod('2000-01-01','2050-12-31');assert.equal(await page.locator('.work-details tbody tr').count(),0);await page.locator('.work-details').first().locator('summary').click();await page.waitForFunction(()=>document.querySelectorAll('.work-details tbody tr').length===40);await page.locator('.work-pagination button').last().click();assert.equal(await page.locator('.work-details tbody tr').count(),40);await page.locator('.work-details').first().locator('summary').click();await page.waitForFunction(()=>document.querySelectorAll('.work-details tbody tr').length===0);
 await page.locator('.work-extra summary').click();await page.locator('#work-custom-text').fill('2026-');await page.getByTestId('work-mode').getByRole('button',{name:'연차 계산',exact:true}).click();await page.locator('#work-hire').fill('2025-07-01');await page.getByTestId('work-mode').getByRole('button',{name:'영업일 계산',exact:true}).click();assert.equal(await page.locator('#work-start').inputValue(),'2000-01-01');await page.locator('.work-extra summary').click();assert.equal(await page.locator('#work-custom-text').inputValue(),'2026-');
});
await test('keyboard order, focus retention and toggle accessibility',async()=>{
 await open();await page.locator('#work-start').focus();await page.keyboard.press('Tab'); // native date may visit subfields; use actual focusable DOM order as well
 const ids=await page.locator('.work-core input').evaluateAll(es=>es.filter(e=>e.type==='date').map(e=>e.id));assert.deepEqual(ids.slice(0,2),['work-start','work-end']);
 await page.locator('#work-end').focus();await page.locator('#work-end').fill('2026-12-31');assert.equal(await page.evaluate(()=>document.activeElement.id),'work-end');for(let i=0;i<6&&await page.evaluate(()=>document.activeElement.id==='work-end');i++)await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.textContent),'이번 달');await page.keyboard.press('Enter');assert.equal((await page.locator('#work-start').inputValue()).slice(8),'01');
 await page.getByTestId('work-mode').getByRole('button',{name:'영업일 계산',exact:true}).focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('Space');await page.locator('#work-hire').waitFor();assert.equal(await page.evaluate(()=>document.activeElement.tagName),'BUTTON');
});
await test('both modes KO/EN light/dark all viewports and zoom-like narrow desktop geometry',async()=>{
 for(const lang of ['ko','en'])for(const theme of ['light-coral','dark-coral'])for(const [width,height] of [[1920,1080],[1440,900],[1280,800],[800,1000],[390,844],[320,800],[720,540]])for(const mode of ['business','leave']){
  await page.setViewportSize({width,height});await open(lang);await page.evaluate(theme=>{document.documentElement.dataset.theme=theme;localStorage.setItem('worklazy-theme',theme);},theme);if(mode==='leave')await page.getByTestId('work-mode').getByRole('button').nth(1).click();
  const values=await page.evaluate(()=>{const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height};};const inputs=[...document.querySelectorAll('.work-date-row input')];const b={core:box(document.querySelector('.work-core')),mode:box(document.querySelector('.work-mode')),inputs:inputs.map(box),result:box(document.querySelector('.work-result')),scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth,bodyFont:getComputedStyle(inputs[0]).fontSize};return b;});
  assert.ok(values.core.w<=760.1);assert.ok(values.mode.w<=340.1);assert.ok(values.scrollWidth<=width,`${lang} ${theme} ${width} ${mode}`);if(width<=620)for(const b of values.inputs)assert.ok(b.h>=44);if(width>=1280)assert.ok(values.result.y+values.result.h<=height,`first screen ${lang} ${width} ${mode}`);
  report.layouts.push({lang,theme,width,height,calculatorMode:mode,...values});if(lang==='ko'&&theme==='light-coral'&&[1920,1440,1280,800,390,320].includes(width)||lang==='en'&&theme==='dark-coral'&&[1440,320].includes(width))await page.screenshot({path:path.join(output,`${lang}-${theme}-${width}-${mode}.png`),fullPage:true});
 }
});
await test('local holiday calculation survives unsupported Dangi and offline operation',async()=>{
 await page.addInitScript(()=>{const Native=Intl.DateTimeFormat;Intl.DateTimeFormat=function(locales,options){if(String(locales).includes('dangi')||options?.calendar==='dangi')throw new RangeError('Dangi unavailable (test)');return new Native(locales,options);};Intl.DateTimeFormat.prototype=Native.prototype;Intl.DateTimeFormat.supportedLocalesOf=Native.supportedLocalesOf.bind(Native);});
 await open();await context.setOffline(true);try{await fillPeriod('2033-09-08','2033-09-08');assert.equal(await page.locator('.work-primary-value').innerText(),'0일');assert.match(await result().innerText(),/예상/);await page.locator('.work-details').first().locator('summary').click();await page.waitForFunction(()=>document.querySelectorAll('.work-details tbody tr').length===1);assert.match(await page.locator('.work-details tbody').innerText(),/추석/);}finally{await context.setOffline(false);}
});
await test('calculator accessibility has no serious or critical violations in both modes and languages',async()=>{
 const {default:AxeBuilder}=await import('@axe-core/playwright');
 for(const lang of ['ko','en'])for(const mode of ['business','leave']){
  await page.setViewportSize({width:1280,height:900});await open(lang);if(mode==='leave')await page.getByTestId('work-mode').getByRole('button').nth(1).click();
  const scan=await new AxeBuilder({page}).include('[data-tool-page="work-calculator"]').analyze();assert.deepEqual(scan.violations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)})),[]);
 }
});
if(!process.env.WORK_PRODUCTION) await test('inactive business calculation and uncommitted holiday draft do not execute the summary',async()=>{
 const pattern='**/src/features/work-calculator/workCalculator.ts*';
 await page.route(pattern,async route=>{const response=await route.fetch();const body=await response.text();const next=body.replace(/(export function calculateBusinessDays\([^\n]*\) \{)/,'$1\n globalThis.__workBusinessCalls=(globalThis.__workBusinessCalls||0)+1;').replace(/(export function calculateAnnualLeave\([^\n]*\) \{)/,'$1\n globalThis.__workLeaveCalls=(globalThis.__workLeaveCalls||0)+1;');assert.notEqual(next,body,'instrumentation must reach the real module');await route.fulfill({response,body:next});});
 try{
  await open();await page.waitForFunction(()=>window.__workBusinessCalls>0);assert.equal(await page.evaluate(()=>window.__workLeaveCalls||0),0);
  await page.locator('.work-extra summary').click();const active=await page.evaluate(()=>window.__workBusinessCalls);await page.locator('#work-custom-text').fill('2026-');assert.equal(await page.evaluate(()=>window.__workBusinessCalls),active);
  await page.getByTestId('work-mode').getByRole('button',{name:'연차 계산',exact:true}).click();const hidden=await page.evaluate(()=>window.__workBusinessCalls);await page.locator('#work-hire').fill('2025-07-01');await page.locator('#work-asOf').fill('2026-06-01');
  await page.evaluate(async()=>{const {default:i18n}=await import('/src/i18n/config.ts');await i18n.changeLanguage('en');});await page.waitForFunction(()=>window.__workLeaveCalls>0&&document.querySelector('#work-hire')?.value==='2025-07-01');await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert.equal(await page.evaluate(()=>window.__workBusinessCalls),hidden);
 }finally{await page.unroute(pattern);}
});
if(!process.env.WORK_PRODUCTION) await test('browser cold/warm summaries, lazy details, draft editing and long supported range performance',async()=>{
 await open();const data=await page.evaluate(async()=>{const m=await import('/src/features/work-calculator/workCalculator.ts');const rows=[];for(const years of [1,10,30,51])for(const pass of ['cold','warm']){const start=performance.now(),r=m.calculateBusinessDays('2000-01-01',`${1999+years}-12-31`);const summaryMs=performance.now()-start,at=performance.now();r.excludedPage(0,40);rows.push({years,pass,summaryMs,detailMs:performance.now()-at,total:r.total,excluded:r.excludedCount});}return rows;});report.performance=data;
 await page.setViewportSize({width:1440,height:900});await fillPeriod('2000-01-01','2050-12-31');await page.locator('.work-extra summary').click();const value=await page.locator('.work-primary-value').innerText();const start=performance.now();await page.locator('#work-custom-text').fill('2026-');const ms=performance.now()-start;assert.equal(await page.locator('.work-primary-value').innerText(),value);assert.equal(await page.locator('.work-details tbody tr').count(),0);report.performance.push({draftEditMs:ms});
});
await browser.close();console.log(`# tests ${report.cases.length}\n# pass ${report.cases.filter(x=>x.status==='PASS').length}\n# fail ${report.cases.filter(x=>x.status==='FAIL').length}`);if(!report.cases.length||report.cases.some(x=>x.status==='FAIL')||report.pageErrors.length)process.exitCode=1;
