import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import JSZip from 'jszip';
import {chromium} from 'playwright';
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:5273';
const out=path.resolve(process.env.GRID_BROWSER_EVIDENCE||'docs/jobs/todo/diffchecker-port-20261023/word-grid-browser');
await fs.mkdir(out,{recursive:true});
async function source(after){
 const z=new JSZip();
 z.file('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
 z.file('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="main" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
 const cells=after?[[2400,'Stable']]:[[1200,'Stable'],[1800,'Deleted']];
 const table='<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/></w:tblPr><w:tblGrid>'+cells.map(([width])=>`<w:gridCol w:w="${width}"/>`).join('')+'</w:tblGrid><w:tr>'+cells.map(([width,text])=>`<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/></w:tcPr><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:tc>`).join('')+'</w:tr></w:tbl>';
 z.file('word/document.xml','<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Grid browser fixture</w:t></w:r></w:p>'+table+'<w:p><w:r><w:t>End</w:t></w:r></w:p><w:sectPr/></w:body></w:document>');
 z.forEach((_,entry)=>{entry.date=new Date('2000-01-01T00:00:00Z');});
 return z.generateAsync({type:'nodebuffer'});
}
const before=await source(false),after=await source(true);
await fs.writeFile(path.join(out,'before.docx'),before);await fs.writeFile(path.join(out,'after.docx'),after);
const browser=await chromium.launch({executablePath:'/usr/bin/google-chrome',args:['--no-sandbox','--disable-dev-shm-usage']});
let checks=0;const records=[];
try{for(const language of ['ko','en']){
 const context=await browser.newContext({serviceWorkers:'block',acceptDownloads:true,viewport:{width:language==='ko'?390:1360,height:1000}});
 await context.addInitScript(lang=>{window.__WORKLAZY_MOCK_PROVIDERS__=true;localStorage.setItem('worklazy-theme',lang==='ko'?'dark-coral':'light-coral');},language);
 const remote=[],errors=[],failed=[];const providers=new Set(['https://wcs.pstatic.net','https://www.googletagmanager.com','https://pagead2.googlesyndication.com','https://ads-partners.coupang.com']);
 await context.route('**/*',route=>{const url=new URL(route.request().url()),external=['http:','https:'].includes(url.protocol)&&url.origin!==new URL(base).origin;if(external)remote.push(url.href);return external?route.abort():route.continue();});
 const page=await context.newPage();page.setDefaultTimeout(180000);page.on('pageerror',error=>errors.push(error.message));page.on('response',response=>{if(new URL(response.url()).origin===new URL(base).origin&&response.status()>=400)failed.push([response.url(),response.status()]);});
 await page.goto(`${base}/${language}/tools/document-compare/`,{waitUntil:'domcontentloaded'});
 const inputs=page.locator('[data-testid=document-file-grid] input[type=file]');
 await inputs.nth(0).setInputFiles({name:'before.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:before});await inputs.nth(1).setInputFiles({name:'after.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:after});
 const format=page.getByRole('switch',{name:language==='ko'?'서식 변경 포함':'Include formatting changes',exact:true});assert.equal(await format.getAttribute('aria-checked'),'true');await format.click();assert.equal(await format.getAttribute('aria-checked'),'false');assert.equal(await page.getByRole('switch',{name:language==='ko'?'표 비교':'Compare tables',exact:true}).getAttribute('aria-checked'),'true');checks+=3;
 await page.locator('[data-testid=document-action-bar] button').first().click();await page.getByTestId('document-result-card').waitFor();assert.equal(await page.getByTestId('document-tracked-download').count(),1);checks++;
 const event=page.waitForEvent('download');await page.getByTestId('document-tracked-download').click();const file=path.join(out,`${language}-tracked.docx`);await(await event).saveAs(file);const zip=await JSZip.loadAsync(await fs.readFile(file)),xml=await zip.file('word/document.xml').async('string');
 const projection=await page.evaluate(xml=>{
  const W='http://schemas.openxmlformats.org/wordprocessingml/2006/main',X='http://www.w3.org/2000/xmlns/',d=new DOMParser().parseFromString(xml,'application/xml'),tbl=d.getElementsByTagNameNS(W,'tbl')[0];
  const child=(parent,name)=>Array.from(parent.children).find(e=>e.namespaceURI===W&&e.localName===name),grid=child(tbl,'tblGrid'),change=child(grid,'tblGridChange');
  const widths=grid=>Array.from(grid.children).filter(e=>e.localName==='gridCol').map(e=>Number(e.getAttributeNS(W,'w'))),prior=child(change,'tblGrid');
  const cells=Array.from(child(tbl,'tr').children).filter(e=>e.localName==='tc'),text=c=>Array.from(c.getElementsByTagNameNS(W,'*')).filter(e=>['t','delText'].includes(e.localName)).map(e=>e.textContent).join('');
  const matrix=reject=>cells.filter(c=>!child(child(c,'tcPr'),reject?'cellIns':'cellDel')).map(text);
  return{afterWidths:widths(grid),beforeWidths:widths(prior),accept:matrix(false),reject:matrix(true),attributes:Array.from(change.attributes).filter(a=>a.namespaceURI!==X).map(a=>[a.namespaceURI,a.localName]),id:change.getAttributeNS(W,'id')};
 },xml);
 assert.deepEqual(projection.afterWidths,[2400]);assert.deepEqual(projection.beforeWidths,[2400,1800]);assert.deepEqual(projection.accept,['Stable']);assert.deepEqual(projection.reject,['Stable','Deleted']);assert.deepEqual(projection.attributes,[['http://schemas.openxmlformats.org/wordprocessingml/2006/main','id']]);assert.match(projection.id,/^\d+$/);checks+=6;
 await page.getByTestId('document-view-result').click();const view=page.getByTestId('document-page-view'),old=view.locator('[data-table-block] [data-document-side=before]'),revised=view.locator('[data-table-block] [data-document-side=after]');await old.first().waitFor({timeout:20000});assert.match(await old.innerText(),/Deleted/);assert.match(await revised.innerText(),/Stable/);checks+=2;
 if(language==='ko'){await page.getByTestId('document-mobile-side').getByRole('button',{name:'수정 후',exact:true}).click();assert.equal(await revised.isVisible(),true);assert.equal(await old.isVisible(),false);checks+=2;}
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));assert.equal(await page.evaluate(()=>!!navigator.serviceWorker.controller),false);checks+=2;
 if(process.env.EXPECT_STATIC==='1'){assert.equal(await page.evaluate(()=>crossOriginIsolated),false);checks++;}
 await view.scrollIntoViewIfNeeded();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));await page.screenshot({path:path.join(out,`${language}-table.png`),animations:'disabled'});
 assert.deepEqual(errors,[]);assert.deepEqual(failed,[]);assert.deepEqual(remote.filter(url=>!providers.has(new URL(url).origin)),[]);checks+=3;records.push({language,projection,blockedRemote:remote,sourceSHA256:{before:createHash('sha256').update(before).digest('hex'),after:createHash('sha256').update(after).digest('hex')}});await context.close();
}await fs.writeFile(path.join(out,'results.json'),JSON.stringify({checks,records,scope:'Actual browser Word worker/UI tablesON-formattingOFF; downloaded native-grid/cell independent projections. Not native editor Accept/Reject proof.'},null,2));console.log(`${checks} passed actual browser table-grid scope/output checks`);}finally{await browser.close();}
