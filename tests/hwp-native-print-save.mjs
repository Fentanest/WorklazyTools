import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright';
import {PDFDocument} from 'pdf-lib';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:4197';
const root=await fs.mkdtemp('/tmp/worklazy-native-print-');
const records=[];
for(const lang of ['ko','en'])for(const input of ['sample.hwpx','rich.hwp'])test(lang+' '+input+' saves through native browser print and reopens',async()=>{
 const folder=path.join(root,lang+'-'+input),profile=path.join(folder,'profile'),saved=path.join(folder,'saved');
 await fs.mkdir(path.join(profile,'Default'),{recursive:true});await fs.mkdir(saved,{recursive:true});
 const state={recentDestinations:[{id:'Save as PDF',origin:'local',account:''}],selectedDestinationId:'Save as PDF',version:2,isHeaderFooterEnabled:false};
 await fs.writeFile(path.join(profile,'Default/Preferences'),JSON.stringify({printing:{print_preview_sticky_settings:{appState:JSON.stringify(state)}},savefile:{default_directory:saved},download:{default_directory:saved,prompt_for_download:false}}));
 const args=['--no-sandbox','--disable-dev-shm-usage','--kiosk-printing','--enable-print-preview'];
 const context=await chromium.launchPersistentContext(profile,{executablePath:'/usr/bin/google-chrome',headless:false,args,ignoreDefaultArgs:['--disable-print-preview'],viewport:{width:1280,height:900}});
 try{
 await context.addInitScript(()=>localStorage.setItem('worklazy_privacy_consent_v2','denied'));
 await context.route('**/*',route=>{const u=new URL(route.request().url());return u.origin===new URL(base).origin||['blob:','data:','chrome:'].includes(u.protocol)?route.continue():route.abort();});
 const page=await context.newPage();page.setDefaultTimeout(90000);
 await page.goto(base+'/'+lang+'/tools/pdf-converter/document-to-pdf/');await page.waitForFunction(()=>crossOriginIsolated);
 assert.match(await page.evaluate(()=>window.print.toString()),/native code/);
 await page.locator('input[type=file]').setInputFiles(path.join(import.meta.dirname,'fixtures/document-converters',input));
 await page.getByRole('button',{name:lang==='ko'?'인쇄 창에서 PDF 저장':'Save PDF using print',exact:true}).click();
 const frame=page.frameLocator('[data-testid=hwp-pdf-preview] iframe');
 const open=frame.getByRole('button',{name:lang==='ko'?'인쇄 창 열기':'Open print dialog',exact:true});await open.waitFor();
 const guidance=await frame.getByTestId('pdf-print-dialog').innerText();
 assert.doesNotMatch(guidance,/rhwp/);if(lang==='en')assert.doesNotMatch(guidance,/[가-힣]/u);
 await page.getByTestId('hwp-pdf-preview').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(folder,'before-native-print.png')});
 await open.click();
 let files=[];const end=Date.now()+45000;while(Date.now()<end){files=(await fs.readdir(saved)).filter(f=>f.endsWith('.pdf'));if(files.length)break;await new Promise(r=>setTimeout(r,200));}
 assert.equal(files.length,1,'native Save as PDF must create exactly one file');
 const file=path.join(saved,files[0]);let bytes;for(let i=0;i<20;i++){bytes=await fs.readFile(file);try{await PDFDocument.load(bytes);break;}catch{await new Promise(r=>setTimeout(r,200));}}
 const pdf=await PDFDocument.load(bytes),text=execFileSync('pdftotext',[file,'-'],{encoding:'utf8'});
 assert.equal(pdf.getPageCount(),input==='rich.hwp'?2:1);assert.match(text,/한글/);assert.match(text,/FIRST PAGE/);if(input==='rich.hwp'){assert.match(text.split('\f')[1],/SECOND PAGE/);assert.match(text,/42/);assert.match(execFileSync('pdfimages',['-list',file],{encoding:'utf8'}),/image/);}
 execFileSync('pdftoppm',['-f','1','-singlefile','-scale-to','1100','-png',file,path.join(folder,'saved-page')]);
 assert.equal(await page.getByTestId('document-pdf-download').count(),0);
 records.push({lang,input,browser:context.browser().version(),args,method:'untouched native window.print; Chrome print preview Save as PDF destination with kiosk auto-confirm; no Page.printToPDF',guidance,output:file,sha256:createHash('sha256').update(bytes).digest('hex'),pages:pdf.getPageCount(),text});
 }finally{await context.close();await fs.writeFile(path.join(root,'native-print.json'),JSON.stringify(records,null,2));console.log('Evidence:',root);}
});
