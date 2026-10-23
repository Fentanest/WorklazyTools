import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import puppeteer from 'puppeteer-core';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:4173';
const out=path.resolve(process.env.TEXT_COMPARE_SCREENSHOTS||'docs/jobs/todo/diffchecker-port-20261023/text-ui');await fs.mkdir(out,{recursive:true});
const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'text-compare-'));
const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
let checks=0;
try{
 for(const language of ['ko','en']){
  const page=await browser.newPage();const errors=[],external=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',message=>{if(message.type()==='error')console.error('console',message.text());});
  await page.evaluateOnNewDocument(()=>{window.__WORKLAZY_MOCK_PROVIDERS__=true;});
  await page.setViewport({width:1360,height:1000});
  const cdp=await page.createCDPSession();await cdp.send('Fetch.enable',{patterns:[{urlPattern:'*',requestStage:'Request'}]});cdp.on('Fetch.requestPaused',event=>{const u=new URL(event.request.url);const remote=['http:','https:'].includes(u.protocol)&&u.origin!==new URL(base).origin;if(remote)external.push(u.origin);void cdp.send(remote?'Fetch.failRequest':'Fetch.continueRequest',remote?{requestId:event.requestId,errorReason:'BlockedByClient'}:{requestId:event.requestId}).catch(()=>{});});await cdp.send('Page.setDownloadBehavior',{behavior:'allow',downloadPath:temporary});
  const navigation=await page.goto(`${base}/${language}/tools/text-compare/`,{waitUntil:'domcontentloaded'});
  await page.waitForSelector('[data-tool-page="text-compare"]');
  if(process.env.EXPECT_STATIC==='1'){assert.equal(navigation.headers()['cross-origin-opener-policy'],undefined);assert.equal(await page.evaluate(()=>crossOriginIsolated),false);checks++;}
  const button=async label=>{const clicked=await page.$$eval('[data-tool-page="text-compare"] button',(buttons,label)=>{const b=buttons.find(b=>b.textContent.trim()===label);if(!b)return false;b.click();return true;},label);assert.ok(clicked,`Missing button ${label}`);};
  await page.type('[data-testid="text-compare-left"]','alpha SECRET\nold\nomega\n');
  await page.type('[data-testid="text-compare-right"]','alpha \nnew\nomega\n');
  const fields=await page.$$('[data-tool-page="text-compare"] textarea');await fields[2].type('SECRET');
  await button(language==='ko'?'비교하기':'Compare');
  await page.waitForSelector('[data-testid="text-compare-summary"]',{timeout:15000}).catch(async error=>{console.error('UI errors',errors);console.error(await page.$eval('[data-tool-page="text-compare"]',node=>node.innerText));throw error;});
  assert.equal(await page.$$eval('[data-row-id][data-kind="changed"]',nodes=>nodes.length),1);checks++;
  assert.equal(await page.$$eval('[data-row-id][data-kind="ignored"]',nodes=>nodes.length),1);checks++;
  await page.click('[data-row-id][data-kind="changed"] [data-side="left"] button');
  await page.waitForFunction(()=>document.querySelector('[data-testid="text-compare-left"]').value.includes('new'));
  await page.waitForFunction(()=>!document.querySelector('[data-row-id][data-kind="changed"]'),{timeout:15000}).catch(async error=>{console.error('MERGE STATE',await page.$eval('[data-tool-page="text-compare"]',node=>node.innerText));console.error(errors);throw error;});
  assert.equal(await page.$eval('[data-testid="text-compare-left"]',node=>node.value),'alpha SECRET\nnew\nomega\n');checks++;
  await button(language==='ko'?'되돌리기':'Undo');assert.equal(await page.$eval('[data-testid="text-compare-left"]',node=>node.value),'alpha SECRET\nold\nomega\n');checks++;
  await button(language==='ko'?'다시 적용':'Redo');assert.equal(await page.$eval('[data-testid="text-compare-left"]',node=>node.value),'alpha SECRET\nnew\nomega\n');checks++;
  const text=await page.$eval('[data-tool-page="text-compare"]',node=>node.textContent);
  assert.ok(!text.includes('textCompare.')&&!text.includes('features:'));checks++;
  assert.ok(text.includes(language==='ko'?'파일이나 글이 서버로 전송되나요?':'Are my files or text sent to a server?'));checks++;
  await button(language==='ko'?'TXT 저장':'Save TXT');
  const download=path.join(temporary,'comparison-left.txt');for(let n=0;n<40;n++){if(await fs.stat(download).then(()=>true,()=>false))break;await new Promise(resolve=>setTimeout(resolve,50));}
  assert.equal(await fs.readFile(download,'utf8'),'alpha SECRET\nnew\nomega\n');await fs.rm(download);checks++;
  await button(language==='ko'?'비교하기':'Compare');await page.waitForFunction(()=>!document.querySelector('[data-row-id][data-kind="changed"]'));
  await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:path.join(out,`${language}-desktop.png`),fullPage:true});
  await page.setViewport({width:390,height:844});await page.screenshot({path:path.join(out,`${language}-mobile.png`),fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));checks++;
  assert.deepEqual(errors,[]);checks++;
  await page.close();
 }
 console.log(`Text comparison browser smoke passed: ${checks} checks, ko/en, desktop/mobile; external requests blocked.`);
}finally{await browser.close();await fs.rm(temporary,{recursive:true,force:true});}
