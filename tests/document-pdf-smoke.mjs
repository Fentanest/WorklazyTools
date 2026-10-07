import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:4187';
const fixtures = path.join(import.meta.dirname, 'fixtures/document-converters');
const output = await fs.mkdtemp('/tmp/worklazy-document-pdf-product-');
let browser, page;
const external = [], errors = [];
before(async () => {
  browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  await context.addInitScript(() => localStorage.setItem('worklazy_privacy_consent_v2', 'denied'));
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(base).origin || ['blob:', 'data:'].includes(url.protocol)) return route.continue();
    external.push(url.href); return route.abort();
  });
  page = await context.newPage(); page.setDefaultTimeout(180000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') console.error('[browser]', message.text()); });
  await page.goto(base + '/en/tools/pdf-converter/document-to-pdf/');
  await page.getByRole('button', { name: 'Create PDF', exact: true }).waitFor();
  assert.equal(await page.locator('.pdf-tool-navigation a').count(), 4);
  await page.waitForFunction(() => crossOriginIsolated && typeof SharedArrayBuffer !== 'undefined');
});
after(async () => { await browser?.close(); console.log('Evidence:', output); });
for (const extension of ['docx','doc','xlsx','xls','pptx','ppt']) {
  test(extension.toUpperCase() + ' creates a real PDF with Korean text', async () => {
    await page.locator('input[type=file]').setInputFiles(path.join(fixtures,'sample.' + extension));
    await page.getByRole('button',{ name: 'Create PDF', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[data-testid=document-pdf-download], [role=alert]'));
    assert.deepEqual(await page.getByRole('alert').allTextContents(), []);
    const link = page.getByTestId('document-pdf-download');
    const [download] = await Promise.all([page.waitForEvent('download'), link.click()]);
    assert.equal(download.suggestedFilename(), 'sample.pdf');
    const file = path.join(output,extension + '.pdf'); await download.saveAs(file);
    const document = await PDFDocument.load(await fs.readFile(file));
    assert.equal(document.getPageCount(), 1);
    const text = execFileSync('pdftotext',[file,'-'],{ encoding: 'utf8' });
    assert.match(text,/한글/);
    console.log(extension, (await fs.stat(file)).size, 'bytes; Korean text verified');
  });
}
for (const extension of ['docx', 'xlsx']) {
  test('rich ' + extension + ' preserves two pages, Korean cells and an image', async () => {
    await page.locator('input[type=file]').setInputFiles(path.join(fixtures, 'rich.' + extension));
    await page.getByRole('button', { name: 'Create PDF', exact: true }).click();
    const link = page.getByTestId('document-pdf-download'); await link.waitFor();
    const [download] = await Promise.all([page.waitForEvent('download'), link.click()]);
    const file = path.join(output, 'rich-' + extension + '.pdf'); await download.saveAs(file);
    assert.equal((await PDFDocument.load(await fs.readFile(file))).getPageCount(), 2);
    const text = execFileSync('pdftotext', [file, '-'], { encoding: 'utf8' });
    assert.match(text, /한글/); assert.match(text, /42/); assert.match(text, /SECOND/);
    const images = execFileSync('pdfimages', ['-list', file], { encoding: 'utf8' });
    assert.match(images, /image/);
    execFileSync('pdftoppm', ['-f', '1', '-singlefile', '-scale-to', '1100', '-png', file, path.join(output, 'rich-' + extension)]);
  });
}
test('unsupported input and oversized documents cannot retain an old download', async () => {
  await page.locator('input[type=file]').setInputFiles({ name: 'unsupported.odt', mimeType:'application/octet-stream', buffer:Buffer.from('unsupported') });
  await page.getByRole('alert').filter({hasText:'Choose an HWP'}).waitFor();
  assert.equal(await page.getByTestId('document-pdf-download').count(),0);
  const file = path.join(output,'oversized.docx'); const handle = await fs.open(file,'w'); await handle.truncate(50 * 1024 * 1024 + 1); await handle.close();
  await page.locator('input[type=file]').setInputFiles(file);
  await page.getByRole('alert').filter({hasText:'50 MiB'}).waitFor();
  assert.equal(await page.getByRole('button',{name:'Create PDF',exact:true}).isDisabled(),true);
});
test('encrypted OOXML is rejected before parsing or downloading another runtime', async () => {
  await page.locator('input[type=file]').setInputFiles(path.join(fixtures, 'encrypted.docx'));
  await page.getByRole('button', { name: 'Create PDF', exact: true }).click();
  await page.getByRole('alert').filter({ hasText: 'Encrypted' }).waitFor();
  assert.equal(await page.getByTestId('document-pdf-download').count(), 0);
});
test('four tabs fit a mobile viewport and conversion sends no external request', async () => {
  await page.setViewportSize({width:390,height:844});
  await page.waitForFunction(() => document.documentElement.scrollWidth <= innerWidth, undefined, { timeout: 5000 }).catch(async error => { console.error(await page.evaluate(() => [...document.querySelectorAll('body *')].map(e => ({ tag:e.tagName, class:e.className, right:e.getBoundingClientRect().right, width:e.getBoundingClientRect().width })).filter(x => x.right > innerWidth))); await page.screenshot({ path:path.join(output,'overflow.png'), fullPage:true }); throw error; });
  await page.screenshot({ path:path.join(output,'document-pdf-mobile.png'), fullPage:true });
  assert.deepEqual(external,[]); assert.deepEqual(errors,[]);
});

test('cancel stops a cold download and permits a subsequent conversion', async () => {
  const context = await browser.newContext();
  await context.addInitScript(() => localStorage.setItem('worklazy_privacy_consent_v2', 'denied'));
  let held;
  await context.route('**/vendor/zetaoffice/**/soffice.wasm', route => { held = route; });
  const cancelPage = await context.newPage(); cancelPage.setDefaultTimeout(180000);
  try {
    await cancelPage.goto(base + '/en/tools/pdf-converter/document-to-pdf/');
    await cancelPage.waitForFunction(() => crossOriginIsolated);
    await cancelPage.locator('input[type=file]').setInputFiles(path.join(fixtures, 'sample.docx'));
    await cancelPage.getByRole('button', { name: 'Create PDF', exact: true }).click();
    await cancelPage.getByRole('button', { name: 'Cancel and reset', exact: true }).click();
    await context.unroute('**/vendor/zetaoffice/**/soffice.wasm');
    if (held) await held.abort().catch(() => {});
    assert.equal(await cancelPage.getByTestId('document-pdf-download').count(), 0);
    await cancelPage.getByRole('button', { name: 'Create PDF', exact: true }).click();
    await cancelPage.getByTestId('document-pdf-download').waitFor();
  } finally { await context.close(); }
});
