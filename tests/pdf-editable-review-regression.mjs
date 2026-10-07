import assert from 'node:assert/strict';
import {before,after,test} from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright';
import JSZip from 'jszip';
import {PDFDocument} from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import {PNG} from 'pngjs';
import initRhwp,{HwpDocument} from '@rhwp/core';

const base=process.env.TEST_BASE_URL || 'http://127.0.0.1:4189';
const fixture=path.join(import.meta.dirname,'fixtures/document-converters');
const output=await fs.mkdtemp('/tmp/worklazy-pdf-review-fixes-');
let browser,page;const external=[],errors=[];
before(async()=>{
 await initRhwp({module_or_path:await fs.readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm',import.meta.url))});
 browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext();await context.addInitScript(()=>localStorage.setItem('worklazy_privacy_consent_v2','denied'));
 await context.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin===new URL(base).origin||['blob:','data:'].includes(url.protocol))return route.continue();external.push(url.href);return route.abort();});
 page=await context.newPage();page.setDefaultTimeout(60000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/en/tools/pdf-converter/pdf-to-document/');
});
after(async()=>{await browser?.close();console.log('Evidence:',output);});
async function start(input,format){
 await page.locator('input[type=file]').setInputFiles(typeof input==='string'?path.join(fixture,input):input);
 await page.getByRole('radio',{name:new RegExp('^'+format.toUpperCase())}).click();
 await page.getByRole('button',{name:'Convert to '+format.toUpperCase(),exact:true}).click();
 await page.waitForFunction(()=>document.querySelector('[data-testid=pdf-download], [role=alert]'));
}
async function download(name){
 assert.deepEqual(await page.getByRole('alert').allTextContents(),[]);
 const bytes=Buffer.from(await page.getByTestId('pdf-download').evaluate(async a=>Array.from(new Uint8Array(await(await fetch(a.href)).arrayBuffer()))));
 await fs.writeFile(path.join(output,name),bytes);return bytes;
}
function inspectRenderedText(file){
 execFileSync('libreoffice',['-env:UserInstallation=file://'+output+'/lo','--headless','--convert-to','pdf','--outdir',output,file],{timeout:90000});
 const pdf=file.replace(/\.pptx$/,'.pdf'),bbox=file.replace(/\.pptx$/,'-bbox.html');
 execFileSync('pdftotext',['-bbox',pdf,bbox]);
 execFileSync('pdftoppm',['-f','1','-singlefile','-scale-to','1200','-png',pdf,file.replace(/\.pptx$/,'')]);
 return JSON.parse(execFileSync('python3',['-c',`import xml.etree.ElementTree as E,json,sys
r=E.parse(sys.argv[1]).getroot();ns={'h':'http://www.w3.org/1999/xhtml'}
print(json.dumps([{'width':float(p.get('width')),'height':float(p.get('height')),'words':[{'text':w.text or '',**{k:float(w.get(k)) for k in ['xMin','xMax','yMin','yMax']}} for w in p.findall('.//h:word',ns)]} for p in r.findall('.//h:page',ns)]))`,bbox],{encoding:'utf8'}));
}
function assertSeparatedLines(pages,baselineTolerance=0.5){
 const geometry=[];
 for(const [index,p] of pages.entries()){
  const lines=[];
  for(const word of [...p.words].sort((a,b)=>a.yMin-b.yMin||a.xMin-b.xMin)){
   assert.ok(word.xMin>=35&&word.xMax<=p.width-35,'text must stay within slide side margins');
   assert.ok(word.yMin>=35&&word.yMax<=p.height-35,'text must stay within slide vertical margins');
   const line=lines.find(l=>Math.abs(l.top-word.yMin)<baselineTolerance);if(line)line.bottom=Math.max(line.bottom,word.yMax);else lines.push({top:word.yMin,bottom:word.yMax});
  }
  lines.sort((a,b)=>a.top-b.top);geometry.push({page:index+1,lines});
  for(let i=1;i<lines.length;i++)assert.ok(lines[i].top>=lines[i-1].bottom+1,`rendered lines overlap on page ${index+1}: previous bottom ${lines[i-1].bottom}, next top ${lines[i].top}`);
 }
 return geometry;
}

