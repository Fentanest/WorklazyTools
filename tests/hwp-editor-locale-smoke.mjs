// Real pinned Studio UI + HWP edit/export/reopen; no vendor/API stubs.
import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import initRhwp, { HwpDocument } from '@rhwp/core';

const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:5430';
const output = process.env.HWPEN_OUTPUT || '/tmp/sol-hwpen/browser';
const input = Buffer.from((await fs.readFile(new URL('./fixtures/rhwp-roundtrip-empty.hwp.b64', import.meta.url), 'utf8')).trim(), 'base64');
let browser;
const records = [];
before(async () => {
  await fs.mkdir(output, { recursive: true });
  globalThis.measureTextWidth = (_font, text) => Array.from(text).length * 8;
  await initRhwp({ module_or_path: await fs.readFile(new URL('../node_modules/@rhwp/core/rhwp_bg.wasm', import.meta.url)) });
  browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox', '--disable-dev-shm-usage'] });
});
after(async () => { await browser?.close(); await fs.writeFile(path.join(output, 'results.json'), JSON.stringify(records, null, 2)); });
function inspect(bytes) {
  const document = new HwpDocument(new Uint8Array(bytes));
  try {
    const text = [];
    for (let s = 0; s < document.getSectionCount(); s++) for (let p = 0; p < document.getParagraphCount(s); p++)
      text.push(document.getTextRange(s, p, 0, document.getParagraphLength(s, p)));
    return { pages: document.pageCount(), sections: document.getSectionCount(), text: text.join('\n') };
  } finally { document.free(); }
}
for (const language of ['ko', 'en']) test(`${language}: pinned Studio locale, real HWP edit/save and reopen`, async () => {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, serviceWorkers: 'block' });
  const external = [], errors = [];
  await context.addInitScript(({ language, origin }) => {
    if (location.origin !== origin) return;
    window.__WORKLAZY_MOCK_PROVIDERS__ = true;
    localStorage.setItem('rhwp-locale', language === 'en' ? 'ko' : 'en');
  }, { language, origin: new URL(base).origin });
  await context.route('**/*', route => {
    const url = new URL(route.request().url());
    if (url.origin === new URL(base).origin || ['blob:', 'data:'].includes(url.protocol)) return route.continue();
    external.push(url.href); return route.abort();
  });
  const page = await context.newPage(); page.setDefaultTimeout(120000);
  page.on('pageerror', error => errors.push(error.message)); page.on('dialog', dialog => dialog.accept());
  try {
    await page.goto(`${base}/${language}/tools/hwp-editor/`);
    const iframe = page.locator('[data-testid=hwp-editor-shell] iframe'); await iframe.waitFor();
    const url = new URL(await iframe.getAttribute('src'));
    assert.equal(url.origin, new URL(base).origin); assert.equal(url.searchParams.get('lang'), language);
    assert.equal(url.searchParams.get('renderer'), 'canvas2d');
    const studio = page.frameLocator('[data-testid=hwp-editor-shell] iframe');
    await page.locator('[data-tool-page=hwp-editor] input[type=file]').first().setInputFiles({ name: `locale-${language}.hwp`, mimeType: 'application/x-hwp', buffer: input });
    await page.getByTestId('hwp-focus-toolbar').waitFor();
    await studio.locator('.document-page-canvas').first().waitFor();
    const menus = (await studio.locator('#menu-bar .menu-title').allTextContents()).map(text => text.trim());
    assert.deepEqual(menus, language === 'en' ? ['File','Edit','View','Insert','Format','Page','Table','Tools'] : ['파일','편집','보기','입력','서식','쪽','표','도구']);
    assert.equal(await studio.locator('html').getAttribute('lang'), language);
    assert.equal(await studio.locator('#font-lang option[value=all]').textContent(), language === 'en' ? 'Font Set' : '대표');
    assert.equal(await studio.locator('#sb-mode').textContent(), language === 'en' ? 'Insert' : '삽입');
    assert.equal(await studio.locator('#sb-page').textContent(), language === 'en' ? 'Page 1 / 1' : '1 / 1 쪽');
    assert.equal(await studio.locator('#sb-section').textContent(), language === 'en' ? 'Section: 1 / 1' : '구역: 1 / 1');
    assert.match(await studio.locator('#btn-bold').getAttribute('title'), language === 'en' ? /^Bold/ : /[가-힣]/u);
    const sentinel = `HWPEN_${language.toUpperCase()}_EDIT`;
    await studio.locator('.document-page-canvas').first().click({ position: { x: 130, y: 130 } });
    await page.keyboard.type(sentinel, { delay: 10 });
    const downloaded = page.waitForEvent('download'); await page.getByTestId('hwp-save').click();
    const file = await downloaded, saved = path.join(output, `${language}-edited.hwp`); await file.saveAs(saved);
    const bytes = await fs.readFile(saved), result = inspect(bytes), original = inspect(input);
    assert.ok(result.text.includes(sentinel), 'download must contain the actual typed text');
    assert.equal(result.pages, original.pages); assert.equal(result.sections, original.sections);
    await page.waitForFunction(() => !document.querySelector('[data-testid=hwp-save]').disabled);
    await page.getByTestId('hwp-focus-open').setInputFiles({ name: `${language}-reopened.hwp`, mimeType: 'application/x-hwp', buffer: bytes });
    await page.waitForFunction(name => document.querySelector('[data-testid=hwp-focus-document] strong')?.textContent === name, `${language}-reopened.hwp`);
    await studio.locator('.document-page-canvas').first().waitFor();
    await page.screenshot({ path: path.join(output, `${language}-reopened.png`), fullPage: true });
    assert.deepEqual(errors, []);
    records.push({ language, browser: browser.version(), iframe: url.href, menus, output: saved, sha256: createHash('sha256').update(bytes).digest('hex'), ...result, externalBlocked: external.length, pageErrors: errors });
  } finally { await context.close(); }
});
