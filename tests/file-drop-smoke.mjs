import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import { chromium } from "playwright";
import * as XLSX from "xlsx";
import JSZip from "jszip";
import { PDFDocument } from "pdf-lib";
import { startOwnedPreview, stopOwnedPreview } from "./helpers/owned-preview.mjs";

const output = process.env.FILE_DROP_OUTPUT || "/tmp/sol-h1core/browser";
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jP1sAAAAASUVORK5CYII=", "base64");
const payload = (name, buffer, mimeType = "application/octet-stream") => ({ name, buffer: Buffer.from(buffer), mimeType });
export async function dropFiles(page, files) {
  await page.evaluate(items => {
    const data = new DataTransfer();
    for (const item of items) data.items.add(new File([new Uint8Array(item.bytes)], item.name, { type: item.type }));
    document.querySelector(".wl-hero-art").dispatchEvent(new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: data }));
  }, files.map(file => ({ name: file.name, bytes: [...file.buffer], type: file.mimeType })));
  await page.waitForFunction(() => !document.querySelector('[data-testid="home-dropzone"] button:disabled'));
}
async function environment() {
  await fs.mkdir(output, { recursive: true });
  const base = process.env.TEST_BASE_URL || `http://127.0.0.1:${process.env.FILE_DROP_PORT || 5370}`;
  const server = process.env.TEST_BASE_URL ? null : await startPreview(new URL(base).port);
  try {
    const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || "/usr/bin/google-chrome", args: ["--no-sandbox", "--disable-dev-shm-usage"] });
    return { browser, base, close: async () => { try { await browser.close(); } finally { await stopOwnedPreview(server); } } };
  } catch (error) {
    await stopOwnedPreview(server);
    throw error;
  }
}
async function home(env, language = "ko", width = 1280, dark = false) {
  const context = await env.browser.newContext({ viewport: { width, height: 940 }, serviceWorkers: "block" });
  await context.addInitScript(dark => { if (dark) localStorage.setItem("worklazy-theme", "dark-mint"); }, dark);
  const requests = []; const errors = [];
  context.on("request", request => requests.push({ url: request.url(), body: request.postData() }));
  await context.route("**/*", route => new URL(route.request().url()).origin === new URL(env.base).origin ? route.continue() : route.abort());
  const page = await context.newPage(); page.setDefaultTimeout(45000); page.on("pageerror", error => errors.push(error.message)); page.on("dialog", dialog => dialog.accept());
  await page.goto(`${env.base}/${language}/`, { waitUntil: "networkidle" });
  await page.locator(".home-page .wl-hero").waitFor();
  return { context, page, requests, errors };
}
export async function runHomeAssets() {
  const env = await environment();
  try {
    for (const language of ["ko", "en"]) for (const width of [390,1280]) for (const dark of [false,true]) await test(`H1 home ${language} ${width} ${dark?"dark":"light"}: copy, catalog, responsive intake`, async () => {
      const {context,page,errors}=await home(env,language,width,dark);
      try {
        const copy=JSON.parse(await fs.readFile(`src/locales/${language}/common.json`,"utf8")).home;
        assert.equal(await page.locator(".wl-hero h1 .wl-accent").innerText(),copy.titleAccent);
        assert.equal(await page.locator(".wl-hero-badge").innerText(),copy.kicker);
        assert.equal(await page.locator(".wl-hero-copy > p").innerText(),copy.description);
        assert.equal(await page.locator(".wl-hero-assure strong").innerText(),copy.noUploadTitle);
        assert.equal(await page.locator(".wl-hero-assure small").innerText(),copy.noUploadBody);
        assert.equal(await page.locator(".wl-hero-art img").count(),0);
        assert.equal(await page.locator('[data-testid="home-dropzone"]').count(),1);
        assert.equal(await page.locator(".tool-grid a.ui-tool-card").count(),language==="ko"?12:13);
        assert.equal(await page.locator(".home-how-grid > div").count(),3);
        assert.ok((await page.locator(".wl-cta").getAttribute("href")).endsWith(`/${language}/tools`));
        assert.equal(await page.locator("h1").count(),1);
        const geometry=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,theme:document.documentElement.dataset.theme}));
        assert.ok(geometry.scroll<=width,JSON.stringify(geometry));
        const drop=page.locator('[data-testid="home-dropzone"]');await drop.scrollIntoViewIfNeeded();
        await page.screenshot({path:path.join(output,`home-${language}-${width}-${dark?"dark":"light"}.png`),fullPage:true});
        await dropFiles(page,[payload("private-sheet.csv","name,value\nA,1"),payload("private-image.png",png)]);
        assert.equal(await page.locator(".home-drop-bundle-note").innerText(),copy.dropzone.bundle);
        assert.equal(await page.locator(".home-drop-group").count(),2);
        assert.ok(await page.locator('[data-receiver="excel-cleaner"]').isVisible());
        await drop.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(output,`mixed-${language}-${width}-${dark?"dark":"light"}.png`),fullPage:true});await drop.screenshot({path:path.join(output,`intake-${language}-${width}-${dark?"dark":"light"}.png`)});
        assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
        if(width===390){await page.locator(".home-drop-bundle-note").evaluate(node=>node.scrollIntoView({block:"center",behavior:"instant"}));assert.equal(await page.locator(".wl-hero").evaluate(node=>node.scrollTop),0,"intake focus must not scroll the hero internally");await page.screenshot({path:path.join(output,`bundle-visible-${language}-${dark?"dark":"light"}.png`)});}
      } finally {await context.close();}
    });
  } finally {await env.close();}
}
async function runDropSmoke() {
  const env=await environment(); const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,XLSX.utils.aoa_to_sheet([["name","value"],["A",1]]),"Data");
  const xlsx=payload("sensitive-book.xlsx",XLSX.write(book,{type:"buffer",bookType:"xlsx"}));
  const pdf=await PDFDocument.create();pdf.addPage();const pdfFile=payload("private-document.pdf",await pdf.save(),"application/pdf");
  const zip=new JSZip();zip.file("[Content_Types].xml",'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');zip.file("_rels/.rels",'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');zip.file("word/document.xml",'<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>{name}</w:t></w:r></w:p></w:body></w:document>');
  const docx=payload("private-template.docx",await zip.generateAsync({type:"nodebuffer"}));
  const img=payload("private-image.png",png,"image/png");
  try {
    if(process.env.FILE_DROP_NEGATIVE) {
      await test("baseline must support actual home drop to cleaner",async()=>{const {context,page}=await home(env);try{await dropFiles(page,[xlsx]);await page.locator('[data-receiver="excel-cleaner"]').waitFor({timeout:3000});}finally{await context.close();}});return;
    }
    for(const row of [
      {name:"single Excel",files:[xlsx],receiver:"excel-cleaner",ready:'[data-testid="excel-cleaner-file"]'},
      {name:"multiple Excel",files:[xlsx,payload("second.csv","name,value\nB,2")],receiver:"excel-merger",ready:'[data-testid="excel-file-item"][data-inspection="ready"]'},
      {name:"mail merge",files:[docx,xlsx],receiver:"document-generator",ready:'[data-tool-page="document-generator"] input[value="name"]'},
      {name:"single PDF",files:[pdfFile],receiver:"pdf-organize",ready:'[data-page-action="rotate"]'},
      {name:"multiple images",files:[img,payload("second.png",png,"image/png")],receiver:"image-batch",ready:'.image-studio-page'},
      {name:"selection privacy",files:[img],receiver:"image-privacy",ready:'[data-tool-page="image-privacy"]'},
      {name:"mixed only selected group",files:[xlsx,pdfFile],receiver:"excel-cleaner",ready:'[data-testid="excel-cleaner-file"]'},
    ].filter(row => !process.env.FILE_DROP_CASE || row.receiver === process.env.FILE_DROP_CASE)) await test(`home drop → ${row.name}`,async()=>{
      const {context,page,requests,errors}=await home(env);try{
        const start=requests.length;await dropFiles(page,row.files);
        if(row.name.startsWith("mixed"))assert.ok(await page.locator(".home-drop-bundle-note").isVisible());
        await page.locator(`[data-receiver="${row.receiver}"]`).click();await page.waitForURL(/\/tools\//);await page.locator(`[data-tool-page]`).first().waitFor();
        // Readiness is checked on actual inspection state, not navigation alone.
        if(row.receiver==="excel-cleaner") await page.waitForFunction(()=>document.querySelectorAll('[data-testid="excel-cleaner-sheets"]').length>0);
        else if(row.receiver==="excel-merger")await page.waitForFunction(()=>document.querySelectorAll('[data-testid="excel-file-item"][data-inspection="ready"]').length===2);
        else if(row.receiver==="document-generator")await page.waitForFunction(()=>document.querySelector('[data-tool-page="document-generator"]')?.textContent.includes("name")&&document.querySelectorAll('[data-tool-page="document-generator"] select').length>0);
        else if(row.receiver==="pdf-organize")await page.locator('[data-page-action="rotate"]').first().waitFor();
        else if(row.receiver==="image-batch")await page.waitForFunction(()=>document.body.textContent.includes("second.png"));
        else await page.waitForFunction(()=>document.querySelector('[data-ui-component="file-drop-zone"] strong')?.textContent.includes("1"));
        assert.equal(await page.locator('[data-handoff-recovery], [data-pdf-handoff-recovery]').count(),0);
        if(row.name.startsWith("mixed"))assert.ok(!await page.locator('[data-tool-page]').first().innerText().then(text=>text.includes("private-document.pdf")));
        const leaked=requests.slice(start).filter(request=>row.files.some(file=>JSON.stringify(request).includes(file.name)));
        assert.deepEqual(leaked,[]);assert.deepEqual(errors,[]);
        await fs.writeFile(path.join(output,`${row.receiver}-${row.name.split(" ")[0]}-requests.json`),JSON.stringify(requests.slice(start),null,2));
      } catch (error) { await page.screenshot({path:path.join(output,`failure-${row.receiver}.png`),fullPage:true}); await fs.writeFile(path.join(output,`failure-${row.receiver}.txt`),await page.locator("body").innerText()); throw error; } finally {await context.close();}
    });
    await test("51 files refused; video/unknown browse; append/remove recompute rules; clipboard image",async()=>{
      const {context,page}=await home(env);try{
        await dropFiles(page,Array.from({length:51},(_,i)=>payload(`f${i}.csv`,"a\n1")));assert.ok((await page.locator('[role="alert"]').innerText()).includes("50"));assert.equal(await page.locator('[data-receiver]').count(),0);
        await dropFiles(page,[payload("movie.mp4","video"),payload("other.bin","unknown")]);assert.equal(await page.locator('.home-drop-actions a').count(),2);assert.ok((await page.locator('[data-intake-kind="video"]').innerText()).includes("현재 제공하지"));
        await page.locator('.home-drop-summary button').click();await dropFiles(page,[xlsx]);await page.locator('input[type="file"]').setInputFiles([payload("next.csv","name\nA")]);await page.locator('[data-receiver="excel-merger"]').waitFor();
        await page.getByRole("button",{name:"next.csv 제거",exact:true}).click();assert.equal(await page.locator('[data-receiver="office"]').count(),1);
        await page.locator('.home-drop-summary button').click();
        await page.evaluate(bytes=>{const dt=new DataTransfer();dt.items.add(new File([new Uint8Array(bytes)],"pasted.png",{type:"image/png"}));document.body.dispatchEvent(new ClipboardEvent("paste",{bubbles:true,cancelable:true,clipboardData:dt}));},[...png]);await page.locator('[data-receiver="image-edit"]').waitFor();
      }finally{await context.close();}
    });
    await test("Office uses persistent handoff and file-free URL",async()=>{
      const {context,page,requests}=await home(env);try{
        // Hold the application document: inspect the record after sender staging,
        // before the existing Office receiver consumes it and loads its runtime.
        await page.route('**/tools/office-editor/app',route=>route.fulfill({status:200,contentType:"text/html",body:"<title>Office handoff capture</title>"}));
        await dropFiles(page,[docx]);await page.locator('[data-receiver="office"]').click();await page.waitForURL('**/tools/office-editor/app');
        assert.ok(!page.url().includes("private"));
        const record=await page.evaluate(async()=>{const db=await new Promise((resolve,reject)=>{const req=indexedDB.open("worklazy-office-handoff");req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});const rows=await new Promise(resolve=>{const req=db.transaction("records").objectStore("records").getAll();req.onsuccess=()=>resolve(req.result);});db.close();return rows.map(row=>({name:row.file?.name,receiver:row.receiverId}));});
        assert.deepEqual(record,[{name:docx.name,receiver:"office-editor"}]);assert.ok(!requests.some(req=>JSON.stringify(req).includes(docx.name)));
        await page.unroute('**/tools/office-editor/app');await page.reload({waitUntil:"domcontentloaded"});
        const toolbar=page.locator('[data-testid="office-toolbar-document"]');await toolbar.waitFor();assert.ok((await toolbar.innerText()).includes(docx.name));
        const remaining=await page.evaluate(async()=>{const db=await new Promise(resolve=>{const request=indexedDB.open("worklazy-office-handoff");request.onsuccess=()=>resolve(request.result)});const count=await new Promise(resolve=>{const request=db.transaction("records").objectStore("records").count();request.onsuccess=()=>resolve(request.result)});db.close();return count;});assert.equal(remaining,0);assert.ok(!requests.some(req=>JSON.stringify(req).includes(docx.name)));
      }finally{await context.close();}
    });
    if (!process.env.FILE_DROP_HOME_ONLY) await runLegacyDropSmoke(env.base);
  }finally{await env.close();}
}
if(import.meta.url===pathToFileURL(process.argv[1]).href)await runDropSmoke();

