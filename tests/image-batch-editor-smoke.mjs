import assert from 'node:assert/strict';
import { test, after } from 'node:test';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import JSZip from 'jszip';
import { PNG } from 'pngjs';
import { startRecoveryServer } from './recovery-server.mjs';
const server = process.env.TEST_BASE_URL ? undefined : await startRecoveryServer({ root: 'dist', port: 0 });
const base = process.env.TEST_BASE_URL || server.url;
const output = process.env.W6_OUTPUT || 'artifacts/w6/browser';
await fs.mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.CHROME_EXECUTABLE || '/usr/bin/google-chrome', args: ['--no-sandbox'] });
after(async () => { await browser.close(); await server?.close(); });
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const png = new PNG({ width: 1777, height: 1031 });
for (let y = 0; y < png.height; y++) for (let x = 0; x < png.width; x++) {
  const i = (y * png.width + x) * 4; png.data.set([x % 251, y % 251, (x + y) % 251, 255], i);
}
const input = { name: 'w6-source.png', mimeType: 'image/png', buffer: PNG.sync.write(png) };
async function setup({ language = 'en', theme = 'light-coral', width = 1440 } = {}) {
  const context = await browser.newContext({ viewport: { width, height: 950 } });
  const errors = [];
  await context.route('**/*', route => route.request().url().startsWith(base + '/') || /^(data:|blob:)/.test(route.request().url()) ? route.continue() : route.abort());
  await context.addInitScript(() => {
    const hash = async blob => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', blob instanceof Blob ? await blob.arrayBuffer() : blob))).map(x => x.toString(16).padStart(2, '0')).join('');
    window.__w6 = { imports: [], batches: [], privacy: [], results: [], urls: [], revoked: [] };
    const bitmap = window.createImageBitmap;
    window.createImageBitmap = function(file, ...args) {
      if (file instanceof File) window.__w6.imports.push(Promise.resolve(hash(file)).then(sha => ({ name: file.name, mime: file.type, size: file.size, sha })));
      return bitmap.call(this, file, ...args);
    };
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      constructor(...args) {
        super(...args);
        this.addEventListener('message', event => {
          if (event.data.type === 'result' && event.data.result?.images) window.__w6.results.push(Promise.all(event.data.result.images.map(async image => ({ name: image.fileName, mime: image.mimeType, size: image.size, sha: await hash(image.blob) }))));
        });
      }
      postMessage(message, ...args) {
        if (message.type === 'batch') window.__w6.batches.push(Promise.all(message.inputs.map(input => { const bytes = input.buffer.slice(0); return hash(bytes).then(sha => ({ name: input.name, mime: input.mimeType, sha })); })));
        if (message.files?.length && message.files[0].buffer instanceof ArrayBuffer) window.__w6.privacy.push(Promise.all(message.files.map(file => {
          const bytes = file.buffer.slice(0); return hash(bytes).then(sha => ({ name: file.name, mime: file.type, sha }));
        })));
        return super.postMessage(message, ...args);
      }
    };
    const create = URL.createObjectURL, revoke = URL.revokeObjectURL;
    URL.createObjectURL = function(blob) { const url = create.call(this, blob); window.__w6.urls.push({ url, type: blob.type }); return url; };
    URL.revokeObjectURL = function(url) { window.__w6.revoked.push(url); return revoke.call(this, url); };
  });
  const p = await context.newPage(); p.on('dialog', dialog => { errors.push('Unexpected native dialog'); void dialog.dismiss(); }); p.setDefaultTimeout(60_000); p.on('pageerror', error => errors.push(error.message));
  await p.goto(`${base}/${language}/tools/image-studio/`);
  await p.locator('[data-testid=library-image-editor] .lower-canvas').waitFor();
  await p.evaluate(theme => document.documentElement.setAttribute('data-theme', theme), theme);
  const tab = index => p.locator('[data-testid=image-studio-tabs] button').nth(index).click();
  await tab(1);
  const batch = p.locator('[data-image-owner=batch]');
  const run = async () => {
    const downloading = p.waitForEvent('download'); await p.locator('[data-testid=image-batch-action] button').click();
    const download = await downloading; const bytes = await fs.readFile(await download.path());
    await p.locator('[data-testid=image-batch-result]').first().waitFor();
    return JSZip.loadAsync(bytes);
  };
  const snapshot = async key => p.evaluate(async key => Promise.all(window.__w6[key]), key);
  return { p, context, errors, tab, batch, run, snapshot };
}
const evidence = [];
for (const format of ['png', 'jpeg', 'webp']) test(`W6 ${format}: actual ZIP bytes → editor import → basename-edited export${format === 'png' ? ' → W2 queue bytes' : ''}`, async () => {
  const { p, context, errors, tab, batch, run, snapshot } = await setup();
  try {
    await batch.locator('input[type=file]').first().setInputFiles(input);
    await batch.locator('select').first().selectOption('original');
    await batch.locator('select:has(option[value=png])').selectOption(format);
    const zip = await run();
    const result = (await snapshot('results')).at(-1)[0];
    assert.equal(sha(await zip.file(result.name).async('nodebuffer')), result.sha);
    assert.equal(result.mime, `image/${format}`);
    const open = p.locator('[data-testid=image-batch-result] button').first();
    await open.focus(); await p.keyboard.press('Enter');
    await p.waitForFunction(() => document.querySelector('[data-image-owner=editor]') === document.activeElement && !document.querySelector('[data-testid=image-editor-add-to-batch]').disabled);
    assert.equal((await snapshot('imports')).find(item => item.name === result.name)?.sha, result.sha);
    const editor = p.locator('[data-testid=library-image-editor]');
    assert.equal(await editor.getByRole('button', { name: format === 'jpeg' ? 'JPG' : format === 'webp' ? 'WebP' : 'PNG', exact: true }).getAttribute('aria-pressed'), 'true');
    const downloading = p.waitForEvent('download'); await p.locator('[data-testid=image-editor-export-action] button').click();
    const download = await downloading; const exported = await fs.readFile(await download.path());
    assert.equal(download.suggestedFilename(), result.name.replace(/\.[^.]+$/, '') + '-edited.' + (format === 'jpeg' ? 'jpg' : format));
    const resultImage = p.locator('[data-testid=image-editor-result] img');
    await resultImage.waitFor();
    const imageInfo = await resultImage.evaluate(async image => { await image.decode(); return { width: image.naturalWidth, height: image.naturalHeight, mime: (await (await fetch(image.src)).blob()).type }; });
    assert.deepEqual(imageInfo, { width: 1777, height: 1031, mime: `image/${format}` });
    if (format === 'png') {
      await p.locator('[data-testid=image-editor-add-to-batch]').click();
      await p.waitForFunction(() => document.querySelector('[data-testid=image-editor-add-to-batch]').textContent.includes('(2)'));
      const w2Image = p.locator('[data-testid=image-editor-result] img');
      const queuedSha = await w2Image.evaluate(async image => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', await (await fetch(image.src)).arrayBuffer()))).map(n => n.toString(16).padStart(2, '0')).join(''));
      assert.equal(queuedSha, sha(exported));
      await tab(1); assert.equal(await p.locator('[data-testid=image-batch-list]').getAttribute('data-count'), '2');
      assert.match(await p.locator('[data-testid=image-batch-edited-file]').innerText(), /-edited\.png/);
      await run(); const queued = (await snapshot('batches')).at(-1)[1]; assert.equal(queued.sha, queuedSha); assert.equal(queued.mime, 'image/png');
      evidence.push({ result, editorExportSha: sha(exported), w2Queued: queued });
    } else evidence.push({ result, editorExportSha: sha(exported), imageInfo });
    if (format === 'jpeg') {
      await p.locator('[data-testid=image-send-to-privacy]').click();
      await p.locator('[data-testid=unsaved-leave]').click();
      await p.waitForURL('**/tools/image-privacy');
      await p.waitForFunction(() => /1/.test(document.querySelector('[data-ui-component=file-drop-zone] strong')?.textContent || ''));
      await p.locator('[data-ui-component=primary-button]').click();
      await p.locator('[data-testid=image-privacy-result]').waitFor();
      const received = (await snapshot('privacy')).at(-1)[0];
      assert.equal(received.name, result.name.replace(/\.[^.]+$/, '') + '-edited.jpg');
      assert.equal(received.mime, 'image/jpeg'); assert.equal(received.sha, sha(exported));
      evidence.push({ sendToPrivacy: received });
    }
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});
test('replacement cancel preserves the old document; accept replaces it; no extra downloads', async () => {
  const { p, context, tab, batch, run, snapshot, errors } = await setup();
  try {
    await batch.locator('input[type=file]').first().setInputFiles([input, { ...input, name: 'second.png' }]);
    await batch.locator('select').first().selectOption('original'); await batch.locator('select:has(option[value=png])').selectOption('png'); await run();
    let extraDownloads = 0; p.on('download', () => extraDownloads++);
    await p.locator('[data-testid=image-batch-result] button').first().click();
    await p.waitForFunction(() => document.querySelector('[data-image-owner=editor]') === document.activeElement && !document.querySelector('[data-testid=image-editor-add-to-batch]').disabled);
    const editor = p.locator('[data-testid=library-image-editor]'); await editor.locator('.asp-commit').click(); await p.locator('[data-testid=image-editor-result] img').waitFor();
    const before = await p.locator('[data-testid=image-editor-result] img').getAttribute('src');
    await tab(1); const importsBefore = (await snapshot('imports')).length;
    const trigger = p.locator('[data-testid=image-batch-result] button').nth(1);
    const imports = importsBefore;
    await trigger.click();
    const dialog = p.getByTestId('confirmation-dialog'); await dialog.waitFor({ state: 'visible' });
    assert.equal(await p.getByTestId('confirmation-cancel').evaluate(el => el === document.activeElement), true);
    // A second queued activation must not replace the pending decision or import twice.
    await trigger.evaluate(button => { button.click(); button.click(); });
    assert.equal(await p.locator('dialog[open][data-testid=confirmation-dialog]').count(), 1);
    await p.keyboard.press('Escape');
    await dialog.waitFor({ state: 'hidden' });
    assert.equal(await trigger.evaluate(el => el === document.activeElement), true);
    assert.equal((await snapshot('imports')).length, imports);
    assert.equal(await p.locator('[data-image-owner=batch]').isVisible(), true);
    assert.equal((await snapshot('imports')).length, importsBefore);
    await tab(0); assert.equal(await p.locator('[data-testid=image-editor-result] img').getAttribute('src'), before);
    await tab(1); await trigger.click();
    await p.getByTestId('confirmation-cancel').click();
    assert.equal((await snapshot('imports')).length, importsBefore);
    await trigger.click(); await dialog.waitFor({ state: 'visible' });
    await dialog.screenshot({ path: path.join(output, 'replacement-confirm-en.png') });
    await p.getByTestId('confirmation-accept').click();
    await p.waitForFunction(() => document.querySelector('[data-image-owner=editor]') === document.activeElement && !document.querySelector('[data-testid=image-editor-add-to-batch]').disabled);
    assert.equal(await p.locator('[data-testid=image-editor-result]').count(), 0);
    // The library decodes a File for its source and preview. Compare with the
    // first successful intake rather than mistaking each decode for an intake.
    const initialResult = (await snapshot('results')).at(-1)[0];
    const firstDecodeCount = (await snapshot('imports')).slice(0, importsBefore).filter(item => item.name === initialResult.name).length;
    assert.ok(firstDecodeCount > 0);
    assert.equal((await snapshot('imports')).length, importsBefore + firstDecodeCount);
    const result = (await snapshot('results')).at(-1)[1]; assert.equal((await snapshot('imports')).find(item => item.name === result.name)?.sha, result.sha);
    assert.equal(extraDownloads, 0);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});
for (const width of [390, 1440]) for (const [language, theme] of [['ko', 'light-coral'], ['en', 'dark-mint']]) test(`results and editor ${width}px ${language} ${theme}: resized watermark + keyboard + screenshot`, async () => {
  const { p, context, batch, run, tab, errors } = await setup({ width, language, theme });
  try {
    await batch.locator('input[type=file]').first().setInputFiles(input);
    await batch.locator('input[type=number]').first().fill('640');
    await batch.locator('select:has(option[value=png])').selectOption('png');
    await batch.locator('.watermark-settings input').first().fill('W6 watermark');
    await run(); const rows = p.locator('[data-testid=image-batch-results]'); await rows.scrollIntoViewIfNeeded();
    assert.equal(await p.locator('[data-testid=image-batch-result] button').innerText(), language === 'ko' ? '편집기에서 열기' : 'Open in editor');
    assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    await p.screenshot({ path: path.join(output, `results-${width}-${language}.png`), fullPage: true });
    await rows.screenshot({ path: path.join(output, `result-rows-${width}-${language}.png`) });
    const open = p.locator('[data-testid=image-batch-result] button'); await open.focus(); await p.keyboard.press('Enter');
    await p.waitForFunction(() => document.querySelector('[data-image-owner=editor]') === document.activeElement && !document.querySelector('[data-testid=image-editor-add-to-batch]').disabled);
    await p.locator('[data-testid=library-image-editor] .asp-commit').click(); await p.locator('[data-testid=image-editor-result] img').waitFor();
    assert.deepEqual(await p.locator('[data-testid=image-editor-result] img').evaluate(async img => { await img.decode(); return [img.naturalWidth, img.naturalHeight]; }), [640, 371]);
    await p.screenshot({ path: path.join(output, `editor-${width}-${language}.png`), fullPage: true });
    await tab(1); await open.click();
    const dialog = p.getByTestId('confirmation-dialog'); await dialog.waitFor({ state: 'visible' });
    assert.equal(await p.getByTestId('confirmation-cancel').innerText(), language === 'ko' ? '취소' : 'Cancel');
    await dialog.screenshot({ path: path.join(output, `confirm-${width}-${language}.png`) });
    await p.getByTestId('confirmation-cancel').click();
    assert.equal(await p.locator('[data-image-owner=batch]').isVisible(), true);
    assert.deepEqual(errors, []);
  } finally { await context.close(); }
});
test('50 results allocate only the existing ZIP download URL; rerun failure removes stale results and URL is revoked', async () => {
  const { p, context, tab, batch, run, snapshot, errors } = await setup();
  try {
    // Playwright caps aggregate in-memory file payloads at 50MB. Use real local
    // files so this still exercises 50 full 1777×1031 inputs, rather than thumbnails.
    const bulkDir = path.join(output, 'bulk-inputs'); await fs.mkdir(bulkDir, { recursive: true });
    const paths = Array.from({ length: 50 }, (_, i) => path.join(bulkDir, `bulk-${i}.png`));
    await Promise.all(paths.map(file => fs.writeFile(file, input.buffer)));
    await batch.locator('input[type=file]').first().setInputFiles(paths);
    await batch.locator('input[type=number]').first().fill('24'); await run();
    assert.equal(await p.locator('[data-testid=image-batch-result]').count(), 50);
    const urls = await snapshot('urls'); assert.equal(urls.length, 1); assert.equal(urls[0].type, 'application/zip');
    await batch.locator('[data-testid=image-batch-list] button').first().click();
    await batch.locator('input[type=file]').first().setInputFiles({ name: 'broken.png', mimeType: 'image/png', buffer: Buffer.from('not an image') });
    await p.locator('[data-testid=image-batch-action] button').click();
    await p.waitForFunction(() => !document.querySelector('[data-testid=image-batch-action] button').disabled);
    assert.equal(await p.locator('[data-testid=image-batch-result]').count(), 0);
    await p.waitForFunction(url => window.__w6.revoked.includes(url), urls[0].url, { timeout: 20_000 });
    await tab(0); assert.deepEqual(errors, []);
  } finally { await context.close(); }
});
after(async () => fs.writeFile(path.join(output, 'sha-evidence.json'), JSON.stringify(evidence, null, 2)));
