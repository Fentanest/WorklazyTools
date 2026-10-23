import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {PNG} from 'pngjs';
import puppeteer from 'puppeteer-core';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:4173',entry=process.env.IMAGE_COMPARE_ENTRY||'/en/tools/image-compare/';
const directory=await fs.mkdtemp(path.join(os.tmpdir(),'alignment-ui-'));
const left=new PNG({width:640,height:400}),right=new PNG({width:640,height:400});let seed=7;
for(let p=0;p<640*400;p++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const c=seed>>>24;left.data.set([c,c,c,255],p*4);}right.data.fill(255);
for(let y=0;y<400;y++)for(let x=0;x<640;x++){if(x>=8&&y+5<400)left.data.copy(right.data,(y*640+x)*4,((y+5)*640+x-8)*4,((y+5)*640+x-8)*4+4);}
const files=[path.join(directory,'left.png'),path.join(directory,'right.png')];await fs.writeFile(files[0],PNG.sync.write(left));await fs.writeFile(files[1],PNG.sync.write(right));const hashes=await Promise.all(files.map(async file=>createHash('sha256').update(await fs.readFile(file)).digest('hex')));
const browser=await puppeteer.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--disable-gpu']});
try{
 const page=await browser.newPage();page.setDefaultTimeout(30000);await page.setViewport({width:Number(process.env.ALIGNMENT_VIEWPORT_WIDTH)||1360,height:940});
 await page.evaluateOnNewDocument(()=>{window.__WORKLAZY_MOCK_PROVIDERS__=true;window.__alignmentDelay=0;window.__alignmentMalformed=false;window.__terminated=0;const Original=window.Worker;window.Worker=class extends Original{constructor(...args){super(...args);const post=this.postMessage.bind(this),terminate=this.terminate.bind(this);let timer;this.postMessage=(...data)=>{if(String(args[0]).includes('alignment-v1')&&window.__alignmentMalformed){queueMicrotask(()=>this.dispatchEvent(new MessageEvent('message',{data:{type:'result',result:{sourceRevision:data[0].sourceRevision,mode:data[0].mode,matrix:[]}}})));return;}if(String(args[0]).includes('alignment-v1')&&window.__alignmentDelay)timer=setTimeout(()=>post(...data),window.__alignmentDelay);else post(...data);};this.terminate=()=>{window.__terminated++;clearTimeout(timer);terminate();};}};});
 const cdp=await page.createCDPSession();await cdp.send('Network.enable');await cdp.send('Network.setBlockedURLs',{urls:['*googlesyndication.com*','*doubleclick.net*','*google-analytics.com*','*googletagmanager.com*']});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));await page.goto(`${base}${entry}`,{waitUntil:'domcontentloaded'});await page.waitForSelector('[data-tool-page="image-compare"] input[type=file]');assert.equal(await page.evaluate(()=>crossOriginIsolated),false);
 const inputs=await page.$$('[data-tool-page="image-compare"] input[type=file]');for(let i=0;i<2;i++)await inputs[i].uploadFile(files[i]);await page.click('[data-testid="image-compare-run"]');await page.waitForSelector('[data-testid="image-result"]');
 const baseline=await page.$eval('[data-testid="image-result"]',element=>({id:element.dataset.runId,count:Number(element.dataset.changedPixels)}));
 const suggest=async()=>{await page.click('[data-testid="image-alignment-propose"]');await page.waitForSelector('[data-testid="image-alignment-preview"]');};
 await suggest();assert.equal(await page.$eval('[data-testid="image-result"]',element=>element.dataset.runId),baseline.id);
 await page.click('[data-testid="image-alignment-reject"]');assert.equal(await page.$('[data-testid="image-alignment-preview"]'),null);assert.equal(await page.$eval('[data-testid="image-result"]',element=>element.dataset.runId),baseline.id);
 await suggest();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));if(process.env.ALIGNMENT_SCREENSHOT)await page.screenshot({path:process.env.ALIGNMENT_SCREENSHOT,fullPage:true});await page.click('[data-testid="image-alignment-apply"]');
 const applied=await page.$eval('[data-testid="image-result"]',element=>({id:element.dataset.runId,count:Number(element.dataset.changedPixels)}));assert.notEqual(applied.id,baseline.id);assert.ok(applied.count<baseline.count*.5,`${applied.count} vs ${baseline.count}`);
 await page.click('[data-testid="image-region-scan"]');await page.waitForFunction(()=>document.querySelectorAll('[data-region-pass]').length===1); // Projective source-polygon path remains connected.
 await page.click('[data-testid="image-alignment-revert"]');await page.waitForFunction(expected=>Number(document.querySelector('[data-testid="image-result"]')?.dataset.changedPixels)===expected,{},baseline.count);
 await page.select('[data-testid="image-alignment"] select','homography');await suggest();await page.click('[data-testid="image-alignment-reject"]');
 await page.evaluate(()=>{window.__alignmentMalformed=true;});await page.click('[data-testid="image-alignment-propose"]');await page.waitForSelector('[data-testid="image-compare-error"]');assert.equal(await page.$('[data-testid="image-alignment-preview"]'),null);assert.equal(await page.$eval('[data-testid="image-result"]',element=>Number(element.dataset.changedPixels)),baseline.count);await page.evaluate(()=>{window.__alignmentMalformed=false;});
 await page.evaluate(()=>{window.__alignmentDelay=1000;});const previousTerminations=await page.evaluate(()=>window.__terminated);await page.click('[data-testid="image-alignment-propose"]');await page.waitForSelector('[data-testid="image-compare-cancel"]');
 await page.$eval('[data-image-transform="x"]',input=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input,'1');input.dispatchEvent(new Event('input',{bubbles:true}));});
 assert.ok(await page.evaluate(previous=>window.__terminated>previous,previousTerminations));await new Promise(resolve=>setTimeout(resolve,1200));assert.equal(await page.$('[data-testid="image-alignment-preview"]'),null);assert.equal(await page.$('[data-testid="image-result"]'),null);
 assert.deepEqual(errors,[]);assert.deepEqual(await Promise.all(files.map(async file=>createHash('sha256').update(await fs.readFile(file)).digest('hex'))),hashes);
 console.log(JSON.stringify({status:'passed',baselinePixels:baseline.count,appliedPixels:applied.count,cases:['CPU/nonisolated','preview preserves baseline','reject','explicit apply','inverse source polygons','revert from originals','homography preview','source-change stale discard/terminate','original hashes unchanged']}));
}finally{await browser.close();await fs.rm(directory,{recursive:true,force:true});}
