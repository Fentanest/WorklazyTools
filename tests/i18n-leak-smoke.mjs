import fs from 'node:fs/promises';
import path from 'node:path';
import http from 'node:http';
import { chromium } from 'playwright';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import XLSX from 'xlsx';
import JSZip from 'jszip';
import { PNG } from 'pngjs';

const phase = process.env.I18N_PHASE || 'after';
const out = path.resolve(process.env.I18N_OUT || `scratch/i18nleak/runtime-${phase}`);
await fs.mkdir(out, { recursive: true });
const root = path.resolve('dist');
const pixels = new PNG({width:32,height:24});pixels.data.fill(255);const png = PNG.sync.write(pixels);
const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, 'http://localhost');
    if (url.pathname === '/__i18n_fixture.png') { response.writeHead(200, {'Content-Type':'image/png'});response.end(png);return; }
    let target = path.resolve(root, '.' + decodeURIComponent(url.pathname));
    if (!target.startsWith(root + '/') && target !== root) throw new Error('outside root');
    if ((await fs.stat(target).catch(() => null))?.isDirectory()) target = path.join(target, 'index.html');
    let bytes;
    try { bytes = await fs.readFile(target); } catch { target = path.join(root, '404.html'); bytes = await fs.readFile(target); }
    if (target.endsWith('.html')) bytes = Buffer.from(bytes.toString().replaceAll('https://worklazy.net/', base + '/'));
    const type = {'.html':'text/html','.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.json':'application/json','.wasm':'application/wasm','.svg':'image/svg+xml','.woff2':'font/woff2'}[path.extname(target)] || 'application/octet-stream';
    response.writeHead(200, {'Content-Type':type,'Cache-Control':'no-store','Cross-Origin-Opener-Policy':'same-origin','Cross-Origin-Embedder-Policy':'require-corp'});response.end(bytes);
  } catch { response.writeHead(500);response.end('Unavailable'); }
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({executablePath:'/usr/bin/google-chrome',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context = await browser.newContext({viewport:{width:1440,height:1000},locale:'en-US',serviceWorkers:'block'});
const external = new Set();
await context.route('**/*', route => {
  const url = new URL(route.request().url());
  if (!['http:','https:'].includes(url.protocol) || url.origin === base) return route.continue();
  external.add(url.origin);return route.abort();
});
const sitemap = await fs.readFile('dist/sitemap.xml', 'utf8');
const canonical = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/gu)].map(m=>new URL(m[1]).pathname).filter(p=>p.startsWith('/en/'));
const htmlPaths = [];
async function walk(directory) { for(const entry of await fs.readdir(directory,{withFileTypes:true})) {
  const name=path.join(directory,entry.name);if(entry.isDirectory()) await walk(name);
  else if(entry.name==='index.html') htmlPaths.push('/'+path.relative(root,path.dirname(name)).split(path.sep).join('/')+'/');
}}
await walk(path.join(root,'en'));
const allPaths=[...new Set([...canonical,...htmlPaths,'/en/tools/document-compare/results/1/'])].sort();
const paths=process.env.I18N_ROUTES ? process.env.I18N_ROUTES.split(',') : allPaths;
if (!canonical.length || !paths.length || paths.some(p=>!allPaths.includes(p))) throw new Error('Zero or incomplete route selection');
const report={phase,selection:process.env.I18N_ROUTES?'targeted':'all',canonicalPaths:canonical,paths,states:[],failures:[],externalBlocked:[],pageErrors:[]};
const en=JSON.parse(await fs.readFile('src/locales/en/features.json','utf8'));
const doc=await PDFDocument.create();const pdfPage=doc.addPage([320,240]);pdfPage.drawText('English audit sample',{font:await doc.embedFont(StandardFonts.Helvetica),x:20,y:180});
const pdf=Buffer.from(await doc.save());
const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([['Name','Value'],['Alpha',1],['Beta',2]]),'Sample');
const xlsx=XLSX.write(book,{type:'buffer',bookType:'xlsx'});
async function docx(text){const z=new JSZip();z.file('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');z.file('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');z.file('word/document.xml',`<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p><w:sectPr/></w:body></w:document>`);return z.generateAsync({type:'nodebuffer'});}
const word=await docx('English before sample');
const fixture=(name,mimeType,buffer)=>({name,mimeType,buffer});
const fixtures={image:fixture('sample.png','image/png',png),pdf:fixture('sample.pdf','application/pdf',pdf),excel:fixture('sample.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',xlsx),word:fixture('sample.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document',word),text:fixture('sample.txt','text/plain',Buffer.from('English audit sample\nAlpha\nBeta'))};
let page;
async function snapshot(route,state,detail={}) {
  const scan=await page.evaluate(()=>{
    const found=[];const re=/[가-힣ㄱ-ㅎ]/u;const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);
    for(let node=walker.nextNode();node;node=walker.nextNode()) {const p=node.parentElement;if(!p||p.closest('script,style,noscript,textarea')||!p.getClientRects().length)continue;const text=node.textContent.trim();if(re.test(text))found.push({kind:'text',text,element:p.tagName,selector:p.id?'#'+p.id:p.getAttribute('data-testid')||p.tagName});}
    for(const element of document.querySelectorAll('[aria-label],[title],[placeholder],img[alt]'))for(const attr of ['aria-label','title','placeholder','alt']){const text=element.getAttribute(attr);if(text&&re.test(text))found.push({kind:attr,text,element:element.tagName,selector:element.id?'#'+element.id:element.getAttribute('data-testid')||element.tagName});}
    return {found,title:document.title,language:document.documentElement.lang,bodyLength:document.body.innerText.length,redirected:location.pathname};
  });
  const record={route,state,...detail,...scan};report.states.push(record);
  if((route.endsWith('/tools/text-tools/')&&state==='initial')||(route.endsWith('/tools/document-redactor/')&&state==='mask-and-output-warning')) {const shot=path.join(out,route.split('/').filter(Boolean).join('-')+'-'+state+'.png');const target=state==='initial'?page.getByTestId('text-actions').locator('..'):page.getByText(/결과에서 달라지는 점:|What changes in the result:/u).locator('..');await target.screenshot({path:shot});record.screenshot=shot;}
  await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));
  return record;
}
async function click(name){const button=page.getByRole('button',{name,exact:false}).first();if(await button.count()&&await button.isEnabled()){await button.click();return true;}return false;}
async function states(route){
  if(route.endsWith('/tools/text-tools/')) {await page.getByTestId('text-tools-input').fill('  English sample  \nAlpha\nAlpha');await page.getByTestId('text-actions').getByRole('button').first().click();await page.waitForFunction(()=>document.querySelector('[data-testid="text-tools-output"]')?.value.length>0);await snapshot(route,'transform-result');await click(en.textTools.inspect);await page.getByTestId('text-inspection-summary').waitFor();await snapshot(route,'inspection-empty');return;}
  if(route.endsWith('/tools/timezone-calculator/')) {await page.locator('input:not([type=checkbox]):not([type=number]):not([type=datetime-local])').first().fill('zzznomatchaudit');await snapshot(route,'search-empty');return;}
  if(route.endsWith('/tools/text-formatter/')) {await page.locator('textarea').first().fill('{invalid');await click(/Format|Prettify|Indent/u);await page.waitForTimeout(400);await snapshot(route,'invalid-syntax');return;}
  if(route.endsWith('/tools/data-converter/')) {await page.locator('textarea').first().fill('Name,Value\nAlpha,1');await click(/Convert/u);await page.waitForTimeout(400);await snapshot(route,'conversion-attempt');return;}
  const inputs=page.locator('input[type=file]');
  if(route.endsWith('/tools/document-redactor/')) await inputs.first().waitFor({state:'attached',timeout:45000});
  if(!await inputs.count()) {report.states.push({route,state:'not-covered',reason:'No file intake in this state'});return;}
  if(/office-editor|document-to-pdf|hwp-editor/u.test(route)) {report.states.push({route,state:'not-covered',reason:'Office/HWP editor document execution not part of bounded synthetic format probe'});return;}
  let input=inputs.first();const accept=(await input.getAttribute('accept'))||'';
  let sample=/image|\.png/u.test(accept)?fixtures.image:/\.csv|\.xlsx|spreadsheet/u.test(accept)?fixtures.excel:/\.docx|word/u.test(accept)?fixtures.word:/\.txt|text/u.test(accept)?fixtures.text:/pdf/u.test(accept)?fixtures.pdf:null;
  if(!sample){report.states.push({route,state:'not-covered',reason:'No safe supported fixture for input accept='+accept});return;}
  await input.setInputFiles(sample);
  await snapshot(route,'input-selected',{fixture:sample.name});
  await page.waitForTimeout(700);
  if(route.endsWith('/tools/image-privacy/')) {await click(en.imagePrivacy.execute);await page.getByTestId('image-privacy-result').waitFor({timeout:20000});await snapshot(route,'clean-result');}
  else if(route.endsWith('/tools/excel-cleaner/')) {await page.waitForFunction(()=>!document.querySelector('[data-inspecting="true"]'),null,{timeout:20000});await page.getByTestId('excel-cleaner-actions').locator('[data-ui-component=primary-button]').click();await page.getByTestId('excel-cleaner-results').waitFor({timeout:30000});await snapshot(route,'cleaner-result');}
  else if(route.endsWith('/tools/document-redactor/')) {await page.getByTestId('redactor-page-counter').waitFor({timeout:30000});await click(en.documentRedactor.editor.add);await snapshot(route,'mask-and-output-warning');}
  else if(route.endsWith('/tools/document-compare/')) {if(await inputs.count()>1)await inputs.nth(1).setInputFiles({...fixtures.word,name:'after.docx',buffer:await docx('English after sample')});await page.locator('[data-ui-component=primary-button]').filter({hasText:/Compare.*document pairs/u}).click();await page.getByTestId('document-results').waitFor({timeout:30000});await snapshot(route,'comparison-result');}
  else if(route.endsWith('/tools/excel-merger/')) {await input.setInputFiles([fixtures.excel,{...fixtures.excel,name:'second.xlsx'}]);await page.waitForTimeout(600);await snapshot(route,'multiple-workbooks');}
  else if(route.endsWith('/tools/image-studio/')) {await page.waitForTimeout(500);await snapshot(route,'image-loaded');}
  else await snapshot(route,'post-input');
  // Direct invalid input probes the real rejection path without any user data.
  if(await input.count()&&!await input.isDisabled()){await input.setInputFiles(fixture('invalid.pdf','application/pdf',Buffer.from('invalid audit data')));await page.waitForTimeout(400);await snapshot(route,'invalid-file-attempt');}
}
try {
  for(const route of paths){
    page=await context.newPage();page.setDefaultTimeout(12000);page.on('pageerror',e=>report.pageErrors.push({route,message:e.message}));
    try {await page.goto(base+route,{waitUntil:'domcontentloaded',timeout:60000});await page.waitForFunction(()=>document.documentElement.lang==='en'&&document.readyState==='complete'&&!!document.querySelector('#root')?.childElementCount&&!document.querySelector('.tool-route-loading, .seo-static-fallback'),null,{timeout:45000});await page.waitForTimeout(200);const initial=await snapshot(route,'initial');if(initial.bodyLength===0)throw new Error('Empty route');if(canonical.includes(route)&&route.includes('/tools/')&&!route.includes('/tools/office-editor/app/'))await states(route);}
    catch(e){report.failures.push({route,message:e.message});await snapshot(route,'probe-error').catch(()=>{});}
    await page.close();console.log('i18n route:',route,report.states.at(-1)?.state);
  }
  report.externalBlocked=[...external];report.hits=report.states.flatMap(s=>(s.found||[]).map(hit=>({route:s.route,state:s.state,...hit})));
  report.summary={canonical:canonical.length,routes:paths.length,states:report.states.length,hits:report.hits.length,failures:report.failures.length};
  await fs.writeFile(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report.summary));
} finally {await context.close();await browser.close();await new Promise(resolve=>server.close(resolve));}
if(report.failures.length||phase!=='before'&&report.hits.length)process.exitCode=1;
