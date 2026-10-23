import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PNG } from "pngjs";
import puppeteer from "puppeteer-core";
const base = process.env.TEST_BASE_URL || "http://127.0.0.1:4173";
const entry = process.env.IMAGE_COMPARE_ENTRY || "/en/tools/image-compare/";
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), "image-compare-smoke-"));
const a = new PNG({ width: 64, height: 48 }); a.data.fill(255);
const b = new PNG({ width: 64, height: 48 }); b.data.set(a.data);
for (const x of [10,20]) { const i=(20*64+x)*4; b.data[i]=255;b.data[i+1]=0;b.data[i+2]=0; }
await fs.writeFile(path.join(temporary,"left.png"),PNG.sync.write(a)); await fs.writeFile(path.join(temporary,"right.png"),PNG.sync.write(b));
const browser = await puppeteer.launch({ executablePath:"/usr/bin/google-chrome", headless:true, args:["--no-sandbox","--disable-dev-shm-usage","--disable-gpu"] });
try {
  const page = await browser.newPage(); page.setDefaultTimeout(30000); await page.setViewport({width:1360,height:940});
  await page.evaluateOnNewDocument(() => { window.__WORKLAZY_MOCK_PROVIDERS__=true; window.__imageWorkerDelay=0;window.__regionHeapBytes=[];
    const OriginalWorker=window.Worker; window.Worker=class extends OriginalWorker { constructor(...args){super(...args);this.addEventListener("message",event=>{if(event.data?.result?.nativeHeapBytes)window.__regionHeapBytes.push(event.data.result.nativeHeapBytes);});const post=this.postMessage.bind(this),terminate=this.terminate.bind(this);let timer;this.postMessage=(...message)=>{if(window.__imageWorkerDelay)timer=setTimeout(()=>post(...message),window.__imageWorkerDelay);else post(...message);};this.terminate=()=>{clearTimeout(timer);terminate();};} };
  });
  const cdp=await page.createCDPSession();await cdp.send("Network.enable");await cdp.send("Network.setBlockedURLs",{urls:["*googlesyndication.com*","*doubleclick.net*","*google-analytics.com*","*googletagmanager.com*"]});
  const errors=[];page.on("pageerror",error=>errors.push(error.message));
  await page.goto(`${base}${entry}`,{waitUntil:"domcontentloaded"});await page.waitForSelector('[data-tool-page="image-compare"] input[type=file]');
  if(process.env.IMAGE_COMPARE_REQUIRE_NONISOLATED)assert.equal(await page.evaluate(()=>crossOriginIsolated),false);
  const inputs=await page.$$('[data-tool-page="image-compare"] input[type=file]');await inputs[0].uploadFile(path.join(temporary,"left.png"));await inputs[1].uploadFile(path.join(temporary,"right.png"));
  await page.click('[data-testid="image-compare-run"]');await page.waitForSelector('[data-testid="image-result"]').catch(async error=>{console.error(await page.$eval('body',body=>body.innerText));throw error;});
  const initial=await page.$eval('[data-testid="image-result"]',element=>({id:element.dataset.runId,count:Number(element.dataset.changedPixels)}));assert.equal(initial.count,2);
  for(const view of ["split","fade","flicker","slider","highlight","subtract","details","ocrText","ocrBoxes"]){await page.click(`[data-view="${view}"]`);assert.equal(await page.$eval('[data-testid="image-result"]',element=>element.dataset.runId),initial.id);}
  await page.click('[data-view="fade"]');
  for(const [amount,color] of [[0,[255,255,255,255]],[100,[255,0,0,255]]]){await page.$eval('[data-testid="image-views"] input[type=range]',(input,value)=>{const setter=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set;setter.call(input,value);input.dispatchEvent(new Event("input",{bubbles:true}));input.dispatchEvent(new Event("change",{bubbles:true}));},String(amount));await page.waitForFunction(expected=>{const c=document.querySelector('[data-testid="image-pixel-canvas"]');return [...c.getContext("2d").getImageData(10,20,1,1).data].join(",")===expected.join(",");},{},color);}
  await page.click('[data-testid="image-region-scan"]');await page.waitForFunction(()=>document.querySelectorAll('[data-testid="image-result"] ol li').length===1);
  assert.deepEqual(await page.evaluate(()=>window.__regionHeapBytes),[128*1024*1024]);
  const regionText=await page.$eval('[data-testid="image-result"] ol',element=>element.innerText);assert.ok(regionText.includes("375"));assert.ok(regionText.includes("2"));
  assert.equal(await page.$eval('[data-testid="image-result"]',element=>Number(element.dataset.changedPixels)),2);
  await page.$eval('[data-region-option="diffThreshold"]',input=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(input,"255");input.dispatchEvent(new Event("input",{bubbles:true}));});
  await page.click('[data-testid="image-region-scan"]');await page.waitForFunction(()=>document.querySelectorAll('[data-region-pass]').length===2);assert.equal(await page.$$eval('[data-testid="image-result"] ol li',items=>items.length),0);
  await page.click('[data-testid="image-region-scan"]');await page.waitForFunction(()=>document.querySelectorAll('[data-region-pass]').length===3);assert.equal(await page.$eval('[data-testid="image-region-scan"]',element=>element.disabled),true);
  await (await page.$$('[data-region-delete]'))[2].click();assert.equal(await page.$eval('[data-testid="image-region-scan"]',element=>element.disabled),false);
  await page.click('[data-region-pass]');assert.equal(await page.$$eval('[data-testid="image-result"] ol li',items=>items.length),1);assert.equal(await page.$eval('[data-testid="image-result"]',element=>Number(element.dataset.changedPixels)),2);
  await page.click('[data-view="highlight"]');
  await page.emulateMediaFeatures([{name:"prefers-reduced-motion",value:"reduce"}]);await page.click('[data-view="flicker"]');assert.equal(await page.$eval('[data-testid="image-views"] > button',element=>element.disabled),true);
  await page.click('[data-view="split"]');await page.waitForFunction(()=>{const c=document.querySelector('[data-testid="image-pixel-canvas"]');const pixel=c.getContext("2d").getImageData(3,13,1,1).data;return pixel[0]>200&&pixel[1]<120;});
  if(process.env.IMAGE_COMPARE_SCREENSHOT){await page.$eval('[data-testid="image-result"]',element=>element.scrollIntoView());await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.screenshot({path:process.env.IMAGE_COMPARE_SCREENSHOT,fullPage:true});}
  await page.$eval('[data-image-transform="x"]',input=>{Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,"value").set.call(input,"1");input.dispatchEvent(new Event("input",{bubbles:true}));});await page.click('[data-testid="image-compare-run"]');await page.waitForSelector('[data-testid="image-result"]');
  assert.deepEqual(await page.$eval('[data-testid="image-result"]',element=>[Number(element.dataset.comparablePixels),Number(element.dataset.addedBoundary),Number(element.dataset.removedBoundary)]),[63*48,48,48]);
  await page.click('[data-testid="image-transform-reset"]');await page.click('[data-testid="image-compare-run"]');await page.waitForSelector('[data-testid="image-result"]');assert.equal(await page.$eval('[data-testid="image-result"]',element=>Number(element.dataset.changedPixels)),2);
  await page.evaluate(()=>{window.__imageWorkerDelay=500;});await page.click('[data-testid="image-compare-run"]');await page.waitForSelector('[data-testid="image-compare-cancel"]');await page.click('[data-testid="image-compare-cancel"]');await page.waitForSelector('[data-testid="image-compare-error"]');await new Promise(resolve=>setTimeout(resolve,700));assert.equal(await page.$('[data-testid="image-result"]'),null);
  const jpeg = Buffer.from(await page.evaluate(()=>{const canvas=document.createElement("canvas");canvas.width=2;canvas.height=3;return canvas.toDataURL("image/jpeg").split(",")[1];}),"base64");
  const exif=Buffer.from([255,225,0,34,69,120,105,102,0,0,73,73,42,0,8,0,0,0,1,0,18,1,3,0,1,0,0,0,6,0,0,0,0,0,0,0]);
  const oriented=path.join(temporary,"oriented.jpg");await fs.writeFile(oriented,Buffer.concat([jpeg.subarray(0,2),exif,jpeg.subarray(2)]));await page.evaluate(()=>{window.__imageWorkerDelay=0;});
  const replacementInputs=await page.$$('[data-tool-page="image-compare"] input[type=file]');await replacementInputs[0].uploadFile(oriented);await replacementInputs[1].uploadFile(oriented);await page.click('[data-testid="image-compare-run"]');await page.waitForSelector('[data-testid="image-result"]');await page.click('[data-view="details"]');assert.deepEqual(await page.$$eval('[data-image-meta="decodedWidth"]',elements=>elements.map(element=>element.dataset.value)),["3","3"]);assert.deepEqual(await page.$$eval('[data-image-meta="decodedHeight"]',elements=>elements.map(element=>element.dataset.value)),["2","2"]);
  const largeHeader=Buffer.alloc(33);Buffer.from([137,80,78,71,13,10,26,10]).copy(largeHeader);largeHeader.writeUInt32BE(13,8);largeHeader.write('IHDR',12);largeHeader.writeUInt32BE(2000,16);largeHeader.writeUInt32BE(1000,20);largeHeader[24]=8;
  for(const side of ['left','right'])await fs.writeFile(path.join(temporary,`large-${side}.png`),largeHeader);
  const unsafeInputs=await page.$$('[data-tool-page="image-compare"] input[type=file]');await unsafeInputs[0].uploadFile(path.join(temporary,'large-left.png'));await unsafeInputs[1].uploadFile(path.join(temporary,'large-right.png'));await page.click('[data-testid="image-compare-run"]');await page.waitForSelector('[data-testid="image-compare-error"]');assert.ok((await page.$eval('[data-testid="image-compare-error"]',element=>element.innerText)).includes('256'));assert.equal(await page.$('[data-testid="image-result"]'),null);
  assert.deepEqual(errors,[]);console.log("Image comparison smoke passed: RGBA counts, shared views, fade endpoints, real OpenCV regions, reduced motion and cancel.");
} finally {await browser.close();await fs.rm(temporary,{recursive:true,force:true});}
