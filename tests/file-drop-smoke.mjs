import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { PNG } from 'pngjs';

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5183';
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

  await page.goto(`${base}/en/tools/document-redactor`);
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
} finally { await browser.close(); }
