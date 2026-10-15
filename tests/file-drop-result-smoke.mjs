import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import { generatorTemplate } from './helpers/document-generator-fixtures.mjs';
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5183';
const out = process.env.FILE_DROP_RESULT_OUTPUT || '/tmp/worklazy-drop-result';
await fs.mkdir(out, { recursive: true });
for (const name of ['before','after','new']) await fs.writeFile(`${out}/${name}.docx`, generatorTemplate());
const png = new PNG({width:8,height:8});png.data.fill(255);
for (const name of ['A','B']) await fs.writeFile(`${out}/${name}.png`,PNG.sync.write(png));
const browser = await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox']});
const context = await browser.newContext({viewport:{width:1440,height:1000}});
await context.route('**/*', route => new URL(route.request().url()).origin === new URL(base).origin || /^(blob|data):/.test(route.request().url()) ? route.continue() : route.abort());
const page = await context.newPage();page.setDefaultTimeout(30000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
const cdp=await context.newCDPSession(page);
async function drop(x,y,file='new.docx'){const data={items:[],files:[`${out}/${file}`],dragOperationsMask:1};for(const type of ['dragEnter','dragOver','drop'])await cdp.send('Input.dispatchDragEvent',{type,x,y,data});}
try {
 await page.goto(`${base}/en/tools/document-compare/`);
 await page.locator('input[type=file]').nth(0).setInputFiles(`${out}/before.docx`);
 await page.locator('input[type=file]').nth(1).setInputFiles(`${out}/after.docx`);
 await page.getByRole('button',{name:'Compare 1 document pairs',exact:true}).click();
 await page.getByTestId('document-view-result').click();
 await page.getByTestId('document-page-view').waitFor();
 // Exercise the production ad-bearing document boundary without loading a provider.
 await page.evaluate(() => { if (!document.querySelector('script[data-worklazy-adsense]')) { const script=document.createElement('script');script.type='application/json';script.dataset.worklazyAdsense='true';script.textContent='{}';document.head.append(script); } });
 const documentStarted = await page.evaluate(() => performance.timeOrigin);
 await drop(1100,35);
 await page.getByTestId('file-drop-target-choice').waitFor();
 await page.getByTestId('file-drop-target-choice').getByRole('button',{name:'Cancel',exact:true}).click();
 const before=page.locator('[data-document-side=before]').first();await before.scrollIntoViewIfNeeded();const box=await before.boundingBox();
 await drop(box.x+box.width/2,box.y+box.height/2);
 await page.waitForURL('**/en/tools/document-compare');
 await page.getByTestId('document-file-grid').waitFor();
 assert.equal(await page.evaluate(() => performance.timeOrigin),documentStarted,'result append must not reload and lose the in-memory session');
 assert.equal(await page.getByTestId('document-file-list-before').getByTestId('document-file-item').count(),2);
 assert.equal(await page.getByTestId('document-file-list-after').getByTestId('document-file-item').count(),1);
 assert.equal(await page.getByTestId('file-drop-target-choice').count(),0);
 assert.deepEqual(errors,[]);
 await page.screenshot({path:`${out}/after-result-drop.png`,fullPage:true});
 console.log('ok 1 - comparison result background prompts; before column appends once and retains both lists');
 await page.goto(`${base}/en/tools/image-privacy/`);
 await page.evaluate(() => {
   const send = Worker.prototype.postMessage;
   Worker.prototype.postMessage = function(message, ...args) {
     if (Array.isArray(message?.files)) { window.releasePrivacyWork = () => send.call(this,message,...args); return; }
     return send.call(this,message,...args);
   };
 });
 await page.locator('input[type=file]').setInputFiles(`${out}/A.png`);
 await page.locator('[data-ui-component=primary-button]').click();
 await page.waitForFunction(() => typeof window.releasePrivacyWork === 'function');
 assert.equal(await page.locator('input[type=file]').isDisabled(),true);
 await drop(1100,35,'B.png');
 await page.getByRole('status').filter({hasText:'This input is busy'}).waitFor();
 assert.match(await page.locator('[data-ui-part=drop-target]').innerText(),/1 file/);
 await page.evaluate(() => window.releasePrivacyWork());
 await page.getByTestId('image-privacy-result').waitFor();
 assert.equal(await page.locator('input[type=file]').isDisabled(),false);
 await drop(1100,35,'B.png');
 await page.waitForFunction(() => document.querySelector('[data-ui-part=drop-target]').textContent.includes('2 files'));
 assert.equal(await page.getByTestId('image-privacy-result').count(),0);
 assert.deepEqual(errors,[]);
 console.log('ok 2 - processing blocks external file input with reason, preserves current result, permits append after completion');
 console.log('1..2\n# tests 2\n# pass 2\n# fail 0');
} catch(error){await page.screenshot({path:`${out}/failure.png`,fullPage:true});throw error;}finally{await browser.close();}
