// UI regression: real Office client deadlines over a controlled Worker protocol.
// This does not claim that the native Office engine converts the input.
import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:4187';
const output = process.env.EVIDENCE_DIR || '/tmp/worklazy-document-pdf-recovery';
const fixture = path.join(import.meta.dirname, 'fixtures/document-converters/sample.docx');
const locales = Object.fromEntries(await Promise.all(['ko', 'en'].map(async language => [language,
  JSON.parse(await fs.readFile(new URL(`../src/locales/${language}/features.json`, import.meta.url), 'utf8')).documentPdf])));
const pdf = await PDFDocument.create(); pdf.addPage(); const pdfBytes = [...await pdf.save()];
let browser;
before(async () => {
  await fs.mkdir(output, { recursive: true });
  browser = await chromium.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
});
after(async () => { await browser?.close(); });
async function prepare(language, mode) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  const external = [], errors = [];
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(base).origin || ['blob:', 'data:'].includes(url.protocol)) return route.continue();
    external.push(url.href); return route.abort();
  });
  await context.route('**/vendor/libreoffice-converter/2.3.1/*.gz', route => route.fulfill({ body: Buffer.from([0, 0]) }));
  await context.route('**/vendor/libreoffice-converter/2.3.1/browser.worker.global.js', route => route.fulfill({
    contentType: 'text/javascript', headers: { 'Cross-Origin-Embedder-Policy': 'require-corp' },
    body: `self.postMessage({type:'loaded'});self.onmessage=({data:m})=>{
      if(m.type==='init')self.postMessage({type:'ready',id:m.id});
      if(m.type==='convert'){
        if(${JSON.stringify(mode)}==='cleanup')self.postMessage({type:'result',id:m.id,data:new Uint8Array(${JSON.stringify(pdfBytes)})});
        else console.log('recovery-probe-deadline');
      }
      if(m.type==='worklazy-ping')console.log('recovery-probe-cleanup');
    };`,
  }));
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  page.on('pageerror', error => errors.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  await page.clock.install();
  await page.goto(`${base}/${language}/tools/pdf-converter/document-to-pdf/`);
  const create = language === 'ko' ? 'PDF 만들기' : 'Create PDF';
  await page.getByRole('button', { name: create, exact: true }).waitFor();
  await page.waitForFunction(() => crossOriginIsolated);
  return { context, page, create, external, errors };
}
for (const language of ['ko', 'en']) {
  for (const mode of ['deadline', 'cleanup']) {
    test(`${language}: ${mode} failure requires a reload and cannot restart conversion`, async () => {
      const { context, page, create, external, errors } = await prepare(language, mode);
      const workers = []; page.on('worker', worker => workers.push(worker));
      try {
        await page.locator('input[type=file]').setInputFiles(fixture);
        const waiting = page.waitForEvent('console', { predicate: message => message.text() === `recovery-probe-${mode}` });
        await page.getByRole('button', { name: create, exact: true }).click();
        await waiting;
        await page.clock.fastForward(mode === 'deadline' ? 180001 : 10001);
        await page.getByRole('alert').filter({ hasText: locales[language].timeout }).waitFor();
        assert.equal(await page.getByRole('button', { name: create, exact: true }).count(), 0);
        assert.equal(await page.locator('input[type=file]').isDisabled(), true);
        assert.equal(await page.getByTestId('document-pdf-download').count(), 0);
        assert.equal(workers.length, 1);
        await page.screenshot({ path: path.join(output, `${language}-${mode}.png`), fullPage: true });
        // Removing the failed file must not clear the session failure state.
        const remove = page.getByRole('button', { name: language === 'ko' ? 'sample.docx 제거' : 'Remove sample.docx', exact: true });
        await remove.click(); await remove.waitFor({ state: 'detached' });
        assert.equal(await page.getByRole('button', { name: create, exact: true }).count(), 0);
        assert.equal(await page.locator('input[type=file]').isDisabled(), true);
        // SPA navigation must not reset the failed native session's UI guard.
        await page.locator(`.pdf-tool-navigation a[href$='/pdf-to-image/'], .pdf-tool-navigation a[href$='/pdf-to-image']`).click();
        await page.locator(`.pdf-tool-navigation a[href$='/document-to-pdf/'], .pdf-tool-navigation a[href$='/document-to-pdf']`).click();
        await page.getByRole('alert').filter({ hasText: locales[language].timeout }).waitFor();
        assert.equal(await page.getByRole('button', { name: create, exact: true }).count(), 0);
        assert.equal(await page.locator('input[type=file]').isDisabled(), true);
        const navigation = page.waitForNavigation();
        await page.getByRole('button', { name: locales[language].reload, exact: true }).click();
        await navigation;
        const button = page.getByRole('button', { name: create, exact: true }); await button.waitFor();
        assert.equal(await button.isDisabled(), true);
        assert.equal(await page.getByRole('button', { name: locales[language].reload, exact: true }).count(), 0);
        assert.equal(await page.getByRole('alert').count(), 0);
        await page.locator('input[type=file]').setInputFiles(fixture);
        assert.equal(await button.isEnabled(), true);
        assert.deepEqual(external, []); assert.deepEqual(errors, []);
      } finally { await context.close(); }
    });
  }
  test(`${language}: encrypted input remains a recoverable validation error`, async () => {
    const { context, page, create, external, errors } = await prepare(language, 'deadline');
    try {
      await page.locator('input[type=file]').setInputFiles(path.join(import.meta.dirname, 'fixtures/document-converters/encrypted.docx'));
      await page.getByRole('button', { name: create, exact: true }).click();
      await page.getByRole('alert').waitFor();
      assert.equal(await page.getByRole('button', { name: locales[language].reload, exact: true }).count(), 0);
      assert.equal(await page.locator('input[type=file]').isEnabled(), true);
      assert.equal(await page.getByRole('button', { name: create, exact: true }).isEnabled(), true);
      assert.deepEqual(external, []); assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });
}