async function runLegacyDropSmoke(serverBase) {
  const { StandardFonts } = await import("pdf-lib");
  const { PNG } = await import("pngjs");
const base = serverBase;
const output = process.env.FILE_DROP_OUTPUT || '/tmp/worklazy-file-drop';
await fs.mkdir(output, { recursive: true });
for (const name of ['A', 'B']) {
  const pdf = await PDFDocument.create(); const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let n = 1; n <= 3; n++) pdf.addPage([300, 400]).drawText(`${name}${n}`, { x: 40, y: 200, font, size: 36 });
  await fs.writeFile(path.join(output, `${name}.pdf`), await pdf.save());
}
const png = new PNG({ width: 8, height: 8 }); png.data.fill(255);
await fs.writeFile(path.join(output, 'image.png'), PNG.sync.write(png));
await fs.writeFile(path.join(output, 'one.txt'), 'first file');
await fs.writeFile(path.join(output, 'two.txt'), 'second file');
await fs.writeFile(path.join(output, 'data.json'), '{"hello":"world"}');
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
// Keep automation from contacting production advertising/analytics providers.
await context.route('**/*', route => {
  const url = new URL(route.request().url());
  return url.origin === new URL(base).origin || ['blob:', 'data:'].includes(url.protocol) ? route.continue() : route.abort();
});
const page = await context.newPage(); page.setDefaultTimeout(30000);
const errors = []; page.on('pageerror', error => errors.push(error.message));
const cdp = await context.newCDPSession(page);
const results = [];
async function drop(file, x = 800, y = 35) {
  const data = { items: [], files: [path.join(output, file)], dragOperationsMask: 1 };
  await cdp.send('Input.dispatchDragEvent', { type: 'dragEnter', x, y, data });
  await page.getByTestId('global-file-drop').waitFor();
  await cdp.send('Input.dispatchDragEvent', { type: 'dragOver', x, y, data });
  await cdp.send('Input.dispatchDragEvent', { type: 'drop', x, y, data });
  await page.getByTestId('global-file-drop').waitFor({ state: 'hidden' });
}
async function at(locator, file) {
  await locator.scrollIntoViewIfNeeded(); const box = await locator.boundingBox();
  await drop(file, box.x + box.width / 2, box.y + box.height / 2);
}
try {
  await page.goto(`${base}/en/tools/pdf-editor`);
  await page.locator('input[type=file]').first().setInputFiles(path.join(output, 'A.pdf'));
  await page.locator('.pdf-page-card').nth(2).waitFor();
  await page.locator('.pdf-page-card').first().locator('[data-page-action=rotate]').click();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  assert.equal(await page.locator('[data-ui-part=drop-target]').first().isVisible(), true); // mounted, above viewport
  assert.ok((await page.locator('[data-ui-part=drop-target]').first().boundingBox()).y < 0);
  await drop('B.pdf', 1000, 700);
  await page.waitForFunction(() => document.querySelectorAll('.pdf-page-card').length === 6);
  assert.equal(await page.locator('.pdf-page-card').first().getAttribute('data-rotation'), '90');
  await at(page.locator('[data-ui-part=drop-target]').first(), 'A.pdf');
  await page.waitForFunction(() => document.querySelectorAll('.pdf-page-card').length === 9);
  results.push('PDF: offscreen upload + page state retained, box drop consumed once');

  await page.goto(`${base}/en/tools/pdf-compare`);
  await page.locator('input[type=file]').first().waitFor({ state: 'attached' });
  await drop('A.pdf');
  const chooser = page.getByTestId('file-drop-target-choice'); await chooser.waitFor();
  await chooser.getByRole('button').nth(1).click();
  assert.deepEqual(await page.locator('input[type=file]').evaluateAll(inputs => inputs.map(input => input.closest('[data-ui-component=file-drop-zone]').textContent.includes('1 file'))), [false, true]);
  await at(page.locator('[data-ui-part=drop-target]').first(), 'B.pdf');
  assert.equal(await chooser.count(), 0);
  results.push('PDF compare: background destination chooser + explicit box destination');

  await page.goto(`${base}/en/tools/text-merger`);
  await page.locator('input[type=file]').waitFor({ state: 'attached' });
  await drop('one.txt'); await page.locator('input[value="one.txt"]').waitFor();
  await drop('two.txt'); await page.locator('input[value="two.txt"]').waitFor();
  assert.equal(await page.locator('input[value="one.txt"]').count(), 1);
  results.push('Native text input: append through existing change handler, no stale PDF target');

  await page.goto(`${base}/en/tools/data-converter`);
  await page.locator('input[type=file]').waitFor({ state: 'attached' });
  await drop('data.json');
  await page.waitForFunction(() => [...document.querySelectorAll('textarea')].some(input => input.value.includes('world')));
  results.push('UtilityInput file input: background drop delivered');
  await page.screenshot({ path: path.join(output, 'data-converter.png'), fullPage: true });
  await page.goto(`${base}/en/tools/image-studio`);
  await page.getByRole('button', { name: 'Batch edit', exact: true }).click();
  await page.getByRole('button', { name: 'Join & collage', exact: true }).click();
  await drop('image.png');
  assert.equal(await page.getByTestId('file-drop-target-choice').count(), 0);
  await page.locator('[data-image-owner=collage] [data-ui-component=file-list] li').waitFor();
  assert.equal(await page.locator('[data-image-owner=batch] [data-ui-component=file-list] li').count(), 0);
  await page.getByRole('button', { name: 'Batch edit', exact: true }).click();
  await drop('image.png');
  await page.getByTestId('file-drop-target-choice').waitFor();
  assert.equal(await page.getByTestId('file-drop-target-choice').getByRole('button').count(), 3);
  await page.getByTestId('file-drop-target-choice').getByRole('button', { name: 'Watermark image' }).click();
  assert.equal(await page.locator('[data-image-owner=batch] input[type=file]').nth(1).evaluate(input => input.files.length), 1);
  assert.equal(await page.locator('[data-image-owner=batch] [data-ui-component=file-list] li').count(), 0);
  results.push('Hidden image tabs excluded; main-image versus watermark choice routes correctly');
  await page.screenshot({ path: path.join(output, 'image-batch.png'), fullPage: true });
  await page.goto(`${base}/en/tools/pdf-editor/finish`);
  await page.locator('input[type=file]').first().setInputFiles(path.join(output, 'A.pdf'));
  await page.getByTestId('pdf-finish-range').waitFor();
  await page.getByTestId('pdf-finish-range').fill('2');
  await page.getByTestId('pdf-finish-range').blur();
  await drop('B.pdf');
  await page.waitForFunction(() => document.querySelectorAll('[data-ui-component=file-list] li').length === 2);
  assert.equal(await page.getByTestId('pdf-finish-range').inputValue(), '2');
  results.push('PDF finishing append retains page range and existing file');

  await page.goto(`${base}/en/tools/document-redactor/`);
  await page.locator('input[type=file]').first().waitFor({ state: 'attached', timeout: 120000 });
  await page.locator('input[type=file]').first().setInputFiles(path.join(output, 'A.pdf'));
  await page.locator('.redactor-preview-canvas').waitFor({ timeout: 60000 });
  await page.getByRole('button', { name: 'Add area', exact: true }).click();
  assert.equal(await page.locator('.redactor-mask').count(), 1);
  await drop('B.pdf');
  await page.waitForFunction(() => document.querySelectorAll('.redactor-document-list li').length === 2);
  assert.equal(await page.locator('.redactor-mask').count(), 1);
  results.push('Document redactor append retains current document mask');
  assert.deepEqual(errors, []);
  await fs.writeFile(path.join(output, 'result.json'), JSON.stringify({ base, results, errors }, null, 2));
  console.log(`PASS ${results.length} file-drop browser flows`);
  console.log(`1..${results.length}\n# tests ${results.length}\n# pass ${results.length}\n# fail 0`);
} catch (error) { await page.screenshot({ path: path.join(output, "failure.png"), fullPage: true }); throw error; } finally { await browser.close(); }

}

async function startPreview(port) {
  return startOwnedPreview({ repositoryRoot: fileURLToPath(new URL("..", import.meta.url)), port: Number(port), timeoutMs: 15_000 });
}