test('F1: wide Latin lines reopen without overlap, clipping, lost text or reduced font size',async()=>{
 await start('review-wide.pdf','pptx');const bytes=await download('wide.pptx');const zip=await JSZip.loadAsync(bytes);
 const slides=Object.keys(zip.files).filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n));
 const xml=(await Promise.all(slides.map(n=>zip.file(n).async('string')))).join('');
 const sizes=[...xml.matchAll(/<a:rPr\b[^>]*\bsz="(\d+)"/g)];assert.ok(sizes.length>0&&sizes.every(m=>Number(m[1])===1400),'keep readable 14pt text');
 const pages=inspectRenderedText(path.join(output,'wide.pptx'));
 const words=pages.flatMap(p=>p.words);assert.equal(words.reduce((n,w)=>n+(w.text.match(/W/g)||[]).length,0),560);assert.match(words.map(w=>w.text).join(' '),/BOTTOM END MARKER/);
 const geometry=assertSeparatedLines(pages);
 await fs.writeFile(path.join(output,'wide-geometry.json'),JSON.stringify(geometry,null,2));
});
test('F1: wide Latin and Korean text reflows over slides with all characters and readable spacing',async()=>{
 const input=await PDFDocument.create();input.registerFontkit(fontkit);
 input.setCreationDate(new Date('2000-01-01T00:00:00Z'));input.setModificationDate(new Date('2000-01-01T00:00:00Z'));
 const font=await input.embedFont(await fs.readFile(new URL('../public/vendor/zetaoffice/2026-10-07/NanumGothic-Regular.ttf',import.meta.url)),{subset:false});
 const sheet=input.addPage([2500,1000]);const sourceLines=Array.from({length:12},(_,i)=>String(i).padStart(2,'0')+' '+('WM한글 '.repeat(20)));
 sourceLines.forEach((text,i)=>sheet.drawText(text,{x:40,y:950-i*60,size:14,font}));
 const buffer=Buffer.from(await input.save());await fs.writeFile(path.join(output,'mixed-input.pdf'),buffer);
 await start({name:'mixed-input.pdf',mimeType:'application/pdf',buffer},'pptx');const bytes=await download('mixed.pptx');const zip=await JSZip.loadAsync(bytes);
 const slides=Object.keys(zip.files).filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n));assert.ok(slides.length>1,'wrapped long content must paginate');
 const xml=(await Promise.all(slides.map(n=>zip.file(n).async('string')))).join('');
 const sizes=[...xml.matchAll(/<a:rPr\b[^>]*\bsz="(\d+)"/g)];assert.ok(sizes.length>0&&sizes.every(m=>Number(m[1])===1400));
 const pages=inspectRenderedText(path.join(output,'mixed.pptx'));
 assert.equal(pages.flatMap(p=>p.words).map(w=>w.text).join('').replace(/\s/g,''),sourceLines.join('').replace(/\s/g,''));
 // Latin and Korean font substitutions have slightly different baselines on the same line.
 const geometry=assertSeparatedLines(pages,6);await fs.writeFile(path.join(output,'mixed-geometry.json'),JSON.stringify(geometry,null,2));
});
for(const format of ['pptx','hwpx']){
 test('F2: corrupt JPEG fails '+format+' explicitly, without a partial download',async()=>{
  await start('review-badimage.pdf',format);
  const alerts=await page.getByRole('alert').allTextContents();
  assert.ok(alerts.some(message=>/image.*(decode|decod)|decod.*image/i.test(message)),JSON.stringify({alerts,downloads:await page.getByTestId('pdf-download').count()}));
  assert.equal(await page.getByTestId('pdf-download').count(),0);
 });
 test('F2: a valid image still survives '+format+' after rejection',async()=>{
  await start('rich.pdf',format);const bytes=await download('recovered.'+format),zip=await JSZip.loadAsync(bytes);
  const media=Object.keys(zip.files).filter(n=>format==='pptx'?/^ppt\/media\/.*\.png$/.test(n):/^BinData\/.*\.png$/.test(n));assert.ok(media.length>0);
  const bitmap=PNG.sync.read(await zip.file(media[0]).async('nodebuffer'));assert.equal(bitmap.width,160);assert.equal(bitmap.height,80);assert.ok(bitmap.data[0]>150&&bitmap.data[1]<80);
  if(format==='pptx'){
   const rendered=inspectRenderedText(path.join(output,'recovered.pptx'));assert.match(rendered.flatMap(p=>p.words).map(w=>w.text).join(' '),/FIRST PAGE/);
   assert.match(execFileSync('pdfimages',['-list',path.join(output,'recovered.pdf')],{encoding:'utf8'}),/image/);
  }else{const doc=new HwpDocument(bytes);try{assert.match(doc.getTextFileText(),/한글/);assert.ok(JSON.parse(doc.getPageSourceImageKeys(0)).keys.length>0);}finally{doc.free();}}
 });
}
test('no external requests or uncaught browser errors',()=>{assert.deepEqual(external,[]);assert.deepEqual(errors,[]);});
