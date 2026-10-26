import assert from 'node:assert/strict';
import {PDFDocument} from 'pdf-lib';
import {chromium} from 'playwright';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:5273';const doc=await PDFDocument.create();doc.addPage([500,200]).drawText('REPORT AND RECOGNITION',{x:25,y:100,size:24});const pdf=Buffer.from(await doc.save());
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
try{
 const context=await browser.newContext({serviceWorkers:'block'});await context.addInitScript(()=>{window.__WORKLAZY_MOCK_PROVIDERS__=true;window.__ocrStarts=0;const Native=Worker;window.Worker=class extends Native{constructor(url,...args){super(url,...args);if(String(url).includes('provider.worker'))window.__ocrStarts++;}};});
 await context.route('**/*',route=>{const u=new URL(route.request().url());return ['http:','https:'].includes(u.protocol)&&u.origin!==new URL(base).origin?route.abort():route.continue();});
 const page=await context.newPage();page.setDefaultTimeout(120000);const errors=[],downloads=[];page.on('pageerror',e=>errors.push(e.message));page.on('download',d=>downloads.push(d.suggestedFilename()));
 await page.goto(`${base}/en/tools/pdf-compare/`);const files=page.locator('[data-testid="pdf-pair"] input[type=file]');for(let i=0;i<2;i++)await files.nth(i).setInputFiles({name:`side${i}.pdf`,mimeType:'application/pdf',buffer:pdf});
 await page.getByRole('button',{name:'Start comparison',exact:true}).click();await page.getByRole('button',{name:/1 ↔ 1/}).last().click();await page.locator('[data-testid="image-ocr-run"]').waitFor();
 // Hold the actual XLSX serializer so a UI flag alone cannot satisfy this test.
 await page.evaluate(async()=>{await import('/src/utils/xlsxReport.ts');const moduleUrl=performance.getEntriesByType('resource').map(entry=>entry.name).find(url=>url.includes('/node_modules/.vite/deps/exceljs.js?'));if(!moduleUrl)throw new Error('Missing actual optimized ExcelJS URL');const {default:ExcelJS}=await import(moduleUrl);const proto=Object.getPrototypeOf(new ExcelJS.Workbook().xlsx),original=proto.writeBuffer;window.__reportEntered=false;window.__reportReleased=false;window.__reportGate=new Promise(resolve=>window.__releaseReport=()=>{window.__reportReleased=true;resolve();});proto.writeBuffer=async function(...args){window.__reportEntered=true;await window.__reportGate;return original.apply(this,args);};window.__restoreReport=()=>proto.writeBuffer=original;});
 await page.getByRole('button',{name:'Download report',exact:true}).click();await page.waitForFunction(()=>window.__reportEntered);
 assert.equal(await page.getByRole('button',{name:'Download report',exact:true}).isDisabled(),true);
 await page.locator('[data-testid="image-ocr"] select').nth(0).selectOption('eng');await page.locator('[data-testid="image-ocr-run"]').click();await page.locator('[data-testid="image-ocr-cancel"]').waitFor();
 assert.equal(await page.evaluate(()=>window.__ocrStarts),0,'OCR cannot allocate while the old serializer still owns its buffers');
 await page.evaluate(()=>window.__releaseReport());await page.waitForFunction(()=>['complete','empty','failed'].includes(document.querySelector('[data-testid="image-ocr"]')?.dataset.status));
 assert.equal(await page.locator('[data-testid="image-ocr"]').getAttribute('data-status'),'complete');assert.deepEqual(downloads,[],'superseded report does not download');await page.evaluate(()=>window.__restoreReport());
 // A new report is also queued behind actual OCR child disposal.
 const cdp=await context.newCDPSession(page);await page.locator('[data-testid="image-ocr-run"]').click();let started=false;for(let i=0;i<200;i++){started=(await cdp.send('Target.getTargets')).targetInfos.some(t=>t.url.includes('ocr-child-v1.worker.js'));if(started)break;await new Promise(r=>setTimeout(r,20));}assert.ok(started);
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download report',exact:true}).click();await download;
 assert.equal((await cdp.send('Target.getTargets')).targetInfos.filter(t=>t.url.includes('ocr-child-v1.worker.js')).length,0);
 assert.equal(await page.locator('[data-testid="image-ocr"]').getAttribute('data-status'),'canceled');assert.equal(downloads.length,1);assert.deepEqual(errors,[]);console.log('9 passed PDF report/OCR ownership checks');await context.close();
}finally{await browser.close();}
