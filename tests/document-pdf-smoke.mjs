import assert from 'node:assert/strict';
import { before, beforeEach, after, test } from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import JSZip from 'jszip';
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
  page = await context.newPage();
});
async function resetPage() {
  // File selection appends in this UI; a fresh page keeps each single-file
  // case independent and also resets a session that requires a reload.
  const context = page.context();
  await page.close();
  page = await context.newPage(); page.setDefaultTimeout(180000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') console.error('[browser]', message.text()); });
  await page.goto(base + '/en/tools/pdf-converter/document-to-pdf/');
  await page.getByRole('button', { name: 'Create PDF', exact: true }).waitFor();
  assert.equal(await page.locator('.pdf-tool-navigation a').count(), 4);
  await page.waitForFunction(() => crossOriginIsolated && typeof SharedArrayBuffer !== 'undefined');
}
beforeEach(resetPage);
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
    const started = Date.now();
    const load1AtStart = Number((await fs.readFile('/proc/loadavg', 'utf8')).split(' ')[0]);
    try {
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
    } catch (error) {
      // Paired diagnostic only: never turn the original rich-document failure
      // into a pass, and do not add/remove any of the twelve test cases.
      if (extension === 'docx') await recordImageRemovedControl({ load1AtStart, ms: Date.now() - started, error: error.message });
      throw error;
    }
  });
}
async function recordImageRemovedControl(rich) {
  const started = Date.now();
  const record = { rich, browserVersion: browser.version(), load1AtStart: Number((await fs.readFile('/proc/loadavg', 'utf8')).split(' ')[0]) };
  try {
    const zip = await JSZip.loadAsync(await fs.readFile(path.join(fixtures, 'rich.docx')));
    const xml = await zip.file('word/document.xml').async('string');
    const withoutImage = xml.replace(/<w:p><w:r><w:drawing>[\s\S]*?<\/w:drawing><\/w:r><\/w:p>/g, '');
    if (xml === withoutImage) throw new Error('The synthetic image was not removed');
    zip.file('word/document.xml', withoutImage);
    await resetPage();
    await page.locator('input[type=file]').setInputFiles({ name: 'no-image.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }) });
    await page.getByRole('button', { name: 'Create PDF', exact: true }).click();
    await page.waitForFunction(() => document.querySelector('[data-testid=document-pdf-download], [role=alert]'));
    record.alerts = await page.getByRole('alert').allTextContents();
    if (record.alerts.length) record.status = 'error-alert';
    else {
      const [download] = await Promise.all([page.waitForEvent('download'), page.getByTestId('document-pdf-download').click()]);
      const file = path.join(output, 'image-removed-control.pdf'); await download.saveAs(file);
      record.pages = (await PDFDocument.load(await fs.readFile(file))).getPageCount();
      const text = execFileSync('pdftotext', [file, '-'], { encoding: 'utf8' });
      record.korean = /한글/.test(text); record.number42 = /42/.test(text); record.second = /SECOND/.test(text);
      record.status = record.pages === 2 && record.korean && record.number42 && record.second ? 'success' : 'quality-mismatch';
    }
  } catch (error) { record.status = 'failed'; record.error = error.message; }
  record.ms = Date.now() - started;
  await fs.writeFile(path.join(output, 'image-removed-control.json'), JSON.stringify(record, null, 2));
  console.log('IMAGE_REMOVED_CONTROL', JSON.stringify(record));
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
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(base).origin || ['blob:', 'data:'].includes(url.protocol)) return route.continue();
    return route.abort();
  });
  const wasmRoute = '**/vendor/libreoffice-converter/2.3.1/soffice.wasm.gz';
  let resolveHeld;
  const heldRequest = new Promise(resolve => { resolveHeld = resolve; });
  await context.route(wasmRoute, route => { held = route; resolveHeld(); });
  const cancelPage = await context.newPage(); cancelPage.setDefaultTimeout(180000);
  try {
    await cancelPage.goto(base + '/en/tools/pdf-converter/document-to-pdf/');
    await cancelPage.waitForFunction(() => crossOriginIsolated);
    await cancelPage.locator('input[type=file]').setInputFiles(path.join(fixtures, 'sample.docx'));
    await cancelPage.getByRole('button', { name: 'Create PDF', exact: true }).click();
    // Bound a broken interception instead of silently testing an ordinary cancel.
    await Promise.race([heldRequest, cancelPage.waitForTimeout(30000).then(() => {
      throw new Error('The Office WASM download was not intercepted');
    })]);
    await cancelPage.getByRole('button', { name: 'Cancel and reset', exact: true }).click();
    await context.unroute(wasmRoute);
    if (held) await held.abort().catch(() => {});
    assert.equal(await cancelPage.getByTestId('document-pdf-download').count(), 0);
    await cancelPage.getByRole('button', { name: 'Create PDF', exact: true }).click();
    await cancelPage.getByTestId('document-pdf-download').waitFor();
  } finally { await context.close(); }
});
