// Core ownership evidence. D3 owns full static/SEO and 14-row navigation integration.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import { PNG } from 'pngjs';
const base=process.env.TEST_BASE_URL || 'http://127.0.0.1:4199';
const out=process.env.DIRECT_ENTRY_OUTPUT || '/tmp/worklazy-u9-core/browser';
await fs.mkdir(out,{recursive:true});
const rows=JSON.parse(await fs.readFile(new URL('./fixtures/direct-entry-contract.json',import.meta.url),'utf8'));
const pdf=await PDFDocument.create();for(let i=0;i<3;i++){const page=pdf.addPage([300,400]);page.drawText(`Synthetic U9 page ${i+1}`,{x:30,y:330});}await fs.writeFile(path.join(out,'input.pdf'),await pdf.save());
const png=new PNG({width:80,height:60});for(let i=0;i<png.data.length;i+=4){png.data[i]=120;png.data[i+1]=200;png.data[i+2]=80;png.data[i+3]=255;}await fs.writeFile(path.join(out,'input.png'),PNG.sync.write(png));
execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','sine=frequency=440:duration=3','-c:a','pcm_s16le',path.join(out,'input.wav')]);
execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-y','-f','lavfi','-i','color=c=blue:s=160x120:r=15:d=3','-f','lavfi','-i','sine=frequency=440:duration=3','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-shortest',path.join(out,'input.mp4')]);
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
const selected=new Set((process.env.DIRECT_ENTRY_FEATURES || 'pdf,image,audio,video').split(','));
const report={direct:[],checks:[],errors:[],external:[]};
const context=await browser.newContext({viewport:{width:1365,height:900},acceptDownloads:true});
await context.addInitScript(()=>{window.__folderWrites=0;window.__folderAborts=0;window.__folderCloses=0;window.showDirectoryPicker=async()=>({getFileHandle:async()=>({createWritable:async()=>({write:async()=>{window.__folderWrites++;await new Promise(resolve=>window.__folderRelease=resolve);},close:async()=>{window.__folderCloses++;},abort:async()=>{window.__folderAborts++;window.__folderRelease?.();}})})});localStorage.setItem('worklazy_privacy_consent','granted');window.__revoked=[];const revoke=URL.revokeObjectURL.bind(URL);URL.revokeObjectURL=url=>{window.__revoked.push(url);revoke(url);};});
const page=await context.newPage();page.setDefaultTimeout(30000);
page.on('pageerror',e=>report.errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()) && !r.url().startsWith(base))report.external.push(r.url());});
const navigate=async route=>{await page.evaluate(route=>{history.pushState({},'',route);dispatchEvent(new PopStateEvent('popstate'));},route);};
const purpose=async value=>{await page.locator(`[data-direct-purpose="${value}"]`).waitFor();};
const confirm=async choice=>{await page.locator('[data-testid="direct-entry-confirm"][open]').waitFor();await page.locator(`[data-testid="direct-entry-${choice}"]`).click();await page.locator('[data-testid="direct-entry-confirm"][open]').waitFor({state:'hidden'});};
const check=name=>{report.checks.push(name);console.log('PASS',name);};
try{
 if (process.env.DIRECT_ENTRY_SKIP_MATRIX !== '1') for(const lang of ['ko','en']) for(const row of rows){
  await page.goto(`${base}/${lang}${row.path}/`);
  await page.locator(row.readySelector).waitFor();
  if(row.owner==='pdf-organize') { const expected=row.purpose==='split'?1:0;assert.equal(await page.locator('.pdf-output-mode-list [role=radio]').nth(expected).getAttribute('aria-checked'),'true'); }
  if(row.owner==='image-studio') assert.equal(await page.locator('[data-testid=image-editor-options-panel]').getAttribute('data-panel'),row.postLoadAssertions.panel);
  if(row.owner==='pdf-convert') assert.equal(await page.locator('.pdf-format-grid [role=radio]').nth(row.purpose==='ocr'?3:0).getAttribute('aria-checked'),'true');
  report.direct.push(`${lang}:${row.path}`);
 }
 if (report.direct.length) { assert.equal(report.direct.length,28); check('28 native direct entries render'); }
 if(selected.has('pdf')) {
 await page.goto(`${base}/en/tools/pdf-editor/merge/?old=1#before`);await purpose('merge');
 await page.locator('input[type=file]').first().setInputFiles(path.join(out,'input.pdf'));
 await page.locator('.pdf-page-card').nth(2).waitFor();
 await page.locator('[data-page-action=rotate]').first().click();
 const pageIds=await page.locator('.pdf-page-card').evaluateAll(nodes=>nodes.map(n=>n.dataset.pageId));
 await page.getByRole('button',{name:'Create PDF',exact:true}).click();
 await page.locator('[data-testid=pdf-download]').waitFor();
 const resultUrl=await page.locator('[data-testid=pdf-download]').getAttribute('href');
 const bytes=await page.evaluate(async url=>Array.from(new Uint8Array(await (await fetch(url)).arrayBuffer())),resultUrl);
 const output=await PDFDocument.load(Uint8Array.from(bytes));assert.equal(output.getPageCount(),3);assert.equal(output.getPage(0).getRotation().angle,90);
 await fs.writeFile(path.join(out,'organized.pdf'),Uint8Array.from(bytes));
 await navigate('/en/tools/pdf-editor/delete/?new=2#after');await confirm('reject');
 assert.equal(new URL(page.url()).pathname,'/en/tools/pdf-editor/merge/');assert.equal(new URL(page.url()).search,'?old=1');assert.equal(new URL(page.url()).hash,'#before');
 assert.equal(await page.locator('[data-testid=pdf-download]').getAttribute('href'),resultUrl);
 await navigate('/en/tools/pdf-editor/delete/');await confirm('accept');await purpose('delete');
 assert.deepEqual(await page.locator('.pdf-page-card').evaluateAll(nodes=>nodes.map(n=>n.dataset.pageId)),pageIds);
 assert.equal(await page.locator('.pdf-page-card').first().getAttribute('data-rotation'),'90');
 assert.equal(await page.locator('[data-testid=pdf-download]').count(),0);assert.ok(await page.evaluate(url=>window.__revoked.includes(url),resultUrl));
 assert.equal(await page.locator('[data-page-action=delete]').first().evaluate(n=>n===document.activeElement),true);
 await page.screenshot({path:path.join(out,'pdf-delete-en.png')});check('PDF reject restores URL/result; accept preserves edited page IDs and revokes old output/focuses delete');
 await navigate('/en/tools/pdf-editor/split/');await confirm('accept');await purpose('split');
 assert.equal(await page.locator('.pdf-split-after').count(),2);assert.equal(await page.locator('.pdf-page-card').count(),3);
 assert.equal(await page.locator('.pdf-range-group').count(),1);
 assert.equal(await page.locator('.pdf-range-group input').nth(1).inputValue(),'1-3');
 check('split opens boundary UI without auto splitting');
 await page.goBack();await confirm('accept');await purpose('delete');
 await page.goForward();await confirm('reject');await purpose('delete');
 assert.equal(await page.locator('.pdf-page-card').count(),3);check('PDF back/forward use the same approval contract and retain pages');
 }
 if(selected.has('image')) {
 await page.goto(`${base}/en/tools/image-studio/resize/`);await purpose('resize');
 await page.locator('[data-testid=image-editor-options-panel][data-panel=size]').waitFor();
 await page.locator('[data-testid=image-editor-panel-text]').click();
 await navigate('/en/tools/image-studio/resize/?query=1#hash');assert.equal(await page.locator('[data-testid=image-editor-options-panel]').getAttribute('data-panel'),'text');
 await navigate('/ko/tools/image-studio/resize/?query=1#hash');assert.equal(await page.locator('[data-testid=image-editor-options-panel]').getAttribute('data-panel'),'text');
 await navigate('/en/tools/image-studio/mosaic/');await purpose('mosaic');assert.equal(await page.locator('[data-testid=direct-entry-confirm][open]').count(),0);
 await page.locator('[data-image-owner=editor] input[type=file]').setInputFiles(path.join(out,'input.png'));
 await page.locator('[data-image-owner=editor]').getByText('1 files selected',{exact:true}).waitFor();await page.locator('[data-testid=image-editor-options-panel][data-panel=effect]').waitFor();
 await page.locator('[data-testid=image-editor-panel-size]').click();
 await page.setViewportSize({width:1280,height:850});assert.equal(await page.locator('[data-testid=image-editor-options-panel]').getAttribute('data-panel'),'size');
 await navigate('/en/tools/image-studio/watermark/');await confirm('reject');assert.equal(await page.locator('[data-testid=image-editor-options-panel]').getAttribute('data-panel'),'size');
 await navigate('/en/tools/image-studio/watermark/');await confirm('accept');await page.locator('[data-testid=image-editor-options-panel][data-panel=text]').waitFor();
 assert.equal(await page.locator('[data-testid=image-editor-text-input]').inputValue(),'');
 await page.locator('[data-image-owner=editor]').getByText('1 files selected',{exact:true}).waitFor();
 await page.locator('[data-testid=image-editor-panel-layers]').click();assert.equal(await page.locator('[data-layer-id]').count(),1);assert.equal(await page.locator('[data-layer-base=true]').count(),1);await page.locator('[data-testid=image-editor-panel-text]').click();
 const imageDownload=page.waitForEvent('download');await page.locator('[data-testid=image-editor-export-action] button').click();await (await imageDownload).saveAs(path.join(out,'watermark-empty.png'));const exportedPng=PNG.sync.read(await fs.readFile(path.join(out,'watermark-empty.png')));assert.equal(exportedPng.width,900);assert.equal(exportedPng.height,600);
 await page.screenshot({path:path.join(out,'image-watermark-en.png')});check('image file/panel survive rejection; language/search/hash/resize do not reset; watermark empty');
 await page.getByRole('button',{name:'Batch edit',exact:true}).click();await page.locator('[data-image-owner=batch] input[type=file]').first().setInputFiles(path.join(out,'input.png'));
 await navigate('/en/tools/image-studio/resize/');await confirm('accept');
 await page.getByRole('button',{name:'Batch edit',exact:true}).click();assert.equal(await page.locator('[data-image-owner=batch]').getByText('input.png',{exact:true}).count(),1);
 await page.keyboard.press('Delete');
 await page.getByRole('button',{name:'Image editor',exact:true}).click();await page.locator('[data-image-owner=editor]').getByText('1 files selected',{exact:true}).waitFor();check('image other-tab inputs retained after purpose acceptance; hidden editor key listener gated');
 }
 if(selected.has('audio')) {
 await page.goto(`${base}/en/tools/audio-studio/trim/`);await purpose('trim');await page.locator('input[type=file]').first().setInputFiles(path.join(out,'input.wav'));
 await page.locator('[data-testid=audio-export-actions] button').waitFor();
 const selectionToggle=page.getByRole('switch',{name:'Export selection only',exact:true});assert.equal(await selectionToggle.getAttribute('aria-checked'),'true');
 const audioDownload=page.waitForEvent('download');await page.locator('[data-testid=audio-export-actions] button').click();await (await audioDownload).saveAs(path.join(out,'trim.wav'));
 await navigate('/en/tools/audio-studio/');await confirm('reject');assert.equal(await page.locator('[data-testid=audio-result]').count(),1);assert.equal(await selectionToggle.getAttribute('aria-checked'),'true');
 await navigate('/en/tools/audio-studio/');await confirm('accept');assert.equal(await page.locator('[data-testid=audio-result]').count(),0);assert.equal(await selectionToggle.getAttribute('aria-checked'),'false');await page.locator('[data-testid=audio-export-actions]').waitFor();
 check('audio trim applies after decode; export produces WAV; reject/accept preserve document and change only selection export');
 }
 if(selected.has('video')) {
 await page.goto(`${base}/en/tools/video-studio/extract-audio/?task=1#range`);await purpose('extract-audio');
 assert.equal(await page.evaluate(()=>Boolean(document.querySelector('meta[name=worklazy-video-isolation]'))&&crossOriginIsolated),true);
 assert.equal(await page.evaluate(()=>new URL(navigator.serviceWorker.controller.scriptURL).pathname),'/en/tools/video-studio/coi-serviceworker.js');
 await page.locator('input[type=file]').first().setInputFiles(path.join(out,'input.mp4'));
 await page.locator('[data-testid=video-output-format] select').first().waitFor();assert.equal(await page.locator('[data-testid=video-output-format] select').first().inputValue(),'mp3');
 await page.locator('.video-trim-lane input[type=number]').first().fill('0.50');await page.locator('.video-trim-lane input[type=number]').first().press('Enter');
 await page.getByRole('button',{name:/Create 1 results/}).click();
 await page.locator('a[download$=".mp3"]').first().waitFor({timeout:120000});
 const videoUrl=await page.locator('a[download$=".mp3"]').first().getAttribute('href');
 const mp3=await page.evaluate(async url=>Array.from(new Uint8Array(await (await fetch(url)).arrayBuffer())),videoUrl);
 await fs.writeFile(path.join(out,'extracted.mp3'),Uint8Array.from(mp3));
 const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-of','json',path.join(out,'extracted.mp3')],{encoding:'utf8'}));
 assert.ok(probe.streams.some(stream=>stream.codec_type==='audio'));assert.equal(probe.streams.filter(stream=>stream.codec_type==='video').length,0);
 await fs.writeFile(path.join(out,'mp3-ffprobe.json'),JSON.stringify(probe,null,2));
 const sourceUrl=await page.locator('video').first().getAttribute('src');
 await page.getByRole('button',{name:'Save to folder',exact:true}).click();await page.waitForFunction(()=>window.__folderWrites===1);
 await navigate('/en/tools/video-studio/merge/');await confirm('reject');assert.equal(await page.locator('a[download$=".mp3"]').first().getAttribute('href'),videoUrl);
 await navigate('/en/tools/video-studio/merge/');await confirm('accept');await purpose('merge');
 assert.equal(await page.getByRole('switch',{name:'Concatenate all groups into one file',exact:true}).getAttribute('aria-checked'),'true');
 assert.equal(await page.locator('video').first().getAttribute('src'),sourceUrl);assert.equal(await page.locator('.video-trim-lane input[type=number]').first().inputValue(),'0.50');
 assert.ok(await page.evaluate(url=>window.__revoked.includes(url),videoUrl));
 assert.equal(await page.evaluate(()=>window.__folderAborts),1);assert.equal(await page.evaluate(()=>window.__folderCloses),0);
 assert.equal(await page.locator('[data-testid=video-output-format] select').first().inputValue(),'mp4');
 check('video mp3 output has audio and no video stream; accept/reject retain input and revoke only old results');
 await page.screenshot({path:path.join(out,'video-extract-en.png')});
 check('video subpath uses parent COI controller and mp3 preset after input');
 }
 assert.deepEqual(report.errors,[]);assert.deepEqual(report.external,[]);
}finally{await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));await browser.close();}
