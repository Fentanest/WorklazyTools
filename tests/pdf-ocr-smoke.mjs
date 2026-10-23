import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {PDFDocument,degrees} from 'pdf-lib';
import {chromium} from 'playwright';
const lang=process.env.PDF_OCR_LANG||'en';const labels=lang==='ko'?{start:'비교 시작',results:'비교 결과',boxes:'인식 위치 보기',coordinates:/렌더된 페이지 좌표/,memory:'현재 PDF와 페이지 화면을 보관한 상태에서는'}:{start:'Start comparison',results:'Comparison results',boxes:'Recognition positions',coordinates:/Rendered page coordinates/,memory:'There is not enough processing space'};
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:5273',out=path.resolve('docs/jobs/todo/diffchecker-port-20261023/pdf-ocr');await fs.mkdir(out,{recursive:true});
const pdf=async(text,size=[600,250])=>{const doc=await PDFDocument.create(),p=doc.addPage(size);p.drawText(text,{x:30,y:size[1]-70,size:36});p.drawText('LOCAL PAGE REVIEW',{x:30,y:size[1]-130,size:30});return Buffer.from(await doc.save());};
const left=await pdf('ALPHA TEXT 123'),right=await pdf('ALPHA TEXT 456');
const rotated=await PDFDocument.create(),rp=rotated.addPage([600,250]);rp.setCropBox(20,30,560,200);rp.setRotation(degrees(90));rp.drawText('ROTATED PAGE',{x:40,y:100,size:30});const rotatedBytes=Array.from(await rotated.save());
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});let checks=0;
try{
 const context=await browser.newContext({serviceWorkers:'block',colorScheme:lang==='ko'?'dark':'light',viewport:{width:lang==='ko'?390:1360,height:1000}});await context.addInitScript(()=>{window.__WORKLAZY_MOCK_PROVIDERS__=true;window.__providers=0;const Native=Worker;window.Worker=class extends Native{constructor(url,...options){super(url,...options);if(String(url).includes('provider.worker'))window.__providers++;}};});
 await context.route('**/*',route=>{const u=new URL(route.request().url());return ['http:','https:'].includes(u.protocol)&&u.origin!==new URL(base).origin?route.abort():route.continue();});
 const page=await context.newPage();const cdp=await context.newCDPSession(page);page.setDefaultTimeout(120000);const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('PAGEERROR',e.message);});
 await page.goto(`${base}/${lang}/tools/pdf-compare/`);await page.locator('[data-tool-page="pdf-compare"]').waitFor();
 async function compare(a,b){const inputs=page.locator('[data-testid="pdf-pair"] input[type=file]');await inputs.nth(0).setInputFiles({name:'before.pdf',mimeType:'application/pdf',buffer:a});await inputs.nth(1).setInputFiles({name:'after.pdf',mimeType:'application/pdf',buffer:b});await page.getByRole('button',{name:labels.start,exact:true}).click();await page.getByRole('heading',{name:labels.results,exact:true}).waitFor();await page.getByRole('button',{name:/1 ↔ 1/}).last().click();await page.locator('[data-testid="pdf-comparison-viewport"] canvas').first().waitFor();}
 await compare(left,right);await page.locator('[data-testid="image-ocr-run"]').waitFor();
 const metrics=await page.locator('[data-testid="pdf-page-metrics"]').evaluate(n=>({...n.dataset}));
 await page.locator('[data-testid="image-ocr"] select').nth(0).selectOption('eng');await page.locator('[data-testid="image-ocr-run"]').click();await page.waitForFunction(()=>['complete','failed','empty'].includes(document.querySelector('[data-testid="image-ocr"]')?.dataset.status));
 assert.equal(await page.locator('[data-testid="image-ocr"]').getAttribute('data-status'),'complete');checks++;
 const raw=await page.locator('[data-ocr-raw="left"]').textContent();assert.ok(raw.includes('ALPHA TEXT 123'),raw);checks++;
 assert.deepEqual(await page.locator('[data-testid="pdf-page-metrics"]').evaluate(n=>({...n.dataset})),metrics);checks++;
 const providers=await page.evaluate(()=>window.__providers);await page.locator('[data-ocr-corrected="left"]').fill('corrected text');await page.locator('[data-testid="ocr-use-corrections"]').check();assert.equal(await page.locator('[data-testid="image-ocr-diff"]').getAttribute('data-input-source'),'corrected-transcripts');assert.equal(await page.evaluate(()=>window.__providers),providers);checks+=2;
 await page.getByRole('button',{name:labels.boxes,exact:true}).click();await page.locator('[data-ocr-word]').first().click();assert.match(await page.locator('[data-testid="image-ocr-review"]').textContent(),labels.coordinates);checks++;
 await page.screenshot({path:path.join(out,`${lang}-desktop.png`),fullPage:true});await page.setViewportSize({width:390,height:844});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));checks++;await page.screenshot({path:path.join(out,`${lang}-mobile.png`),fullPage:true});
 // The next page render waits until OCR provider disposal; no old transcript survives input replacement.
 await page.locator('[data-testid="image-ocr-run"]').click();await page.locator('[data-testid="image-ocr-cancel"]').waitFor();let child=false;for(let i=0;i<200;i++){child=(await cdp.send('Target.getTargets')).targetInfos.some(t=>t.url.includes('ocr-child-v1.worker.js'));if(child)break;await new Promise(r=>setTimeout(r,20));}assert.ok(child,'actual recognition child started');checks++;await compare(left,right);assert.equal((await cdp.send('Target.getTargets')).targetInfos.filter(t=>t.url.includes('ocr-child-v1.worker.js')).length,0);checks++;await page.locator('[data-testid="image-ocr-run"]').waitFor();assert.equal(await page.locator('[data-ocr-raw]').count(),0);checks++;
 const metadata=await page.evaluate(async bytes=>{
  const {PdfCompareSession}=await import('/src/features/pdf-compare/session.ts'),{createPdfOcrRaster}=await import('/src/features/pdf-compare/ocrRaster.ts');
  const session=new PdfCompareSession(),file=new File([new Uint8Array(bytes)],'rotated.pdf');
  try{const preview=await session.select({id:'rotation',before:file,after:file},{before:0,after:0});const raster=createPdfOcrRaster(preview,'rotation',file.size*2,2*1024*1024);const data={source:raster.sources.before,width:preview.before.width,height:preview.before.height,transform:raster.input.leftTransform};raster.release();return data;}finally{await session.dispose();}
 },rotatedBytes);assert.equal(metadata.source.pageIndex,0);assert.equal(metadata.source.rotation,90);assert.deepEqual(metadata.source.viewBox,[20,30,580,230]);assert.equal(metadata.source.pdfToRendered.length,6);checks+=4;
 const large=await pdf('LARGE PAGE',[1600,1600]);await compare(large,large);await page.getByText(labels.memory,{exact:false}).waitFor();assert.equal(await page.locator('[data-testid="image-ocr-run"]').count(),0);checks++;
 assert.deepEqual(errors,[]);checks++;
 console.log(`PDF OCR passed ${checks} checks`);console.log(JSON.stringify({status:'passed',checks,raw,metadata,metrics}));await context.close();
}finally{await browser.close();}
