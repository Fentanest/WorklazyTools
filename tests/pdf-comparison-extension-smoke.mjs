import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {PDFDocument,rgb} from 'pdf-lib';
import {chromium} from 'playwright';
import {PNG} from 'pngjs';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:4173';
const out=path.resolve(process.env.PDF_EXTENSION_EVIDENCE||'docs/jobs/todo/diffchecker-port-20261023/pdf-extension');await fs.mkdir(out,{recursive:true});
const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'pdf-ext-'));
async function fixture(order,file){const doc=await PDFDocument.create();for(const n of order){const p=doc.addPage([300,360]);p.drawText(`Page ${n}`,{x:20,y:330,size:18});for(let k=0;k<8;k++)p.drawRectangle({x:20+(n*43+k*17)%190,y:25+(n*59+k*31)%250,width:20+(n+k)%4*12,height:12+(n*2+k)%5*9,color:rgb((n%3)/4,(k%3)/4,0)});}await fs.writeFile(file,await doc.save());}
await fixture([0,1,2],path.join(tmp,'before.pdf'));await fixture([2,0,1],path.join(tmp,'after.pdf'));
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
let assertions=0;
try{
 const context=await browser.newContext({viewport:{width:1360,height:1000},serviceWorkers:'block'});
 await context.addInitScript(()=>{window.__WORKLAZY_MOCK_PROVIDERS__=true;});
 await context.route('**/*',route=>{const u=new URL(route.request().url());return ['http:','https:'].includes(u.protocol)&&u.origin!==new URL(base).origin?route.abort():route.continue();});
 const page=await context.newPage();page.setDefaultTimeout(60000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${base}/en/tools/pdf-compare/`,{waitUntil:'domcontentloaded'});
 await page.locator('[data-tool-page="pdf-compare"]').waitFor({timeout:20000}).catch(async error=>{console.error('PAGEERRORS',errors);console.error(await page.locator('body').innerText());await page.screenshot({path:path.join(out,'boot-error.png'),fullPage:true});throw error;});
 const inputs=page.locator('[data-testid="pdf-pair"] input[type=file]');await inputs.nth(0).setInputFiles(path.join(tmp,'before.pdf'));await inputs.nth(1).setInputFiles(path.join(tmp,'after.pdf'));
 await page.getByRole('button',{name:'Find page matches',exact:true}).click();await page.getByText('Review suggested matches',{exact:true}).waitFor();
 const selections=await page.locator('[data-testid="pdf-page-candidates"] select').evaluateAll(nodes=>nodes.map(n=>n.value));
 assert.deepEqual(selections,['0','1','1','2','2','0']);assertions++;
 // Merely finding suggestions must leave the existing page-number comparison unchanged.
 await page.getByRole('button',{name:'Start comparison',exact:true}).click();await page.getByRole('heading',{name:'Comparison results',exact:true}).waitFor();
 assert.ok(await page.getByRole('button',{name:/1 ↔ 1/}).count());assertions++;
 await page.getByRole('button',{name:'Find page matches',exact:true}).click();await page.getByRole('button',{name:'Apply this mapping',exact:true}).waitFor();
 await page.getByRole('button',{name:'Apply this mapping',exact:true}).click();await page.getByRole('button',{name:'Start comparison',exact:true}).click();await page.getByRole('heading',{name:'Comparison results',exact:true}).waitFor();
 await page.getByRole('button',{name:/1 ↔ 2/}).last().click();await page.locator('[data-testid="pdf-page-metrics"]').waitFor();await page.locator('[data-testid="pdf-comparison-viewport"] canvas').first().waitFor();
 const metrics=await page.locator('[data-testid="pdf-page-metrics"]').evaluate(n=>({pixels:n.dataset.pixels,ratio:n.dataset.ratio}));assert.equal(metrics.pixels,'0');assertions++;
 for(const label of ['Slide to compare','Color difference','Side by side','Difference overlay']){await page.getByText(label,{exact:true}).click();assert.deepEqual(await page.locator('[data-testid="pdf-page-metrics"]').evaluate(n=>({pixels:n.dataset.pixels,ratio:n.dataset.ratio})),metrics);assertions++;}
 await page.getByText('Color difference',{exact:true}).click();
 const bytes=await page.locator('[data-testid="pdf-comparison-viewport"]').screenshot();const png=PNG.sync.read(bytes),at=(Math.floor(png.height/2)*png.width+Math.floor(png.width/2))*4;assert.deepEqual([...png.data.slice(at,at+3)],[0,0,0]);assertions++;
 await page.screenshot({path:path.join(out,'en-desktop.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:path.join(out,'en-mobile.png'),fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assertions++;
 await page.getByRole('button',{name:'Find page matches',exact:true}).click();const cancel=page.locator('[data-testid="pdf-page-candidates"]').getByRole('button',{name:'Cancel',exact:true});await cancel.click();await page.getByRole('button',{name:'Find page matches',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Apply this mapping',exact:true}).count(),0);assertions++;
 assert.equal(await page.getByRole('heading',{name:'Comparison results',exact:true}).count(),1);assertions++;
 await page.getByRole('button',{name:'Reset to page-number mapping',exact:true}).click();assert.equal(await page.getByRole('heading',{name:'Comparison results',exact:true}).count(),0);assertions++;
 assert.deepEqual(errors,[]);assertions++;await context.close();console.log(`PDF extension browser passed ${assertions} checks; explicit apply, stats identity, CSS difference, mobile, cancellation.`);
}finally{await browser.close();await fs.rm(tmp,{recursive:true,force:true});}
