import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { PNG } from 'pngjs';
import { stateWith } from './fixtures/product-banner/state.ts';
import { saveProjectJson } from '../src/features/product-banner/projectJson.ts';
import { uiMessages } from '../src/features/product-banner/uiMessages.ts';
import { startRecoveryServer } from './recovery-server.mjs';

const target = process.env.CONFIRM_TARGET || 'banner';
assert.ok(['banner', 'legacy'].includes(target));
const output = process.env.CONFIRM_OUTPUT || 'artifacts/confirm/browser';
await fs.mkdir(output, { recursive: true });
const server = process.env.TEST_BASE_URL ? undefined : await startRecoveryServer({ root: 'dist', port: 0 });
const base = process.env.TEST_BASE_URL || server.url;
const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
after(async () => { await browser.close(); await server?.close(); });
const pixels = new PNG({ width: 64, height: 48 }); pixels.data.fill(255);
for (let i = 0; i < pixels.data.length; i += 4) pixels.data[i] = 190;
const png = PNG.sync.write(pixels);
async function open(language, width) {
  const context = await browser.newContext({ viewport: { width, height: 950 } });
  await context.addInitScript(() => { window.__WORKLAZY_MOCK_PROVIDERS__ = true; });
  await context.route('**/*', route => route.request().url().startsWith(base + '/') || /^(blob:|data:)/.test(route.request().url()) ? route.continue() : route.abort());
  const p = await context.newPage(), errors = [];
  p.setDefaultTimeout(20_000);
  p.on('pageerror', error => errors.push(error.message));
  p.on('dialog', dialog => { errors.push('Unexpected native confirmation'); void dialog.dismiss(); });
  await p.goto(`${base}/${language}/tools/${target === 'banner' ? 'product-banner' : 'image-studio'}/`);
  return { p, context, errors };
}
async function decision(p) {
  const dialog = p.locator('dialog[open][data-testid=confirmation-dialog]'); await dialog.waitFor({ state: 'visible' });
  assert.equal(await p.locator('dialog[open]').getByTestId('confirmation-cancel').evaluate(el => el === document.activeElement), true);
  assert.ok(await dialog.getAttribute('aria-labelledby'));
  assert.ok(await dialog.getAttribute('aria-describedby'));
  assert.equal(await p.locator('dialog[open]').count(), 1);
  await p.keyboard.press('Tab'); assert.equal(await p.locator('dialog[open]').getByTestId('confirmation-accept').evaluate(el => el === document.activeElement), true);
  await p.keyboard.press('Shift+Tab'); assert.equal(await p.locator('dialog[open]').getByTestId('confirmation-cancel').evaluate(el => el === document.activeElement), true);
  return dialog;
}
// Fabric schedules rendering and responsive viewport sizing on animation frames.
async function canvasPixels(canvas) {
  const pixels = await canvas.evaluate(async element => {
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    return element.toDataURL();
  });
  return createHash('sha256').update(pixels).digest('hex');
}
const projectFile = name => {
  const project = stateWith(1).project; project.products[0].name = name;
  return { name: `${name}.json`, mimeType: 'application/json', buffer: Buffer.from(saveProjectJson(project)) };
};
if (target === 'banner') {
  for (const [language, width] of [['ko', 390], ['en', 1440]]) test(`banner ${language}: JSON and product replacement cancel/accept, focus, stale read`, async () => {
    const { p, context, errors } = await open(language, width); const text = uiMessages[language];
    try {
      const input = p.locator('input[accept=".json"]'), names = p.getByLabel(text.fields.name, { exact: true });
      await input.setInputFiles(projectFile('Original')); await names.waitFor();
      const exported = p.getByLabel(text.export, { exact: true }); const before = await exported.inputValue();
      const trigger = p.getByRole('button', { name: text.loadJson, exact: true }); await trigger.focus();
      await input.setInputFiles(projectFile('Replacement')); const dialog = await decision(p);
      assert.equal(await dialog.locator('p').innerText(), text.confirm);
      await dialog.screenshot({ path: path.join(output, `banner-${language}-${width}.png`) });
      await p.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
      assert.equal(await trigger.evaluate(el => el === document.activeElement), true);
      assert.equal(await names.inputValue(), 'Original'); assert.equal(await exported.inputValue(), before);
      await input.setInputFiles(projectFile('Replacement')); await decision(p); await p.locator('dialog[open]').getByTestId('confirmation-cancel').click();
      assert.equal(await exported.inputValue(), before);
      await input.setInputFiles(projectFile('Replacement')); await decision(p); await p.locator('dialog[open]').getByTestId('confirmation-accept').click();
      await p.waitForFunction(() => [...document.querySelectorAll('input')].some(el => el.value === 'Replacement'));
      // A real File.text suspended after approval cannot overwrite newer edits.
      await p.evaluate(() => {
        const original = File.prototype.text;
        File.prototype.text = function () {
          if (this.name !== 'Stale.json') return original.call(this);
          const file = this; return new Promise(resolve => { window.__releaseRead = async () => resolve(await original.call(file)); });
        };
      });
      await input.setInputFiles(projectFile('Stale')); await decision(p); await p.locator('dialog[open]').getByTestId('confirmation-accept').click();
      await p.waitForFunction(() => !!window.__releaseRead); await names.fill('Newer edit');
      await p.evaluate(async () => { await window.__releaseRead(); await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))); });
      assert.equal(await names.inputValue(), 'Newer edit');
      // The async importer must retain the pending files on rejection and clear them on acceptance.
      await p.getByRole('combobox', { name: text.import, exact: true }).selectOption('replace');
      await p.locator('input[accept=".xls,.xlsx,.csv"]').setInputFiles({ name: 'replacement.csv', mimeType: 'text/csv', buffer: Buffer.from('Image Url,Promotion Url,Product Desc\nhttps://example.com/i.png,https://example.com/p,CSV replacement') });
      const extract = p.getByRole('button', { name: text.confirmImport, exact: true }); await extract.waitFor();
      await extract.click(); await decision(p); await p.locator('dialog[open]').getByTestId('confirmation-cancel').click();
      await extract.waitFor({ state: 'visible' }); assert.equal(await names.inputValue(), 'Newer edit');
      assert.equal(await p.getByText('1. replacement.csv', { exact: true }).count(), 1);
      await extract.click(); await decision(p); await p.locator('dialog[open]').getByTestId('confirmation-accept').click();
      await p.waitForFunction(() => [...document.querySelectorAll('input')].some(el => el.value === 'CSV replacement'));
      await p.getByText('1. replacement.csv', { exact: true }).waitFor({ state: 'hidden' });
      // The existing route guard still shares the same dialog component and safe default.
      await p.locator(`a[href="/${language}/tools"]:visible`).first().click();
      await p.getByTestId('unsaved-work-dialog').waitFor({ state: 'visible' });
      assert.equal(await p.getByTestId('unsaved-stay').evaluate(el => el === document.activeElement), true);
      await p.keyboard.press('Escape'); assert.equal(await names.inputValue(), 'CSV replacement');
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });
} else {
  for (const [language, width] of [['ko', 390], ['en', 1440]]) test(`legacy editor ${language}: blank canvas and clipboard cancel/accept preserve pixels`, async () => {
    const { p, context, errors } = await open(language, width);
    try {
      const owner = p.locator('[data-image-owner=editor]');
      const image = { name: 'original.png', mimeType: 'image/png', buffer: png };
      await owner.locator('input[type=file]').first().setInputFiles(image);
      const canvas = owner.locator('canvas.lower-canvas'); await canvas.waitFor();
      await owner.getByText(/original\.png/).waitFor();
      const blank = owner.getByRole('button', { name: language === 'ko' ? '빈 캔버스로 새로 시작' : 'Start with a blank canvas', exact: true });
      const before = await canvasPixels(canvas);
      await blank.click(); const dialog = await decision(p);
      await dialog.screenshot({ path: path.join(output, `legacy-${language}-${width}.png`) });
      await p.keyboard.press('Escape'); await dialog.waitFor({ state: 'hidden' });
      assert.equal(await blank.evaluate(el => el === document.activeElement), true);
      assert.equal(await canvasPixels(canvas), before);
      await blank.click(); await decision(p); await p.locator('dialog[open]').getByTestId('confirmation-cancel').click();
      assert.equal(await canvasPixels(canvas), before);
      const paste = () => p.evaluate(bytes => {
        const transfer = new DataTransfer(); transfer.items.add(new File([new Uint8Array(bytes)], 'pasted.png', { type: 'image/png' }));
        document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: transfer, bubbles: true, cancelable: true }));
      }, [...png]);
      await blank.focus(); await paste(); await decision(p); await p.locator('dialog[open]').getByTestId('confirmation-cancel').click();
      assert.equal(await canvasPixels(canvas), before);
      await paste(); await decision(p); await p.locator('dialog[open]').getByTestId('confirmation-accept').click();
      await owner.getByText(/original\.png/).waitFor({ state: 'hidden' });
      assert.equal(await canvasPixels(canvas), before);
      await blank.click(); await decision(p); await p.locator('dialog[open]').getByTestId('confirmation-accept').click();
      await p.waitForFunction(() => ![...document.querySelectorAll('[data-image-owner=editor] span')].some(el => /clipboard-|클립보드-/.test(el.textContent)));
      assert.notEqual(await canvasPixels(canvas), before);
      assert.deepEqual(errors, []);
    } finally { await context.close(); }
  });
}
