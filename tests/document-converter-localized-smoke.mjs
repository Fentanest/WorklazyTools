import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const repo=path.resolve(import.meta.dirname,'..');
const out=await fs.mkdtemp('/tmp/worklazy-t7-localized-');
const require=createRequire(repo+'/package.json');
const {chromium}=require('playwright'),{PDFDocument}=require('pdf-lib'),JSZip=require('jszip'),{PNG}=require('pngjs');
const fixture=repo+'/tests/fixtures/document-converters';
const sha=b=>createHash('sha256').update(b).digest('hex');
const load=async p=>JSON.parse(await fs.readFile(p,'utf8'));
const metadata=[];const {JSDOM}=require('jsdom');
for(const language of ['ko','en'])for(const route of ['document-markdown','pdf-converter','pdf-converter/image-to-pdf','pdf-converter/pdf-to-image','pdf-converter/document-to-pdf','pdf-converter/pdf-to-document','pdf-converter/pdf-to-document/ocr']){
 const dom=new JSDOM(await fs.readFile(path.join(repo,'dist',language,'tools',route,'index.html'),'utf8')),d=dom.window.document;
 metadata.push({language,route:'tools/'+route,title:d.title,description:[d.querySelector('meta[name=description]').content],canonical:[d.querySelector('link[rel=canonical]').href],alternates:Object.fromEntries([...d.querySelectorAll('link[rel=alternate][hreflang]')].map(e=>[e.hreflang,e.href]))});dom.window.close();
}
const guides={ko:await load(repo+'/src/locales/ko/guides.json'),en:await load(repo+'/src/locales/en/guides.json')};
const features={ko:await load(repo+'/src/locales/ko/features.json'),en:await load(repo+'/src/locales/en/features.json')};
const result={baseWithAuthorizedWorkingChanges:execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),launch:{executablePath:'/usr/bin/google-chrome',headless:true,args:["--no-sandbox","--disable-dev-shm-usage"]},started:new Date().toISOString(),cases:[],blocked:[],pageerrors:[],fixtureHashes:{},screenshots:[],notes:['Read-only built candidate; provider requests blocked; synthetic inputs only. Controlled fault is diagnostic injection, not natural fixture failure.']};
for(const name of ['rich.pdf','review-badimage.pdf','sample.docx','sample.hwpx','scanned.pdf','markdown-expected.json'])result.fixtureHashes[name]=sha(await fs.readFile(path.join(fixture,name)));
const sourcePaths=['src/components/LanguageSwitcher.tsx','src/app/App.tsx','src/app/seo.ts','src/features/pdf-editor/pdfExtractImages.ts','src/features/pdf-editor/pdfPreview.ts','src/features/pdf-editor/PdfConvertPanel.tsx','src/features/pdf-editor/pdfUi.tsx','src/features/document-markdown/DocumentMarkdownPage.tsx','src/features/pdf-converter/HwpPdfPanel.tsx'];
result.sourceHashes=Object.fromEntries(await Promise.all(sourcePaths.map(async p=>[p,sha(await fs.readFile(repo+'/'+p))])));
let server,context,page;
const persist=()=>fs.writeFile(out+'/results.json',JSON.stringify(result,null,2)+'\n');
async function run(id,fn){const c={id,status:'RUNNING',started:new Date().toISOString()};result.cases.push(c);console.log('START',id);try{await fn(c);c.status='PASS';}catch(e){c.status='FAIL';c.error=String(e);c.stack=e.stack;try{await shot(id+'-failure');}catch{}}c.finished=new Date().toISOString();console.log(c.status,id,c.error||'');await persist();}
async function shot(name,loc){const file=name+'.png';await (loc||page).screenshot({path:path.join(out,file),...(loc?{}:{fullPage:false})});result.screenshots.push(file);return file;}
async function open(route,lang='ko'){await page.goto(server.url+'/'+lang+'/tools/'+route+'/');await page.locator('[data-tool-page]').waitFor();}
async function bytes(id='pdf-download'){const a=page.getByTestId(id);await a.waitFor();return Buffer.from(await a.evaluate(async a=>Array.from(new Uint8Array(await(await fetch(a.href)).arrayBuffer()))));}
async function resultOrError(){await page.waitForFunction(()=>!!document.querySelector('[data-testid=pdf-download], [role=alert]'));assert.deepEqual(await page.getByRole('alert').allTextContents(),[]);}
async function uploadPdf(name){await page.locator('input[type=file]').setInputFiles(path.join(fixture,name));await page.locator('.pdf-page-card').first().waitFor();await page.waitForFunction(()=>[...document.querySelectorAll('[data-testid=pdf-output-card] button')].some(b=>/로 변환|Convert to/.test(b.textContent)&&!b.disabled));}
async function convert(format,lang='ko'){await page.getByRole('radio',{name:new RegExp('^'+format.toUpperCase())}).click();await page.getByRole('button',{name:lang==='ko'?format.toUpperCase()+'로 변환':'Convert to '+format.toUpperCase(),exact:true}).click();}
function normUrl(v){const u=new URL(v);assert.ok([server.url,'https://worklazy.net'].includes(u.origin),'unexpected metadata origin '+u.origin);return u.pathname+u.search+u.hash;}
try{
 server={url:process.env.TEST_BASE_URL||'http://127.0.0.1:4197',close:async()=>{}};result.baseURL=server.url;
 context=await chromium.launchPersistentContext(out+'/profile',{...result.launch,viewport:{width:1440,height:1000},reducedMotion:'reduce',timeout:20000});result.browser=context.browser().version();
 await context.addInitScript(()=>{localStorage.setItem('worklazy_privacy_consent_v2','denied');window.__WORKLAZY_MOCK_PROVIDERS__=true;window.print=()=>{window.top.__printCapture={url:location.href,html:document.documentElement.outerHTML};};});
 await context.route('**/*',route=>{const req=route.request(),u=new URL(req.url());if(/^https?:$/.test(u.protocol)&&(!['GET','HEAD'].includes(req.method())||u.origin!==server.url)){result.blocked.push({method:req.method(),url:u.href});return route.abort();}return route.continue();});
 page=await context.newPage();page.setDefaultTimeout(25000);page.on('pageerror',e=>result.pageerrors.push(e.message));
 const routes=['document-markdown','pdf-converter','pdf-converter/image-to-pdf','pdf-converter/pdf-to-image','pdf-converter/document-to-pdf','pdf-converter/pdf-to-document','pdf-converter/pdf-to-document/ocr'];
 for(const route of routes)await run('switch-'+route.replaceAll('/','-'),async c=>{
  c.states=[];await open(route);
  for(const [i,lang] of ['ko','en','ko'].entries()){
   if(i){const selectors=page.locator('select[data-ui-component=language-switcher]');let chosen;for(let j=0;j<await selectors.count();j++)if(await selectors.nth(j).isVisible()){chosen=selectors.nth(j);break;}assert.ok(chosen);await chosen.selectOption(lang);}
   const expected=metadata.find(r=>r.language===lang&&r.route==='tools/'+route);assert.ok(expected);
   await page.waitForFunction(({lang,title})=>document.documentElement.lang===lang&&document.title===title,{lang,title:expected.title});
   const guide=guides[lang][route==='document-markdown'?'documentMarkdown':'pdfConverter'];
   let heading=route==='document-markdown'?(lang==='ko'?'문서 → Markdown':'Document to Markdown'):route.includes('document-to-pdf')?(lang==='ko'?'문서 → PDF':'Document → PDF'):route.includes('pdf-to-document')?(lang==='ko'?'PDF → 문서':'PDF → Document'):features[lang].pdf.page.modes[route.endsWith('pdf-to-image')?'pdf-to-image':'image-to-pdf'].title;
   await page.getByRole('heading',{level:1,name:heading,exact:true}).waitFor();
   await page.getByText(guide.title,{exact:true}).waitFor();await page.getByText(guide.description,{exact:true}).waitFor();
   const faq=Object.values(guide.faq)[0];await page.getByText(faq.q,{exact:true}).waitFor();
   const state=await page.evaluate(()=>({url:location.href,lang:document.documentElement.lang,title:document.title,description:document.querySelector('meta[name=description]')?.content,canonical:document.querySelector('link[rel=canonical]')?.href,alternates:Object.fromEntries([...document.querySelectorAll('link[rel=alternate][hreflang]')].map(e=>[e.hreflang,e.href]))}));
   assert.equal(new URL(state.url).pathname.replace(/\/$/,''),'/'+lang+'/tools/'+route);assert.equal(state.description,expected.description[0]);assert.equal(normUrl(state.canonical),normUrl(expected.canonical[0]));
   for(const language of ['ko','en','x-default'])assert.equal(normUrl(state.alternates[language]),normUrl(expected.alternates[language]));
   if(route.endsWith('/ocr'))assert.equal(await page.getByRole('radio',{name:lang==='ko'?/^검색 PDF/:/^Searchable PDF/}).getAttribute('aria-checked'),'true');
   c.states.push({...state,heading,guideTitle:guide.title,faqQuestion:faq.q,checks:'heading, help title/description, FAQ question, title, description, canonical, 3 hreflang and html lang'});
   if(i){await page.evaluate(()=>scrollTo(0,0));await shot(c.id+'-'+lang);}
  }
 });
 await run('ko-markdown-cancel',async c=>{
  await open('document-markdown');let held;await page.route('**/vendor/markitdown/0.1.8/converters.zip',r=>{held=r;});
  try{await page.locator('input[type=file]').setInputFiles(path.join(fixture,'sample.docx'));await page.getByRole('button',{name:'Markdown 만들기',exact:true}).click();await page.locator('.ui-operation-progress.ui-status-running').waitFor();await page.getByRole('button',{name:'취소',exact:true}).click();assert.equal(await page.getByTestId('markdown-download').count(),0);assert.equal(await page.locator('.ui-operation-progress.ui-status-running').count(),0);c.heldAssetRequested=!!held;c.text=await page.locator('[data-tool-page]').innerText();await shot(c.id);}
  finally{await page.unroute('**/vendor/markitdown/0.1.8/converters.zip');if(held)await held.abort().catch(()=>{});}
 });
 await run('ko-markdown-success',async c=>{
  await page.locator('input[type=file]').setInputFiles(path.join(fixture,'sample.docx'));await page.getByRole('button',{name:'Markdown 만들기',exact:true}).click();await page.getByTestId('markdown-download').waitFor({timeout:150000});const expected=(await load(fixture+'/markdown-expected.json')).docx;const md=(await bytes('markdown-download')).toString();assert.equal(md,expected);await fs.writeFile(out+'/ko-result.md',md);await page.getByRole('heading',{name:'Markdown 결과',exact:true}).waitFor();await page.getByTestId('markdown-download').scrollIntoViewIfNeeded();c.outputSha256=sha(md);c.downloadText=await page.getByTestId('markdown-download').innerText();await shot(c.id);});
 await run('ko-markdown-damaged-error',async c=>{await page.locator('input[type=file]').setInputFiles({name:'broken.docx',mimeType:'application/octet-stream',buffer:Buffer.from('not an Office ZIP')});await page.getByRole('button',{name:'Markdown 만들기',exact:true}).click();const alert=page.getByRole('alert');await alert.waitFor({timeout:150000});c.alert=await alert.innerText();assert.match(c.alert,/문서를 변환하지 못했습니다/);assert.equal(await page.getByTestId('markdown-download').count(),0);await alert.scrollIntoViewIfNeeded();await shot(c.id);});
 await run('ko-image-to-pdf-success',async c=>{await open('pdf-converter/image-to-pdf');const png=new PNG({width:160,height:80});for(let i=0;i<png.data.length;i+=4)png.data.set([210,40,30,255],i);const input=PNG.sync.write(png);await fs.writeFile(out+'/synthetic.png',input);result.fixtureHashes['synthetic.png']=sha(input);await page.locator('input[type=file]').setInputFiles({name:'synthetic.png',mimeType:'image/png',buffer:input});await page.getByRole('button',{name:'PDF 만들기',exact:true}).click();const b=await bytes();assert.equal((await PDFDocument.load(b)).getPageCount(),1);await fs.writeFile(out+'/ko-image.pdf',b);c.outputSha256=sha(b);await page.getByTestId('pdf-download').scrollIntoViewIfNeeded();await shot(c.id);});
 await run('ko-pdf-to-pptx-success',async c=>{await open('pdf-converter/pdf-to-document');await uploadPdf('rich.pdf');await convert('pptx');await resultOrError();const b=await bytes(),zip=await JSZip.loadAsync(b),names=Object.keys(zip.files).filter(n=>/^ppt\/slides\/slide\d+\.xml$/.test(n));const xml=(await Promise.all(names.map(n=>zip.file(n).async('string')))).join('');assert.match(xml,/한글/);assert.match(xml,/42/);assert.equal(Object.keys(zip.files).filter(n=>/^ppt\/media\/.*\.png$/.test(n)).length,2);await fs.writeFile(out+'/ko-rich.pptx',b);c.outputSha256=sha(b);c.slides=names.length;await page.getByTestId('pdf-download').scrollIntoViewIfNeeded();await shot(c.id);});
 await run('ko-pdf-corrupt-image-error',async c=>{await uploadPdf('review-badimage.pdf');await convert('pptx');await page.getByTestId('pdf-error').waitFor();c.alert=await page.getByTestId('pdf-error').innerText();assert.match(c.alert,/이미지.*(읽지 못|디코딩|중단)/);assert.equal(await page.getByTestId('pdf-download').count(),0);await page.getByTestId('pdf-error').scrollIntoViewIfNeeded();await shot(c.id);});
 await run('ko-ocr-scanned-hwpx-success',async c=>{await open('pdf-converter/pdf-to-document');await uploadPdf('scanned.pdf');await convert('hwpx');await page.getByTestId('pdf-download').waitFor({timeout:150000});const b=await bytes(),zip=await JSZip.loadAsync(b),names=Object.keys(zip.files).filter(n=>/^Contents\/section\d+\.xml$/.test(n));const xml=(await Promise.all(names.map(n=>zip.file(n).async('string')))).join('');assert.match(xml,/FIRST PAGE/);assert.match(xml,/42/);assert.ok(Object.keys(zip.files).some(n=>/^BinData\//.test(n)&&!zip.files[n].dir));await fs.writeFile(out+'/ko-scan.hwpx',b);c.outputSha256=sha(b);c.visibleText=await page.locator('[data-tool-page]').innerText();assert.match(c.visibleText,/한국어·영어 OCR 결과/);await page.getByTestId('pdf-download').scrollIntoViewIfNeeded();await shot(c.id);});
 await run('ko-hwp-print-guidance-cancel',async c=>{await open('pdf-converter/document-to-pdf');await page.waitForFunction(()=>crossOriginIsolated,{},{timeout:30000});await page.locator('input[type=file]').setInputFiles(path.join(fixture,'sample.hwpx'));const b=page.getByRole('button',{name:'인쇄 창에서 PDF 저장',exact:true});await b.click({timeout:120000});const frame=page.frameLocator('[data-testid=hwp-pdf-preview] iframe');await frame.getByRole('button',{name:'인쇄 창 열기',exact:true}).waitFor();c.guidance=await frame.locator('body').innerText();c.iframe=await page.locator('[data-testid=hwp-pdf-preview] iframe').getAttribute('src');assert.match(c.guidance,/인쇄/);await page.getByTestId('hwp-pdf-preview').scrollIntoViewIfNeeded();await shot(c.id);await frame.getByRole('button',{name:'취소',exact:true}).click();assert.equal(await page.evaluate(()=>!!window.__printCapture),false);assert.equal(await page.getByTestId('document-pdf-download').count(),0);});
 for(const lang of ['ko','en'])await run('guide-readable-'+lang,async c=>{await open('document-markdown',lang);await page.getByText(guides[lang].documentMarkdown.title,{exact:true}).scrollIntoViewIfNeeded();await shot(c.id);c.title=guides[lang].documentMarkdown.title;});
}catch(e){result.environmentFailure=String(e);console.log('ENVIRONMENT_FAILURE',String(e));}
finally{await context?.close().catch(()=>{});await server?.close().catch(()=>{});result.finished=new Date().toISOString();result.finalHead=execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim();result.finalStatus=execFileSync('git',['status','--porcelain'],{cwd:repo,encoding:'utf8'}).trim();result.passed=result.cases.filter(x=>x.status==='PASS').length;result.failed=result.cases.filter(x=>x.status==='FAIL').length;await persist();console.log(JSON.stringify({passed:result.passed,failed:result.failed,environmentFailure:result.environmentFailure}));}

console.log("Evidence:",out);console.log("# tests "+result.cases.length);if(result.failed||result.environmentFailure)process.exitCode=1;
