import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import XLSX from 'xlsx';
import JSZip from 'jszip';
import { PNG } from 'pngjs';
import { startRecoveryServer } from './recovery-server.mjs';

const output = path.resolve(process.env.GUIDE_SHOTS || 'scratch/guidelink-p3/browser');
const records = [];
let server, browser, image, workbook, word;
const cases = [
  ['document-redactor', 'ready'], ['document-redactor', 'late-failure'],
  ['excel-cleaner', 'loading'], ['image-privacy', 'result'],
  ['document-compare', 'result'], ['excel-merger', 'protected-output'],
  ['timezone-calculator', 'empty'], ['excel-compare', 'result'],
  ['document-compare/results/1', 'expired'], ['image-studio', 'initial'],
  ['payroll-calculator', 'initial'], ['text-tools', 'initial'],
];
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
before(async () => {
  await fs.mkdir(output, { recursive: true });
  server = await startRecoveryServer({ root: process.env.GUIDE_DIST || 'dist', port: 0 });
  browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const png = new PNG({width:32,height:24}); png.data.fill(255); image = PNG.sync.write(png);
  const book = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(book, XLSX.utils.aoa_to_sheet([['Name','Value'],['Alpha',1],['Beta',2]]), 'Sample');
  workbook = XLSX.write(book, {type:'buffer',bookType:'xlsx'});
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>');
  zip.file('_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>');
  zip.file('word/document.xml', '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Synthetic guide-link sample</w:t></w:r></w:p><w:sectPr/></w:body></w:document>');
  word = await zip.generateAsync({type:'nodebuffer'});
});
after(async () => {
  await browser?.close(); await server?.close();
  await fs.writeFile(path.join(output,'results.json'), JSON.stringify(records,null,2));
});

async function setup(page, tool, state, lang, gate, requested) {
  const copy = JSON.parse(await fs.readFile(`src/locales/${lang}/features.json`,'utf8'));
  const file = (name,mimeType,buffer) => ({name,mimeType,buffer});
  if (state === 'late-failure') {
    await page.route('**/*', async route => {
      if (new URL(route.request().url()).pathname.includes('pdf.worker')) { requested.resolve(); await gate.promise; return route.abort(); }
      return route.fallback();
    });
  } else if (tool === 'excel-cleaner') {
    await page.route('**/*', async route => {
      if (new URL(route.request().url()).pathname.includes('excelCleaner.worker')) { requested.resolve(); await gate.promise; }
      return route.fallback();
    });
  }
  await page.goto(`${server.url}/${lang}/tools/${tool}/`, {waitUntil:'domcontentloaded'});
  await page.waitForFunction(() => document.querySelector('#root [data-tool-page], #root .page') && !document.querySelector('.tool-route-loading'));
  if (tool === 'document-redactor' && state === 'ready') await page.locator('.redactor-file-picker input[type=file]').waitFor({timeout:45000});
  if (state === 'late-failure') await Promise.race([requested.promise,new Promise((_,reject)=>setTimeout(()=>reject(Error('Expected pending redactor worker')),30000))]);
  if (tool === 'excel-cleaner') {
    await page.locator('input[type=file]').first().setInputFiles(file('guide.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',workbook));
    await Promise.race([requested.promise,new Promise((_,reject)=>setTimeout(()=>reject(Error('Expected pending inspection worker')),30000))]);
    await page.getByTestId('excel-cleaner-file').locator('a[href="#tool-guide-title"]').waitFor();
  }
  if (tool === 'image-privacy') {
    await page.locator('input[type=file]').first().setInputFiles(file('guide.png','image/png',image));
    await page.getByRole('button',{name:copy.imagePrivacy.execute,exact:true}).click();
    await page.getByTestId('image-privacy-result').waitFor();
  }
  if (tool === 'document-compare') {
    const inputs = page.getByTestId('document-file-grid').locator('input[type=file]');
    await inputs.nth(0).setInputFiles(file('before.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document',word));
    await inputs.nth(1).setInputFiles(file('after.docx','application/vnd.openxmlformats-officedocument.wordprocessingml.document',word));
    await page.getByTestId('document-action-bar').locator('[data-ui-component=primary-button]').click();
    await page.getByTestId('document-results').waitFor();
  }
  if (tool === 'excel-merger') {
    await page.locator('input[type=file]').first().setInputFiles(file('guide.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',workbook));
    await page.getByRole('switch',{name:copy.excel.protect.label,exact:true}).click();
    await page.getByTestId('excel-output-password-form').waitFor();
  }
  if (tool === 'timezone-calculator') await page.locator('input[type=search], input[placeholder]').filter({visible:true}).last().fill('zzznomatch-guide');
  if (tool === 'excel-compare') {
    const input = page.getByTestId('excel-compare-pair').locator('input[type=file]').first();
    await input.setInputFiles([file('before.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',workbook),file('after.xlsx','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',workbook)]);
    await page.getByTestId('excel-compare-actions').locator('[data-ui-component=primary-button]').click();
    await page.getByTestId('excel-compare-results').waitFor();
  }
  if (state === 'expired') await page.getByTestId('document-expired-result').waitFor();
}

