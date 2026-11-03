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
  await context.route(url => url.pathname.endsWith('/vendor/libreoffice-converter/2.3.1/browser.worker.global.js'), route => route.fulfill({
    contentType: 'text/javascript', headers: { 'Cross-Origin-Embedder-Policy': 'require-corp' },
    body: `let converts=0;self.postMessage({type:'loaded'});self.onmessage=({data:m})=>{
      if(m.type==='init')self.postMessage({type:'ready',id:m.id});
      if(m.type==='convert'){
        converts++;console.log('recovery-probe-convert');
        if(${JSON.stringify(mode)}==='cleanup'||(${JSON.stringify(mode)}.startsWith('batch-')&&(converts===1||${JSON.stringify(mode)}==='batch-cleanup')))self.postMessage({type:'result',id:m.id,data:new Uint8Array(${JSON.stringify(pdfBytes)})});
        else console.log('recovery-probe-deadline');
      }
      if(m.type==='worklazy-ping'){
        if(${JSON.stringify(mode)}.startsWith('batch-')&&converts===1)self.postMessage({type:'ready',id:m.id});
        else console.log('recovery-probe-cleanup');
      }
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
        if (mode === 'cleanup') {
          // Removing the failed file must not clear the session failure state.
          const remove = page.getByRole('button', { name: language === 'ko' ? 'sample.docx 제거' : 'Remove sample.docx', exact: true });
          await remove.click(); await remove.waitFor({ state: 'detached' });
          assert.equal(await page.getByRole('button', { name: create, exact: true }).count(), 0);
          assert.equal(await page.locator('input[type=file]').isDisabled(), true);
          // Dedicated isolation documents navigate via location.assign, so
          // these tabs intentionally create a fresh document (not an SPA reset).
          await page.evaluate(() => { window.__documentPdfRealm = 'failed-document'; });
          await Promise.all([page.waitForNavigation(), page.locator(`.pdf-tool-navigation a[href$='/pdf-to-image/'], .pdf-tool-navigation a[href$='/pdf-to-image']`).click()]);
          await Promise.all([page.waitForNavigation(), page.locator(`.pdf-tool-navigation a[href$='/document-to-pdf/'], .pdf-tool-navigation a[href$='/document-to-pdf']`).click()]);
          await page.getByRole('button', { name: create, exact: true }).waitFor();
          assert.equal(await page.evaluate(() => window.__documentPdfRealm), undefined);
          assert.equal(await page.getByRole('alert').count(), 0);
          assert.equal(await page.locator('input[type=file]').isEnabled(), true);
          // Reproduce cleanup failure in the fresh document before checking
          // its explicit reload action as well.
          await page.locator('input[type=file]').setInputFiles(fixture);
          const waitingAgain = page.waitForEvent('console', { predicate: message => message.text() === 'recovery-probe-cleanup' });
          await page.getByRole('button', { name: create, exact: true }).click();
          await waitingAgain; await page.clock.fastForward(10001);
          await page.getByRole('alert').filter({ hasText: locales[language].timeout }).waitFor();
          assert.equal(await page.getByRole('button', { name: create, exact: true }).count(), 0);
          assert.equal(await page.locator('input[type=file]').isDisabled(), true);
        }
        // The deadline case reloads with the failed file still selected and
        // accepts the app's existing native unsaved-work confirmation.
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

for (const language of ['ko', 'en']) for (const mode of ['deadline', 'cleanup']) {
  test(`${language}: batch ${mode} stops the queue, keeps results and requires a fresh page`, async () => {
    const { context, page, create, external, errors } = await prepare(language, `batch-${mode}`);
    let converts = 0;
    page.on('console', message => { if (message.text() === 'recovery-probe-convert') converts++; });
    try {
      const buffer = await fs.readFile(fixture);
      await page.locator('input[type=file]').setInputFiles(['saved', 'timeout', 'pending'].map(name => ({ name: `${name}.docx`, buffer, mimeType: 'application/octet-stream' })));
      const waiting = page.waitForEvent('console', { predicate: message => message.text() === `recovery-probe-${mode}` });
      await page.getByRole('button', { name: language === 'ko' ? '대기 파일 변환' : 'Convert queued files', exact: true }).click();
      await waiting;
      await page.clock.fastForward(mode === 'deadline' ? 180001 : 10001);
      await page.getByRole('alert').filter({ hasText: locales[language].timeout }).waitFor();
      assert.equal(await page.getByRole('alert').count(), 1);
      assert.equal(converts, 2, 'no remaining file may start after timeout');
      assert.deepEqual(await page.getByTestId('batch-row').evaluateAll(rows => rows.map(row => row.dataset.state)), ['success', 'failed', 'pending']);
      assert.equal(await page.locator('input[type=file]').isDisabled(), true);
      const retry = page.getByRole('button', { name: language === 'ko' ? '다시 대기' : 'Queue again', exact: true });
      assert.equal(await retry.isDisabled(), true);
      const download = page.waitForEvent('download');
      await page.getByTestId('batch-download').click();
      assert.deepEqual([...await fs.readFile(await (await download).path())], pdfBytes);
      await page.screenshot({ path: path.join(output, `${language}-batch-${mode}.png`), fullPage: true });
      for (const name of ['saved', 'timeout', 'pending']) await page.getByRole('button', { name: language === 'ko' ? `${name}.docx 제거` : `Remove ${name}.docx`, exact: true }).click();
      assert.equal(await page.locator('input[type=file]').isDisabled(), true);
      await page.getByRole('button', { name: language === 'ko' ? '단일 파일 화면' : 'Single-file view', exact: true }).click();
      assert.equal(await page.locator('input[type=file]').isDisabled(), true);
      assert.equal(await page.getByRole('button', { name: create, exact: true }).count(), 0);
      await Promise.all([page.waitForNavigation(), page.getByRole('button', { name: locales[language].reload, exact: true }).click()]);
      await page.getByRole('button', { name: create, exact: true }).waitFor();
      assert.equal(await page.locator('input[type=file]').isEnabled(), true);
      assert.deepEqual(external, []); assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });
}
