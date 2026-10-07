import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:4187';
const fixtures = path.join(import.meta.dirname, 'fixtures/document-converters');
const output = await fs.mkdtemp('/tmp/worklazy-hwp-pdf-product-');
let browser, context, page;
const external = [], errors = [];
before(async () => {
  browser = await chromium.launch({ executablePath:'/usr/bin/google-chrome', args:['--no-sandbox','--disable-dev-shm-usage'] });
  context = await browser.newContext({ viewport:{width:1280,height:900}, reducedMotion:'reduce' });
  await context.addInitScript(() => {
    localStorage.setItem('worklazy_privacy_consent_v2','denied');
    // Capture the exact official print surface, without claiming OS save-dialog automation.
    window.print = () => { window.top.__printCapture = { html:document.documentElement.outerHTML, url:location.href }; };
  });
  await context.route('**/*', route => {
    const u = new URL(route.request().url());
    if (u.origin === new URL(base).origin || ['blob:','data:'].includes(u.protocol)) return route.continue();
    external.push(u.href); return route.abort();
  });
  page = await context.newPage(); page.setDefaultTimeout(90000);
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(base + '/en/tools/pdf-converter/document-to-pdf/');
  await page.waitForFunction(() => crossOriginIsolated);
});
after(async () => { await browser?.close(); console.log('Evidence:', output); });
for (const input of ['sample.hwp', 'sample.hwpx', 'rich.hwp']) {
  test(input + ' prints searchable Korean through the official rhwp PDF command', async () => {
    await page.evaluate(() => { delete window.__printCapture; });
    await page.locator('input[type=file]').setInputFiles(path.join(fixtures, input));
    const button = page.getByRole('button', { name:'Save PDF using print', exact:true });
    await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent.includes('Save PDF using print') && !b.disabled));
    await button.click();
    const frame = page.frameLocator('[data-testid=hwp-pdf-preview] iframe');
    await frame.getByRole('button', { name:'Open print dialog', exact:true }).click();
    await page.waitForFunction(() => window.__printCapture);
    const capture = await page.evaluate(() => window.__printCapture);
    assert.match(capture.url, /rhwp-studio\/0\.8\.7\/print.html$/);
    await fs.writeFile(path.join(output, input+'.html'), capture.html);
    const print = await context.newPage();
    try {
      await print.goto(capture.url); await print.setContent(capture.html, { waitUntil:'load' }); await print.evaluate(() => document.fonts.ready);
      const file = path.join(output, input+'.pdf');
      const bytes = await print.pdf({path:file, preferCSSPageSize:true, printBackground:true});
      const document = await PDFDocument.load(bytes);
      const text = execFileSync('pdftotext',[file,'-'],{encoding:'utf8'});
      assert.match(text,/한글/); assert.match(text,/FIRST PAGE/);
      if (input === 'rich.hwp') {
        assert.equal(document.getPageCount(),2); assert.match(text.split('\f')[0],/FIRST PAGE/); assert.match(text.split('\f')[0],/42/); assert.match(text.split('\f')[1],/SECOND PAGE/);
        assert.match(capture.html, /data:image\/png/);
      } else assert.equal(document.getPageCount(),1);
      execFileSync('pdftoppm',['-f','1','-singlefile','-scale-to','1100','-png',file,path.join(output,input)]);
      console.log(input, { pages:document.getPageCount(), bytes:bytes.length, text });
    } finally { await print.close(); }
    assert.equal(await page.getByTestId('document-pdf-download').count(),0);
    await page.getByRole('button',{name:'Close document',exact:true}).click();
    assert.equal(await page.locator('[data-testid=hwp-pdf-preview] iframe').count(),0);
  });
}
test('closing a loading HWP destroys its preview and a new file can open', async () => {
  await page.locator('input[type=file]').setInputFiles(path.join(fixtures,'sample.hwpx'));
  await page.getByRole('button',{name:'Close document',exact:true}).click();
  assert.equal(await page.locator('[data-testid=hwp-pdf-preview] iframe').count(),0);
  await page.locator('input[type=file]').setInputFiles(path.join(fixtures,'sample.hwpx'));
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent.includes('Save PDF using print') && !b.disabled));
  await page.getByRole('button',{name:'Close document',exact:true}).click();
});
test('mobile print guidance fits and cancellation produces no saved-result claim', async () => {
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(() => { delete window.__printCapture; });
  await page.locator('input[type=file]').setInputFiles(path.join(fixtures,'sample.hwpx'));
  await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.textContent.includes('Save PDF using print') && !b.disabled));
  await page.getByRole('button',{name:'Save PDF using print',exact:true}).click();
  const frame = page.frameLocator('[data-testid=hwp-pdf-preview] iframe');
  const cancel = frame.getByRole('button',{name:'Cancel',exact:true}); await cancel.waitFor();
  const fits = await cancel.evaluate(element => { const r=element.getBoundingClientRect(); return r.left>=0 && r.right<=innerWidth && r.top>=0 && r.bottom<=innerHeight; });
  assert.equal(fits,true);
  await page.screenshot({path:path.join(output,'mobile-print-guidance.png'),fullPage:true});
  await cancel.click();
  assert.equal(await page.evaluate(() => Boolean(window.__printCapture)),false);
  assert.equal(await page.getByTestId('document-pdf-download').count(),0);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth),true);
  await page.getByRole('button',{name:'Close document',exact:true}).click();
  await page.setViewportSize({width:1280,height:900});
});
test('corrupt HWP shows an error and cannot print an old document', async () => {
  await page.locator('input[type=file]').setInputFiles({name:'corrupt.hwp', mimeType:'application/octet-stream', buffer:Buffer.from('invalid')});
  await page.getByRole('alert').filter({hasText:'Could not open'}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Save PDF using print',exact:true}).isDisabled(),true);
  assert.equal(await page.locator('[data-testid=hwp-pdf-preview] iframe').count(),0);
  assert.deepEqual(external,[]); assert.deepEqual(errors,[]);
});