async function position(page) {
  return page.evaluate(() => {
    const targets = document.querySelectorAll('#tool-guide-title');
    const rect = targets[0]?.getBoundingClientRect();
    const headers = [...document.querySelectorAll('.wl-topbar,.mobile-header,.app-topbar')].filter(e=>e.getClientRects().length);
    return { count:targets.length, top:rect?.top, bottom:rect?.bottom,
      headerBottom:Math.max(0,...headers.map(e=>e.getBoundingClientRect().bottom)), viewport:innerHeight,
      hash:location.hash, scrollY, docY:rect ? rect.top+scrollY : null };
  });
}
async function check(lang, tool, state, mobile = false) {
  const context = await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1440,height:1000},serviceWorkers:'block'});
  await context.route('**/*',route=>{const u=new URL(route.request().url());return !/^https?:$/u.test(u.protocol)||u.origin===server.url?route.continue():route.abort();});
  const page = await context.newPage(); page.setDefaultTimeout(30000);
  const gate=deferred(),requested=deferred();
  const record={lang,tool,state,mobile};
  try {
    await setup(page,tool,state,lang,gate,requested);
    const link=page.locator('a[href="#tool-guide-title"]').first();await link.waitFor();
    record.before=await position(page);assert.equal(record.before.count,1,'guide link needs one real target');
    await link.click();await page.waitForTimeout(600);record.afterClick=await position(page);
    gate.resolve();
    if (state === 'late-failure') await page.locator('[data-tool-page=document-redactor] > [role=alert]').waitFor();
    if (tool === 'excel-cleaner') await page.waitForFunction(()=>!document.querySelector('[data-inspecting=true]'));
    await page.waitForTimeout(1900);record.settled=await position(page);
    assert.equal(record.settled.hash,'#tool-guide-title');
    assert.equal(record.settled.count,1);
    assert.ok(record.settled.top>=record.settled.headerBottom,`heading hidden above ${record.settled.headerBottom}: ${record.settled.top}`);
    assert.ok(record.settled.bottom<=record.settled.viewport,'heading below viewport');
    if (tool==='document-redactor' || state==='expired') await page.screenshot({path:path.join(output,`${lang}-${tool.replaceAll('/','-')}-${state}-${mobile?'mobile':'desktop'}.png`)});
    record.passed=true;
  } catch(error) {record.passed=false;record.error=error.message;throw error;}
  finally {gate.resolve();records.push(record);await context.close();}
}
for(const lang of ['ko','en'])for(const [tool,state] of cases)test(`${lang} ${tool} ${state}: guide heading clears fixed header`,{timeout:90000},()=>check(lang,tool,state));
for(const lang of ['ko','en'])test(`${lang} mobile redactor: responsive header offset`,{timeout:90000},()=>check(lang,'document-redactor','ready',true));
