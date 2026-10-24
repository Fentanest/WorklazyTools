import assert from 'node:assert/strict';import {createServer} from 'vite';import {chromium} from 'playwright';
if(process.env.WORKLAZY_COMPARISON_PORT!=='off')throw Error('Run with WORKLAZY_COMPARISON_PORT=off');
const server=await createServer({cacheDir:'docs/jobs/todo/diffchecker-port-20261023/publication-vite-cache',server:{host:'127.0.0.1',port:5276,strictPort:true}});await server.listen();
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});let checks=0;
try{
 const context=await browser.newContext({serviceWorkers:'block'});await context.addInitScript(()=>{window.__WORKLAZY_MOCK_PROVIDERS__=true;window.__workers=0;const Native=Worker;window.Worker=class extends Native{constructor(...args){super(...args);window.__workers++;}};});await context.route('**/*',route=>{const u=new URL(route.request().url());return ['http:','https:'].includes(u.protocol)&&u.origin!=='http://127.0.0.1:5276'?route.abort():route.continue();});
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 for(const lang of ['ko','en'])for(const id of ['text-compare','text-compare/results/1','image-compare','folder-compare']){
  await page.goto(`http://127.0.0.1:5276/${lang}/tools/${id}/`);await page.getByRole('heading',{name:lang==='ko'?'현재 제공하지 않는 도구입니다':'This tool is currently unavailable'}).waitFor();assert.equal(await page.locator('[data-tool-page]').count(),0);assert.equal(await page.locator('meta[name=robots]').getAttribute('content'),'noindex, nofollow');checks+=2;
 }
 assert.equal(await page.evaluate(()=>window.__workers),0);checks++;const readiness=await page.evaluate(async()=>{const p=await import('/src/app/publicService.ts');return{ads:p.documentReadiness('/en/tools/text-compare/results/1',{redactor:false,office:false,excel:false},false),analytics:p.safeAnalyticsPage('/en/tools/text-compare/results/1')};});assert.deepEqual(readiness,{ads:'unavailable',analytics:null});checks++;
 for(const lang of ['ko','en'])for(const id of ['document-compare','word-compare','excel-compare','pdf-compare']){await page.goto(`http://127.0.0.1:5276/${lang}/tools/${id}/`);await page.locator('[data-tool-page]').first().waitFor();checks++;}
 await page.goto('http://127.0.0.1:5276/en/tools/');await page.getByRole('heading').first().waitFor();assert.equal(await page.locator('a[href*="/tools/text-compare"],a[href*="/tools/folder-compare"],a[href*="/tools/image-compare"]').count(),0);assert.ok(await page.locator('a[href*="/tools/document-compare"]').count()>0);checks++;
 assert.deepEqual(errors,[]);console.log(`${checks} passed comparison publication-off browser checks`);await context.close();
}finally{await browser.close();await server.close();}
